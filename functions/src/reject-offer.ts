// HTTPS callable: a volunteer rejects a task offer.
// Simple update on tasks/{taskId}/offers/{volunteerId}.

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';

export const rejectOffer = onCall(
  { region: REGION },
  async (request): Promise<{ taskId: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const data = (request.data ?? {}) as { taskId?: unknown };
    const taskId = data.taskId;
    if (typeof taskId !== 'string' || taskId.length === 0) {
      throw new HttpsError('invalid-argument', 'taskId is required.');
    }
    const volunteerId = request.auth.uid;

    const db = getFirestore();
    const offerRef = db
      .collection('tasks')
      .doc(taskId)
      .collection('offers')
      .doc(volunteerId);

    const offerSnap = await offerRef.get();
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

    await offerRef.update({
      state: 'rejected',
      respondedAt: FieldValue.serverTimestamp(),
    });

    return { taskId };
  },
);
