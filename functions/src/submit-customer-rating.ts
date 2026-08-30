// HTTPS callable: customer rates the accepted volunteer after the task
// completes. Writes customerRating + optional comment + customerRatedAt
// onto the task doc. Idempotent (rating once locks the field).

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { checkActiveStatus } from './moderation-helper';
import { writeAuditEvent } from './audit';
import { recomputeTrustScore } from './recompute-trust-score';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';
const MAX_COMMENT_LEN = 280;

export const submitCustomerRating = onCall(
  { region: REGION },
  async (request): Promise<{ taskId: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const data = (request.data ?? {}) as {
      taskId?: unknown;
      rating?: unknown;
      comment?: unknown;
    };
    const taskId = data.taskId;
    const rating = data.rating;
    const comment = data.comment;
    if (typeof taskId !== 'string' || taskId.length === 0) {
      throw new HttpsError('invalid-argument', 'taskId is required.');
    }
    if (
      typeof rating !== 'number' ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      throw new HttpsError('invalid-argument', 'Rating must be 1–5.');
    }
    let trimmedComment: string | null = null;
    if (typeof comment === 'string' && comment.trim().length > 0) {
      if (comment.length > MAX_COMMENT_LEN) {
        throw new HttpsError(
          'invalid-argument',
          `Comment must be ${String(MAX_COMMENT_LEN)} characters or fewer.`,
        );
      }
      trimmedComment = comment.trim();
    }
    const callerUid = request.auth.uid;

    const db = getFirestore();
    await checkActiveStatus(db, callerUid);
    const taskRef = db.collection('tasks').doc(taskId);

    let volunteerId: string | undefined;

    await db.runTransaction(async (tx) => {
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists) {
        throw new HttpsError('not-found', 'Task no longer exists.');
      }
      const task = taskSnap.data() as {
        customerId?: string;
        status?: string;
        customerRating?: number;
        acceptedVolunteerId?: string;
      };
      if (task.customerId !== callerUid) {
        throw new HttpsError(
          'permission-denied',
          'Only the task customer can rate.',
        );
      }
      if (task.status !== 'completed') {
        throw new HttpsError(
          'failed-precondition',
          'You can rate a task only after it is completed.',
        );
      }
      if (typeof task.customerRating === 'number') {
        throw new HttpsError(
          'already-exists',
          'You’ve already rated this task.',
        );
      }
      volunteerId = task.acceptedVolunteerId;
      const update: Record<string, unknown> = {
        customerRating: rating,
        customerRatedAt: FieldValue.serverTimestamp(),
      };
      if (trimmedComment) update.customerRatingComment = trimmedComment;
      tx.update(taskRef, update);
    });

    if (volunteerId) {
      await recomputeTrustScore(db, volunteerId);
    }

    await writeAuditEvent(taskId, 'rated', callerUid, { rating });
    return { taskId };
  },
);
