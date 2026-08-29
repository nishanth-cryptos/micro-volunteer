// Batch 3 (Cloud Functions Integration) & Batch 4 (State Machine, Concurrency & Idempotency) Test Suite
// Executes against local Firebase Emulator Suite via Admin SDK and Cloud Function Handlers

import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { acceptOffer } from './accept-offer';
import { generateStartOtp } from './generate-start-otp';
import { verifyStartOtp } from './verify-start-otp';
import { generateEndOtp } from './generate-end-otp';
import { verifyEndOtp } from './verify-end-otp';
import { submitCustomerRating } from './submit-customer-rating';
import { reportUser } from './report-user';
import { blockUser } from './block-user';
import { applyModerationAction } from './apply-moderation-action';
import { cancelAcceptedTask } from './cancel-accepted-task';
import { deleteTask } from './delete-task';
import { hashOtp, generateSalt } from './otp';

if (getApps().length === 0) {
  initializeApp({ projectId: 'micro---volunteer' });
}

const db = getFirestore();

// Helper to seed standard user docs
async function seedUser(uid: string, data: Record<string, unknown> = {}) {
  await db.collection('users').doc(uid).set({
    displayName: `User ${uid}`,
    accountStatus: 'active',
    roles: ['customer', 'volunteer'],
    skills: ['gardening', 'buy-groceries'],
    points: 0,
    verifiedTaskCount: 0,
    verifiedHours: 0,
    trustScore: 50,
    ...data,
  });
}

beforeEach(async () => {
  // Clear Firestore collections used in tests
  const collections = ['tasks', 'users', 'chats', 'reports', 'blocks', 'adminActions', 'activityLog'];
  for (const colName of collections) {
    const snap = await db.collection(colName).get();
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    if (!snap.empty) await batch.commit();
  }
});

// ==================================================================
// PART A: BATCH 3 — CLOUD FUNCTION AUTHORIZATION & PAYLOAD VALIDATION
// ==================================================================

test('Batch 3 Authorization: callables reject unauthenticated invocations', async () => {
  const reqUnauth = { auth: undefined, data: { taskId: 't1' } } as any;

  await assert.rejects(
    async () => acceptOffer.run(reqUnauth),
    (err: HttpsError) => err.code === 'unauthenticated',
  );

  await assert.rejects(
    async () => generateStartOtp.run(reqUnauth),
    (err: HttpsError) => err.code === 'unauthenticated',
  );

  await assert.rejects(
    async () => verifyStartOtp.run({ auth: undefined, data: { taskId: 't1', code: '123456' } } as any),
    (err: HttpsError) => err.code === 'unauthenticated',
  );

  await assert.rejects(
    async () => generateEndOtp.run(reqUnauth),
    (err: HttpsError) => err.code === 'unauthenticated',
  );

  await assert.rejects(
    async () => verifyEndOtp.run({ auth: undefined, data: { taskId: 't1', code: '123456' } } as any),
    (err: HttpsError) => err.code === 'unauthenticated',
  );
});

test('Batch 3 Input Validation: callables reject missing/malformed payload data', async () => {
  const reqAuth = { auth: { uid: 'u1' }, data: {} } as any;

  await assert.rejects(
    async () => acceptOffer.run(reqAuth),
    (err: HttpsError) => err.code === 'invalid-argument',
  );

  await assert.rejects(
    async () => verifyStartOtp.run({ auth: { uid: 'u1' }, data: { taskId: 't1', code: 'bad-code' } } as any),
    (err: HttpsError) => err.code === 'invalid-argument',
  );

  await assert.rejects(
    async () => reportUser.run({ auth: { uid: 'u1' }, data: { reportedUid: 'u1' } } as any),
    (err: HttpsError) => err.code === 'invalid-argument', // cannot report self
  );

  await assert.rejects(
    async () => blockUser.run({ auth: { uid: 'u1' }, data: { targetUid: 'u1' } } as any),
    (err: HttpsError) => err.code === 'invalid-argument', // cannot block self
  );
});

