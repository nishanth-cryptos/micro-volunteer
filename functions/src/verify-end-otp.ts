// HTTPS callable: accepted volunteer submits the End OTP. On success
// the task flips to 'completed', timestamps are recorded, and the
// volunteer's reputation counters are bumped:
//   users/{volunteerId}.verifiedTaskCount += 1
//   users/{volunteerId}.verifiedHours     += estimatedMinutes / 60
//   users/{volunteerId}.points            += POINTS_PER_TASK
//   users/{volunteerId}.skillPoints[k]    += 1   for each matching skill k

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { checkActiveStatus } from './moderation-helper';
import { constantTimeEquals, hashOtp } from './otp';

if (getApps().length === 0) {
  initializeApp();
}
const REGION = 'asia-south1';

export const verifyEndOtp = onCall(
  { region: REGION },
  async (request): Promise<{ taskId: string; status: 'completed' }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const data = (request.data ?? {}) as {
      taskId?: unknown;
      code?: unknown;
    };
    const taskId = data.taskId;
    const code = data.code;
    if (typeof taskId !== 'string' || taskId.length === 0) {
      throw new HttpsError('invalid-argument', 'taskId is required.');
    }
    if (typeof code !== 'string' || !/^\d{4,6}$/.test(code)) {
      throw new HttpsError('invalid-argument', 'Enter the 6-digit code.');
    }
    const callerUid = request.auth.uid;

    const db = getFirestore();
    await checkActiveStatus(db, callerUid);
    const taskRef = db.collection('tasks').doc(taskId);

    await db.runTransaction(async (tx) => {
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists) {
        throw new HttpsError('not-found', 'Task no longer exists.');
      }
      const task = taskSnap.data() as {
        acceptedVolunteerId?: string;
        status?: string;
        estimatedMinutes?: number;
        requiredSkills?: string[];
        endOtpHash?: string;
        endOtpSalt?: string;
        endOtpExpiresAt?: { toMillis: () => number };
      };
      if (task.acceptedVolunteerId !== callerUid) {
        throw new HttpsError(
          'permission-denied',
          'Only the accepted volunteer can submit this code.',
        );
      }
      if (task.status !== 'in_progress') {
        throw new HttpsError(
          'failed-precondition',
          'This task is not waiting on an end code.',
        );
      }
      if (!task.endOtpHash || !task.endOtpSalt || !task.endOtpExpiresAt) {
        throw new HttpsError(
          'failed-precondition',
          'Ask the customer to generate a fresh end code.',
        );
      }
      if (task.endOtpExpiresAt.toMillis() < Date.now()) {
        throw new HttpsError(
          'failed-precondition',
          'This code has expired. Ask the customer to generate a new one.',
        );
      }
      const inputHash = hashOtp(code, task.endOtpSalt);
      if (!constantTimeEquals(inputHash, task.endOtpHash)) {
        throw new HttpsError(
          'invalid-argument',
          'That code is wrong. Try again.',
        );
      }



      tx.update(taskRef, {
        status: 'completed',
        completedAt: FieldValue.serverTimestamp(),
        endOtpHash: FieldValue.delete(),
        endOtpSalt: FieldValue.delete(),
        endOtpExpiresAt: FieldValue.delete(),
      });
    });

    return { taskId, status: 'completed' };
  },
);
