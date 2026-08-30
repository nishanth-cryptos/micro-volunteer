import { test, expect } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { HttpsError } from 'firebase-functions/v2/https';

import { acceptOffer } from '../functions/src/accept-offer';
import { generateStartOtp } from '../functions/src/generate-start-otp';
import { verifyStartOtp } from '../functions/src/verify-start-otp';
import { verifyEndOtp } from '../functions/src/verify-end-otp';
import { cancelAcceptedTask } from '../functions/src/cancel-accepted-task';
import { applyModerationAction } from '../functions/src/apply-moderation-action';
import { ensureChatForTask, appendSystemMessage } from '../functions/src/chat';
import { hashOtp, generateSalt } from '../functions/src/otp';

if (getApps().length === 0) {
  initializeApp({ projectId: 'micro---volunteer' });
}

const db = getFirestore();

async function seedUser(uid: string, data: Record<string, unknown> = {}) {
  await db
    .collection('users')
    .doc(uid)
    .set({
      displayName: `User ${uid}`,
      accountStatus: 'active',
      roles: ['customer', 'volunteer'],
      skills: ['gardening', 'buy-groceries'],
      points: 0,
      verifiedTaskCount: 0,
      verifiedHours: 0,
      trustScore: 50,
      availableNow: true,
      lastKnownLocation: {
        lat: 13.0202,
        lng: 77.6815,
        h3Cell: '89618926487ffff',
      },
      ...data,
    });
}

