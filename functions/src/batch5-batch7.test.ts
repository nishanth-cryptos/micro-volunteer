// Batch 5 (OTP Security), Batch 6 (Matching Engine), and Batch 7 (Chat & Reassignment Integrity) Test Suite
// Executes against local Firebase Emulator Suite via Admin SDK and Cloud Function Handlers

import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { acceptOffer } from './accept-offer';
import { generateStartOtp } from './generate-start-otp';
import { verifyStartOtp } from './verify-start-otp';
import { verifyEndOtp } from './verify-end-otp';
import { cancelAcceptedTask } from './cancel-accepted-task';
import { applyModerationAction } from './apply-moderation-action';
import { rankForTask } from './scoring';
import { ensureChatForTask, appendSystemMessage } from './chat';
import { hashOtp, generateSalt } from './otp';

if (getApps().length === 0) {
  initializeApp({ projectId: 'micro---volunteer' });
}

const db = getFirestore();

// Helper to seed user docs with lastKnownLocation
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
    availableNow: true,
    lastKnownLocation: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' },
    ...data,
  });
}

beforeEach(async () => {
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
// BATCH 5 — OTP SECURITY & LIFECYCLE INTEGRITY
// ==================================================================

test('Batch 5 OTP Security: Plaintext code return, hash storage, and failure modes', async () => {
  await seedUser('cust-otp-sec');
  await seedUser('vol-otp-sec');

  const taskId = 'task-otp-sec-1';
  const taskRef = db.collection('tasks').doc(taskId);
  await taskRef.set({
    customerId: 'cust-otp-sec',
    acceptedVolunteerId: 'vol-otp-sec',
    status: 'accepted',
  });

  // 1. Customer generates Start OTP
  const genRes = await generateStartOtp.run({
    auth: { uid: 'cust-otp-sec' },
    data: { taskId },
  } as any);

  // Plaintext code is returned in response
  assert.match(genRes.code, /^\d{6}$/);

  // Inspect Firestore task document: plaintext is NOT stored
  const snap = await taskRef.get();
  const taskData = snap.data();
  assert.equal(taskData?.startOtpCode, undefined, 'Plaintext code MUST NOT be stored in Firestore');
  assert.ok(taskData?.startOtpHash, 'SHA-256 hash must be stored');
  assert.ok(taskData?.startOtpSalt, 'Salt must be stored');
  assert.ok(taskData?.startOtpExpiresAt, 'Expiration timestamp must be stored');

  // 2. Volunteer tries invalid / wrong code -> fails
  await assert.rejects(
    async () => verifyStartOtp.run({
      auth: { uid: 'vol-otp-sec' },
      data: { taskId, code: '000000' },
    } as any),
    (err: HttpsError) => err.code === 'invalid-argument',
  );

  // 3. Expired OTP fails
  await taskRef.update({
    startOtpExpiresAt: Timestamp.fromMillis(Date.now() - 1000), // Expired 1 second ago
  });

  await assert.rejects(
    async () => verifyStartOtp.run({
      auth: { uid: 'vol-otp-sec' },
      data: { taskId, code: genRes.code },
    } as any),
    (err: HttpsError) => err.code === 'failed-precondition' && err.message.includes('expired'),
  );

  // 4. Fresh code verification succeeds and clears OTP material
  const freshGen = await generateStartOtp.run({
    auth: { uid: 'cust-otp-sec' },
    data: { taskId },
  } as any);

  const verifyRes = await verifyStartOtp.run({
    auth: { uid: 'vol-otp-sec' },
    data: { taskId, code: freshGen.code },
  } as any);

  assert.equal(verifyRes.status, 'in_progress');

  const afterSnap = await taskRef.get();
  assert.equal(afterSnap.data()?.startOtpHash, undefined, 'Successful verification clears startOtpHash');
  assert.equal(afterSnap.data()?.startOtpSalt, undefined, 'Successful verification clears startOtpSalt');

  // 5. Replay attempt fails
  await assert.rejects(
    async () => verifyStartOtp.run({
      auth: { uid: 'vol-otp-sec' },
      data: { taskId, code: freshGen.code },
    } as any),
    (err: HttpsError) => err.code === 'failed-precondition',
  );
});

test('Batch 5 OTP Security: Material clearance on task cancellation / reassignment', async () => {
  await seedUser('cust-reassign');
  await seedUser('vol-old');

  const taskId = 'task-otp-clear-1';
  const taskRef = db.collection('tasks').doc(taskId);

  const salt = generateSalt();
  const code = '112233';
  const hash = hashOtp(code, salt);

  await taskRef.set({
    customerId: 'cust-reassign',
    acceptedVolunteerId: 'vol-old',
    status: 'accepted',
    startOtpHash: hash,
    startOtpSalt: salt,
    startOtpExpiresAt: Timestamp.fromMillis(Date.now() + 600000),
  });

  // Volunteer cancels accepted task
  await cancelAcceptedTask.run({
    auth: { uid: 'vol-old' },
    data: { taskId, reason: 'accidental_accept' },
  } as any);

  const snap = await taskRef.get();
  const data = snap.data();

  assert.equal(data?.status, 'searching');
  assert.equal(data?.acceptedVolunteerId, undefined);
  assert.equal(data?.startOtpHash, undefined, 'Reassignment clears startOtpHash');
  assert.equal(data?.startOtpSalt, undefined, 'Reassignment clears startOtpSalt');

  // Old volunteer cannot complete or verify code after cancellation
  await assert.rejects(
    async () => verifyStartOtp.run({
      auth: { uid: 'vol-old' },
      data: { taskId, code },
    } as any),
    (err: HttpsError) => err.code === 'permission-denied' || err.code === 'failed-precondition',
  );
});

// ==================================================================
// BATCH 6 — MATCHING ENGINE & DISPATCH HARDENING
// ==================================================================

test('Batch 6 Matching: Distance, Radius, Skills, and Status Eligibility Boundaries', async () => {
  // Seed customer location in Indiranagar, Bangalore
  await seedUser('cust-match', {
    lastKnownLocation: { lat: 12.9784, lng: 77.6408, h3Cell: '89618926487ffff' },
  });

  // Volunteer A: Inside radius (500m away), has skill 'gardening'
  await seedUser('vol-near', {
    lastKnownLocation: { lat: 12.9800, lng: 77.6410, h3Cell: '89618926487ffff' },
    skills: ['gardening'],
    availableNow: true,
  });

  // Volunteer B: Outside radius (15km away)
  await seedUser('vol-far', {
    lastKnownLocation: { lat: 13.1000, lng: 77.7500, h3Cell: '89618926400ffff' },
    skills: ['gardening'],
    availableNow: true,
  });

  // Volunteer C: Banned volunteer inside radius
  await seedUser('vol-banned', {
    lastKnownLocation: { lat: 12.9785, lng: 77.6409, h3Cell: '89618926487ffff' },
    skills: ['gardening'],
    availableNow: true,
    accountStatus: 'banned',
  });

  const taskDoc = {
    taskId: 'task-match-1',
    customerId: 'cust-match',
    title: 'Plant flowers',
    category: 'gardening',
    requiredSkills: ['gardening'],
    riskLevel: 'low' as const,
    location: { lat: 12.9784, lng: 77.6408, h3Cell: '89618926487ffff' },
    searchRadiusM: 2000,
    status: 'searching' as const,
  };

  const ranked = await rankForTask(taskDoc);
  const rankedUids = ranked.map((r) => r.uid);

  assert.ok(rankedUids.includes('vol-near'), 'Near volunteer with matching skill is included');
  assert.ok(!rankedUids.includes('vol-far'), 'Far volunteer outside search radius is excluded');
  assert.ok(!rankedUids.includes('vol-banned'), 'Banned volunteer is strictly excluded');
  assert.ok(!rankedUids.includes('cust-match'), 'Customer cannot be candidate for their own task');
});

test('Batch 6 Matching: Mutual block filtering in both directions', async () => {
  await seedUser('cust-block');
  await seedUser('vol-blocked-by-cust');
  await seedUser('vol-blocking-cust');

  // Customer blocked Volunteer A
  await db.collection('blocks').doc('cust-block_vol-blocked-by-cust').set({
    userA: 'cust-block',
    userB: 'vol-blocked-by-cust',
    blockedBy: 'cust-block',
  });

  // Volunteer B blocked Customer
  await db.collection('blocks').doc('cust-block_vol-blocking-cust').set({
    userA: 'cust-block',
    userB: 'vol-blocking-cust',
    blockedBy: 'vol-blocking-cust',
  });

  const taskDoc = {
    taskId: 'task-block-check',
    customerId: 'cust-block',
    title: 'Help move boxes',
    category: 'errands',
    requiredSkills: ['buy-groceries'],
    riskLevel: 'low' as const,
    location: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' },
    searchRadiusM: 5000,
    status: 'searching' as const,
  };

  const ranked = await rankForTask(taskDoc);
  const rankedUids = ranked.map((r) => r.uid);

  assert.ok(!rankedUids.includes('vol-blocked-by-cust'), 'Volunteer blocked by customer is excluded');
  assert.ok(!rankedUids.includes('vol-blocking-cust'), 'Volunteer who blocked customer is excluded');
});

// ==================================================================
// BATCH 7 — CHAT & REASSIGNMENT INTEGRITY
// ==================================================================

test('Batch 7 Reassignment Lifecycle: 15-Step complete scenario (Vol A -> Reassign -> Vol B)', async () => {
  await seedUser('cust-e2e');
  await seedUser('vol-A-e2e');
  await seedUser('vol-B-e2e');
  await seedUser('admin-1', { isAdmin: true });

  const taskId = 'task-e2e-reassign';
  const taskRef = db.collection('tasks').doc(taskId);

  // 1. Customer creates task
  await taskRef.set({
    customerId: 'cust-e2e',
    title: 'Grocery help',
    category: 'errands',
    requiredSkills: ['buy-groceries'],
    estimatedMinutes: 30,
    status: 'searching',
  });

  await taskRef.collection('offers').doc('vol-A-e2e').set({ volunteerId: 'vol-A-e2e', state: 'offered' });
  await taskRef.collection('offers').doc('vol-B-e2e').set({ volunteerId: 'vol-B-e2e', state: 'offered' });

  // 2. Vol A accepts task
  await acceptOffer.run({ auth: { uid: 'vol-A-e2e' }, data: { taskId } } as any);

  // 3. Verify Chat created for [cust-e2e, vol-A-e2e]
  let chatSnap = await db.collection('chats').doc(taskId).get();
  assert.ok(chatSnap.exists, 'Chat document created for Vol A');
  assert.deepEqual(chatSnap.data()?.participants, ['cust-e2e', 'vol-A-e2e']);

  // 4. Users exchange messages
  await db.collection('chats').doc(taskId).collection('messages').add({
    senderUid: 'vol-A-e2e',
    text: 'On my way!',
    system: false,
    sentAt: Timestamp.now(),
  });

  // 5. Task starts via Start OTP
  const startOtpRes = await generateStartOtp.run({ auth: { uid: 'cust-e2e' }, data: { taskId } } as any);
  await verifyStartOtp.run({ auth: { uid: 'vol-A-e2e' }, data: { taskId, code: startOtpRes.code } } as any);

  let snap = await taskRef.get();
  assert.equal(snap.data()?.status, 'in_progress');

  // 6 & 7. Vol A is suspended by Admin & task reassigned back to searching
  await applyModerationAction.run({
    auth: { uid: 'admin-1' },
    data: { userId: 'vol-A-e2e', action: 'suspend', durationDays: 3, reason: 'No-show' },
  } as any);

  snap = await taskRef.get();
  assert.equal(snap.data()?.status, 'searching', 'Moderation suspension reverts task status to searching');
  assert.equal(snap.data()?.acceptedVolunteerId, undefined, 'Moderation suspension clears acceptedVolunteerId');

  // Re-seed offer for Vol B
  await taskRef.collection('offers').doc('vol-B-e2e').set({ volunteerId: 'vol-B-e2e', state: 'offered' });

  // 8. Vol B accepts reassigned task
  await acceptOffer.run({ auth: { uid: 'vol-B-e2e' }, data: { taskId } } as any);

  snap = await taskRef.get();
  assert.equal(snap.data()?.status, 'accepted');
  assert.equal(snap.data()?.acceptedVolunteerId, 'vol-B-e2e');

  // 9. ensureChatForTask re-keys chat participants to [cust-e2e, vol-B-e2e]
  await ensureChatForTask(db, taskId, 'cust-e2e', 'vol-B-e2e');

  chatSnap = await db.collection('chats').doc(taskId).get();
  assert.deepEqual(chatSnap.data()?.participants, ['cust-e2e', 'vol-B-e2e']);

  // Verify old messages from Vol A were purged during re-keying
  const msgSnap = await db.collection('chats').doc(taskId).collection('messages').get();
  const volAMessages = msgSnap.docs.filter((d) => d.data().senderUid === 'vol-A-e2e');
  assert.equal(volAMessages.length, 0, 'Vol A stale messages purged on chat re-key');

  // 10. Vol B completes task
  const newStartOtp = await generateStartOtp.run({ auth: { uid: 'cust-e2e' }, data: { taskId } } as any);
  await verifyStartOtp.run({ auth: { uid: 'vol-B-e2e' }, data: { taskId, code: newStartOtp.code } } as any);

  // Generate and verify End OTP for Vol B
  const salt = generateSalt();
  const endCode = '778899';
  const endHash = hashOtp(endCode, salt);
  await taskRef.update({
    endOtpHash: endHash,
    endOtpSalt: salt,
    endOtpExpiresAt: Timestamp.fromMillis(Date.now() + 600000),
  });

  const endVerifyRes = await verifyEndOtp.run({ auth: { uid: 'vol-B-e2e' }, data: { taskId, code: endCode } } as any);
  assert.equal(endVerifyRes.status, 'completed');

  snap = await taskRef.get();
  assert.equal(snap.data()?.status, 'completed');
});

test('Batch 7 Chat Security: System message formatting and inbox preview helper', async () => {
  await seedUser('cust-preview');
  await seedUser('vol-preview');

  const taskId = 'task-preview-1';
  await ensureChatForTask(db, taskId, 'cust-preview', 'vol-preview');
  await appendSystemMessage(db, taskId, 'Connected to volunteer.');

  const chatSnap = await db.collection('chats').doc(taskId).get();
  assert.equal(chatSnap.data()?.lastMessagePreview, 'Connected to volunteer.');
});
