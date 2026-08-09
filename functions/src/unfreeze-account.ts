// HTTPS callable: unfreezeAccount
// Allows a user to acknowledge a warning freeze screen ("I understand") and resume normal app access.

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';

export const unfreezeAccount = onCall(
  { region: REGION },
  async (request): Promise<{ success: boolean }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const uid = request.auth.uid;
    const db = getFirestore();

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User not found.');
    }

    await userRef.update({
      freezeAcknowledgedAt: FieldValue.serverTimestamp(),
      frozenAt: FieldValue.delete(),
      frozenReason: FieldValue.delete(),
    });

    return { success: true };
  },
);
