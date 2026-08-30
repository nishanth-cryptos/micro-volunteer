// HTTPS callable: accepted volunteer submits the Start OTP to flip the
// task from 'accepted' to 'in_progress'.
//
// Verification is constant-time. On success the OTP material is cleared
// from the task doc. Wrong/expired codes don't clear material — the
// volunteer can retry (or the customer can regenerate after expiry).

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { checkActiveStatus } from './moderation-helper';
import { writeAuditEvent } from './audit';
import { constantTimeEquals, hashOtp } from './otp';
import { appendActivityLog, safeDisplayName } from './activity-log';
import { appendSystemMessage } from './chat';
import { logger } from 'firebase-functions/v2';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';

export const verifyStartOtp = onCall(
  { region: REGION },
  async (request): Promise<{ taskId: string; status: 'in_progress' }> => {
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
        startOtpHash?: string;
        startOtpSalt?: string;
        startOtpExpiresAt?: { toMillis: () => number };
      };
      if (task.acceptedVolunteerId !== callerUid) {
        throw new HttpsError(
          'permission-denied',
          'Only the accepted volunteer can submit this code.',
        );
      }
      if (task.status !== 'accepted') {
        throw new HttpsError(
          'failed-precondition',
          'This task is not waiting on a start code.',
        );
      }
      if (!task.startOtpHash || !task.startOtpSalt || !task.startOtpExpiresAt) {
        throw new HttpsError(
          'failed-precondition',
          'Ask the customer to generate a fresh start code.',
        );
      }
      if (task.startOtpExpiresAt.toMillis() < Date.now()) {
        throw new HttpsError(
          'failed-precondition',
          'This code has expired. Ask the customer to generate a new one.',
        );
      }
      const inputHash = hashOtp(code, task.startOtpSalt);
      if (!constantTimeEquals(inputHash, task.startOtpHash)) {
        throw new HttpsError(
          'invalid-argument',
          'That code is wrong. Try again.',
        );
      }

      tx.update(taskRef, {
        status: 'in_progress',
        startedAt: FieldValue.serverTimestamp(),
        startOtpHash: FieldValue.delete(),
        startOtpSalt: FieldValue.delete(),
        startOtpExpiresAt: FieldValue.delete(),
      });
    });

    await writeAuditEvent(taskId, 'started', callerUid);

    let taskTitle = 'a task';
    try {
      const t = await taskRef.get();
      taskTitle =
        (t.data() as { title?: string } | undefined)?.title?.trim() || 'a task';
    } catch {
      /* keep fallback */
    }
    const volunteerName = await safeDisplayName(db, callerUid, 'volunteer');
    await appendActivityLog(db, {
      eventType: 'task_started',
      description: `Task '${taskTitle}' started by ${volunteerName}`,
      userId: callerUid,
      taskId,
    });

    // Chat system message (M7) — best-effort, never blocks the response.
    try {
      await appendSystemMessage(
        db,
        taskId,
        'Task started — the start code was verified.',
      );
    } catch (err) {
      logger.warn('Failed to append start system message (non-fatal)', {
        taskId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    return { taskId, status: 'in_progress' };
  },
);