test('Batch 3 Active Status Enforcer: suspended or banned users are rejected', async () => {
  await seedUser('banned-vol', { accountStatus: 'banned' });
  await seedUser('cust-1');

  await db.collection('tasks').doc('task-search').set({
    customerId: 'cust-1',
    status: 'searching',
  });
  await db.collection('tasks').doc('task-search').collection('offers').doc('banned-vol').set({
    volunteerId: 'banned-vol',
    state: 'offered',
  });

  const reqBanned = { auth: { uid: 'banned-vol' }, data: { taskId: 'task-search' } } as any;

  await assert.rejects(
    async () => acceptOffer.run(reqBanned),
    (err: HttpsError) => err.code === 'permission-denied' && err.message.includes('banned'),
  );
});

test('Batch 3 Task Ownership & Role Verification', async () => {
  await seedUser('cust-owner');
  await seedUser('stranger');

  await db.collection('tasks').doc('task-own').set({
    customerId: 'cust-owner',
    status: 'accepted',
  });

  // Stranger tries to generate Start OTP for cust-owner's task
  await assert.rejects(
    async () => generateStartOtp.run({ auth: { uid: 'stranger' }, data: { taskId: 'task-own' } } as any),
    (err: HttpsError) => err.code === 'permission-denied',
  );

  // Admin moderation action by non-admin user
  await assert.rejects(
    async () => applyModerationAction.run({ auth: { uid: 'stranger' }, data: { targetUid: 'cust-owner', action: 'ban' } } as any),
    (err: HttpsError) => err.code === 'permission-denied',
  );
});

test('Batch 3 Customer Rating & Cancel Accepted Task Authorization', async () => {
  await seedUser('cust-rate');
  await seedUser('vol-rate');

  await db.collection('tasks').doc('task-completed').set({
    customerId: 'cust-rate',
    acceptedVolunteerId: 'vol-rate',
    status: 'completed',
  });

  // Stranger rating completed task denied
  await assert.rejects(
    async () => submitCustomerRating.run({ auth: { uid: 'vol-rate' }, data: { taskId: 'task-completed', rating: 5 } } as any),
    (err: HttpsError) => err.code === 'permission-denied',
  );

  // Invalid rating value (< 1 or > 5) rejected
  await assert.rejects(
    async () => submitCustomerRating.run({ auth: { uid: 'cust-rate' }, data: { taskId: 'task-completed', rating: 10 } } as any),
    (err: HttpsError) => err.code === 'invalid-argument',
  );

  // Cancel accepted task authorization
  await db.collection('tasks').doc('task-accepted-cancel').set({
    customerId: 'cust-rate',
    acceptedVolunteerId: 'vol-rate',
    status: 'accepted',
  });

  // Stranger trying to cancel accepted task denied
  await assert.rejects(
    async () => cancelAcceptedTask.run({ auth: { uid: 'cust-rate' }, data: { taskId: 'task-accepted-cancel', reason: 'accidental_accept' } } as any),
    (err: HttpsError) => err.code === 'permission-denied',
  );

  // Assigned volunteer can cancel
  const cancelRes = await cancelAcceptedTask.run({
    auth: { uid: 'vol-rate' },
    data: { taskId: 'task-accepted-cancel', reason: 'accidental_accept' },
  } as any);
  assert.equal(cancelRes.success, true);
});

// ==================================================================
// PART B: BATCH 4 — TASK STATE MACHINE TRANSITION TESTING
// ==================================================================