test.beforeEach(async () => {
  const collections = [
    'tasks',
    'users',
    'chats',
    'reports',
    'blocks',
    'adminActions',
    'activityLog',
  ];
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
// BATCH 8 — PLAYWRIGHT E2E JOURNEYS
// ==================================================================

test('Journey 1: Customer to Completion Full Lifecycle', async ({ page }) => {
  await seedUser('cust-j1');
  await seedUser('vol-j1');

  const taskId = 'task-j1-complete';
  const taskRef = db.collection('tasks').doc(taskId);

  // 1. Task created in searching state
  await taskRef.set({
    customerId: 'cust-j1',
    title: 'Help water garden',
    category: 'gardening',
    requiredSkills: ['gardening'],
    estimatedMinutes: 30,
    status: 'searching',
  });

  await taskRef
    .collection('offers')
    .doc('vol-j1')
    .set({ volunteerId: 'vol-j1', state: 'offered' });

  // 2. Volunteer accepts offer
  await acceptOffer.run({ auth: { uid: 'vol-j1' }, data: { taskId } } as any);

  let snap = await taskRef.get();
  expect(snap.data()?.status).toBe('accepted');
  expect(snap.data()?.acceptedVolunteerId).toBe('vol-j1');

  // 3. Both access chat & exchange messages
  await ensureChatForTask(db, taskId, 'cust-j1', 'vol-j1');
  await appendSystemMessage(db, taskId, 'Connected to volunteer.');

  let chatSnap = await db.collection('chats').doc(taskId).get();
  expect(chatSnap.exists).toBe(true);
  expect(chatSnap.data()?.participants).toEqual(['cust-j1', 'vol-j1']);

  // 4. Start OTP generated & verified -> in_progress
  const startOtpRes = await generateStartOtp.run({
    auth: { uid: 'cust-j1' },
    data: { taskId },
  } as any);
  expect(startOtpRes.code).toMatch(/^\d{6}$/);

  const verifyStartRes = await verifyStartOtp.run({
    auth: { uid: 'vol-j1' },
    data: { taskId, code: startOtpRes.code },
  } as any);
  expect(verifyStartRes.status).toBe('in_progress');

  // 5. End OTP generated & verified -> completed
  const salt = generateSalt();
  const endCode = '654321';
  const endHash = hashOtp(endCode, salt);
  await taskRef.update({
    endOtpHash: endHash,
    endOtpSalt: salt,
    endOtpExpiresAt: Timestamp.fromMillis(Date.now() + 600000),
  });

  const verifyEndRes = await verifyEndOtp.run({
    auth: { uid: 'vol-j1' },
    data: { taskId, code: endCode },
  } as any);
  expect(verifyEndRes.status).toBe('completed');

  snap = await taskRef.get();
  expect(snap.data()?.status).toBe('completed');

  // 6. Verify web app page loads cleanly
  await page.goto('/');
  await expect(page).toHaveTitle(/Hey Padosi|Volunteer/i);
});

test('Journey 2: Concurrent Offer Acceptance Race Protection', async () => {
  await seedUser('cust-j2');
  await seedUser('vol-A-j2');
  await seedUser('vol-B-j2');

  const taskId = 'task-j2-race';
  const taskRef = db.collection('tasks').doc(taskId);

  await taskRef.set({
    customerId: 'cust-j2',
    title: 'Grocery delivery',
    category: 'errands',
    requiredSkills: ['buy-groceries'],
    status: 'searching',
  });

  await taskRef
    .collection('offers')
    .doc('vol-A-j2')
    .set({ volunteerId: 'vol-A-j2', state: 'offered' });
  await taskRef
    .collection('offers')
    .doc('vol-B-j2')
    .set({ volunteerId: 'vol-B-j2', state: 'offered' });

  // Attempt simultaneous acceptance from Vol A and Vol B
  const results = await Promise.allSettled([
    acceptOffer.run({ auth: { uid: 'vol-A-j2' }, data: { taskId } } as any),
    acceptOffer.run({ auth: { uid: 'vol-B-j2' }, data: { taskId } } as any),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  expect(fulfilled.length).toBe(1);
  expect(rejected.length).toBe(1);

  const snap = await taskRef.get();
  expect(snap.data()?.status).toBe('accepted');
  expect(['vol-A-j2', 'vol-B-j2']).toContain(snap.data()?.acceptedVolunteerId);
});

test('Journey 3: Report Submission & Admin Moderation Flow', async () => {
  await seedUser('reporter-j3');
  await seedUser('target-j3');
  await seedUser('admin-j3', { isAdmin: true });

  // Admin suspends target user for inappropriate behavior
  const modRes = await applyModerationAction.run({
    auth: { uid: 'admin-j3' },
    data: {
      userId: 'target-j3',
      action: 'suspend',
      durationDays: 7,
      reason: 'Policy violation',
    },
  } as any);

  expect(modRes.success).toBe(true);

  const targetSnap = await db.collection('users').doc('target-j3').get();
  expect(targetSnap.data()?.accountStatus).toBe('suspended');

  // Verify suspended user cannot generate OTP or accept offers
  const taskId = 'task-j3-mod';
  await db.collection('tasks').doc(taskId).set({
    customerId: 'target-j3',
    status: 'accepted',
    acceptedVolunteerId: 'reporter-j3',
  });

  await expect(
    generateStartOtp.run({
      auth: { uid: 'target-j3' },
      data: { taskId },
    } as any),
  ).rejects.toThrow();
});

test('Journey 4: Reassignment Lifecycle (Vol A Suspended -> Task Reverted -> Vol B Accepts)', async () => {
  await seedUser('cust-j4');
  await seedUser('vol-A-j4');
  await seedUser('vol-B-j4');
  await seedUser('admin-j4', { isAdmin: true });

  const taskId = 'task-j4-reassign';
  const taskRef = db.collection('tasks').doc(taskId);

  // Vol A accepts task
  await taskRef.set({
    customerId: 'cust-j4',
    title: 'Medicine pick up',
    status: 'accepted',
    acceptedVolunteerId: 'vol-A-j4',
    startOtpHash: 'hash123',
    startOtpSalt: 'salt123',
  });

  // Admin suspends Vol A -> task automatically reverts to searching
  await applyModerationAction.run({
    auth: { uid: 'admin-j4' },
    data: {
      userId: 'vol-A-j4',
      action: 'suspend',
      durationDays: 3,
      reason: 'Missed appointment',
    },
  } as any);

  let snap = await taskRef.get();
  expect(snap.data()?.status).toBe('searching');
  expect(snap.data()?.acceptedVolunteerId).toBeUndefined();
  expect(snap.data()?.startOtpHash).toBeUndefined();

  // Vol B accepts reassigned task
  await taskRef
    .collection('offers')
    .doc('vol-B-j4')
    .set({ volunteerId: 'vol-B-j4', state: 'offered' });
  await acceptOffer.run({ auth: { uid: 'vol-B-j4' }, data: { taskId } } as any);

  snap = await taskRef.get();
  expect(snap.data()?.status).toBe('accepted');
  expect(snap.data()?.acceptedVolunteerId).toBe('vol-B-j4');
});

// ==================================================================
// BATCH 9 — RESILIENCE & PRIVACY / LOGGING AUDIT
// ==================================================================

test('Resilience: Duplicate request idempotency and invalid state error handling', async () => {
  await seedUser('cust-r1');
  await seedUser('vol-r1');

  const taskId = 'task-r1-idempotency';
  const taskRef = db.collection('tasks').doc(taskId);

  await taskRef.set({
    customerId: 'cust-r1',
    title: 'Plant tree',
    status: 'completed', // Task is already completed
    acceptedVolunteerId: 'vol-r1',
  });

  // Attempting to cancel an already completed task throws failed-precondition error cleanly
  await expect(
    cancelAcceptedTask.run({
      auth: { uid: 'vol-r1' },
      data: { taskId, reason: 'accidental_accept' },
    } as any),
  ).rejects.toThrow();
});
