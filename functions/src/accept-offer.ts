// HTTPS callable: a volunteer accepts a task offer.
//
// Transactional race-safety:
//   1. Read task — fail if status != 'searching' (someone already grabbed it).
//   2. Read offer — fail if state != 'offered' (this volunteer already responded).
//   3. Write task.status='accepted' + acceptedVolunteerId + acceptedAt.
//   4. Write this offer.state='accepted' + respondedAt.
// The transaction guarantees only one volunteer's accept can flip the task
// from 'searching'. Concurrent attempts see the new status on retry and bail.
//
// Outside the transaction we mark sibling offers as 'superseded' for the
// volunteer inbox UX. This isn't security-critical (task.status already
// prevents further accepts) so it lives outside the txn.

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';

interface AcceptResponse {
  taskId: string;
  acceptedAt: number;
}

export const acceptOffer = onCall(
  { region: REGION },
  async (request): Promise<AcceptResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const data = (request.data ?? {}) as {
      taskId?: unknown;
    };
    const taskId = data.taskId;
    if (typeof taskId !== 'string' || taskId.length === 0) {
      throw new HttpsError('invalid-argument', 'taskId is required.');
    }
    const volunteerId = request.auth.uid;

    const db = getFirestore();
    const taskRef = db.collection('tasks').doc(taskId);
    const offerRef = taskRef.collection('offers').doc(volunteerId);

    const acceptedAtMs = await db.runTransaction(async (tx) => {
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists) {
        throw new HttpsError('not-found', 'Task no longer exists.');
      }
      const task = taskSnap.data() as { status?: string };
      if (task.status !== 'searching') {
        throw new HttpsError(
          'failed-precondition',
          'This task is no longer accepting volunteers.',
        );
      }

      const offerSnap = await tx.get(offerRef);
      if (!offerSnap.exists) {
        throw new HttpsError(
          'permission-denied',
          'You don’t have an offer for this task.',
        );
      }
      const offer = offerSnap.data() as { state?: string };
      if (offer.state !== 'offered') {
        throw new HttpsError(
          'failed-precondition',
          'You’ve already responded to this offer.',
        );
      }

      const now = FieldValue.serverTimestamp();
      tx.update(taskRef, {
        status: 'accepted',
        acceptedVolunteerId: volunteerId,
        acceptedAt: now,
      });
      tx.update(offerRef, {
        state: 'accepted',
        respondedAt: now,
      });
      return Date.now();
    });

    // Outside the transaction: mark sibling offers as superseded. Best-effort;
    // a failure here doesn't unwind the accept (the task is already accepted).
    try {
      const siblings = await taskRef
        .collection('offers')
        .where('state', '==', 'offered')
        .get();
      const batch = db.batch();
      for (const doc of siblings.docs) {
        if (doc.id === volunteerId) continue;
        batch.update(doc.ref, {
          state: 'superseded',
          respondedAt: FieldValue.serverTimestamp(),
        });
      }
      if (!siblings.empty) await batch.commit();
    } catch (err) {
      logger.warn('Failed to supersede sibling offers (non-fatal)', {
        taskId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    return { taskId, acceptedAt: acceptedAtMs };
  },
);