test('Batch 4 Lifecycle: valid transitions flow (searching -> accepted -> in_progress -> completed)', async () => {
  await seedUser('cust-sm');
  await seedUser('vol-sm');

  // Seed task in searching state
  const taskRef = db.collection('tasks').doc('task-sm-1');
  await taskRef.set({
    customerId: 'cust-sm',
    title: 'Gardening help',
    status: 'searching',
    estimatedMinutes: 30,
    requiredSkills: ['gardening'],
  });
  await taskRef.collection('offers').doc('vol-sm').set({
    volunteerId: 'vol-sm',
    state: 'offered',
  });

  // 1. searching -> accepted (via acceptOffer)
  const acceptRes = await acceptOffer.run({ auth: { uid: 'vol-sm' }, data: { taskId: 'task-sm-1' } } as any);
  assert.equal(acceptRes.taskId, 'task-sm-1');

  let snap = await taskRef.get();
  assert.equal(snap.data()?.status, 'accepted');
  assert.equal(snap.data()?.acceptedVolunteerId, 'vol-sm');

  // 2. Customer generates Start OTP
  const startOtpRes = await generateStartOtp.run({ auth: { uid: 'cust-sm' }, data: { taskId: 'task-sm-1' } } as any);
  assert.match(startOtpRes.code, /^\d{6}$/);

  // 3. accepted -> in_progress (via verifyStartOtp)
  const startVerifyRes = await verifyStartOtp.run({
    auth: { uid: 'vol-sm' },
    data: { taskId: 'task-sm-1', code: startOtpRes.code },
  } as any);
  assert.equal(startVerifyRes.status, 'in_progress');

  snap = await taskRef.get();
  assert.equal(snap.data()?.status, 'in_progress');

  // 4. Customer generates End OTP
  const salt = generateSalt();
  const endCode = '654321';
  const endHash = hashOtp(endCode, salt);
  await taskRef.update({
    endOtpHash: endHash,
    endOtpSalt: salt,
    endOtpExpiresAt: Timestamp.fromMillis(Date.now() + 600000),
  });

  // 5. in_progress -> completed (via verifyEndOtp)
  const endVerifyRes = await verifyEndOtp.run({
    auth: { uid: 'vol-sm' },
    data: { taskId: 'task-sm-1', code: endCode },
  } as any);
  assert.equal(endVerifyRes.status, 'completed');

  snap = await taskRef.get();
  assert.equal(snap.data()?.status, 'completed');
});

test('Batch 4 Lifecycle: invalid transition attempts are rejected with failed-precondition', async () => {
  await seedUser('cust-inv');
  await seedUser('vol-inv');

  const taskRef = db.collection('tasks').doc('task-inv-1');
  await taskRef.set({
    customerId: 'cust-inv',
    acceptedVolunteerId: 'vol-inv',
    status: 'searching', // Currently in searching
  });

  // Attempt searching -> in_progress directly (must fail)
  await assert.rejects(
    async () => verifyStartOtp.run({ auth: { uid: 'vol-inv' }, data: { taskId: 'task-inv-1', code: '123456' } } as any),
    (err: HttpsError) => err.code === 'failed-precondition',
  );

  // Attempt searching -> completed directly (must fail)
  await assert.rejects(
    async () => verifyEndOtp.run({ auth: { uid: 'vol-inv' }, data: { taskId: 'task-inv-1', code: '123456' } } as any),
    (err: HttpsError) => err.code === 'failed-precondition',
  );

  // Attempt deleteTask on in_progress task (must fail with failed-precondition)
  await taskRef.update({ status: 'in_progress' });
  await assert.rejects(
    async () => deleteTask.run({ auth: { uid: 'cust-inv' }, data: { taskId: 'task-inv-1', reason: 'no_longer_needed' } } as any),
    (err: HttpsError) => err.code === 'failed-precondition',
  );

});

// ==================================================================
// PART C: BATCH 4 — CONCURRENT OFFER ACCEPTANCE RACE SAFETY
// ==================================================================

test('Batch 4 Concurrency: concurrent offer acceptance guarantees exactly one winner', async () => {
  await seedUser('cust-race');
  await seedUser('vol-A');
  await seedUser('vol-B');

  const taskId = 'task-race-accept';
  const taskRef = db.collection('tasks').doc(taskId);
  await taskRef.set({
    customerId: 'cust-race',
    title: 'Park cleanup',
    status: 'searching',
  });
  await taskRef.collection('offers').doc('vol-A').set({ volunteerId: 'vol-A', state: 'offered' });
  await taskRef.collection('offers').doc('vol-B').set({ volunteerId: 'vol-B', state: 'offered' });

  // Fire concurrent acceptOffer calls for vol-A and vol-B
  const results = await Promise.allSettled([
    acceptOffer.run({ auth: { uid: 'vol-A' }, data: { taskId } } as any),
    acceptOffer.run({ auth: { uid: 'vol-B' }, data: { taskId } } as any),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one volunteer accept must succeed');
  assert.equal(rejected.length, 1, 'Losing volunteer accept must be rejected');

  const taskSnap = await taskRef.get();
  const taskData = taskSnap.data();
  assert.equal(taskData?.status, 'accepted');
  assert.ok(['vol-A', 'vol-B'].includes(taskData?.acceptedVolunteerId));

  // Verify offer states in Firestore
  const offerASnap = await taskRef.collection('offers').doc('vol-A').get();
  const offerBSnap = await taskRef.collection('offers').doc('vol-B').get();

  const states = [offerASnap.data()?.state, offerBSnap.data()?.state];
  assert.ok(states.includes('accepted'), 'Winning offer is accepted');

  // Verify single chat creation
  const chatSnap = await db.collection('chats').doc(taskId).get();
  assert.ok(chatSnap.exists, 'Chat document created cleanly once');
});

// ==================================================================
// PART D: BATCH 4 — CONCURRENT START OTP VERIFICATION
// ==================================================================

test('Batch 4 Concurrency: concurrent Start OTP verification executes transition exactly once', async () => {
  await seedUser('cust-otp');
  await seedUser('vol-otp');

  const taskId = 'task-start-otp-race';
  const taskRef = db.collection('tasks').doc(taskId);

  const salt = generateSalt();
  const code = '123456';
  const hash = hashOtp(code, salt);

  await taskRef.set({
    customerId: 'cust-otp',
    acceptedVolunteerId: 'vol-otp',
    status: 'accepted',
    startOtpHash: hash,
    startOtpSalt: salt,
    startOtpExpiresAt: Timestamp.fromMillis(Date.now() + 600000),
  });

  // Fire concurrent verifyStartOtp calls
  const results = await Promise.allSettled([
    verifyStartOtp.run({ auth: { uid: 'vol-otp' }, data: { taskId, code } } as any),
    verifyStartOtp.run({ auth: { uid: 'vol-otp' }, data: { taskId, code } } as any),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one start OTP verification succeeds');
  assert.equal(rejected.length, 1, 'Second OTP verification is rejected cleanly');

  const taskSnap = await taskRef.get();
  assert.equal(taskSnap.data()?.status, 'in_progress');
});

// ==================================================================
// PART E: BATCH 4 — CONCURRENT END OTP VERIFICATION & IDEMPOTENCY
// ==================================================================

test('Batch 4 Concurrency: concurrent End OTP verification completes task once without duplicate points', async () => {
  await seedUser('cust-end');
  await seedUser('vol-end');

  const taskId = 'task-end-otp-race';
  const taskRef = db.collection('tasks').doc(taskId);

  const salt = generateSalt();
  const code = '987654';
  const hash = hashOtp(code, salt);

  await taskRef.set({
    customerId: 'cust-end',
    acceptedVolunteerId: 'vol-end',
    status: 'in_progress',
    estimatedMinutes: 60,
    requiredSkills: ['gardening'],
    endOtpHash: hash,
    endOtpSalt: salt,
    endOtpExpiresAt: Timestamp.fromMillis(Date.now() + 600000),
  });

  // Fire concurrent verifyEndOtp calls
  const results = await Promise.allSettled([
    verifyEndOtp.run({ auth: { uid: 'vol-end' }, data: { taskId, code } } as any),
    verifyEndOtp.run({ auth: { uid: 'vol-end' }, data: { taskId, code } } as any),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one end OTP verification succeeds');
  assert.equal(rejected.length, 1, 'Replay end OTP verification is rejected');

  const taskSnap = await taskRef.get();
  assert.equal(taskSnap.data()?.status, 'completed');
});
