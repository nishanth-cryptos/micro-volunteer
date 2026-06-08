import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { checkActiveStatus } from './moderation-helper';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';

export const blockUser = onCall(
  { region: REGION },
  async (request): Promise<{ blockId: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const data = (request.data ?? {}) as {
      blockedUserId?: unknown;
    };

    const blockedUserId = data.blockedUserId;
    if (typeof blockedUserId !== 'string' || blockedUserId.length === 0) {
      throw new HttpsError('invalid-argument', 'blockedUserId is required.');
    }

    const callerUid = request.auth.uid;
    if (callerUid === blockedUserId) {
      throw new HttpsError('invalid-argument', 'You cannot block yourself.');
    }

    const db = getFirestore();
    await checkActiveStatus(db, callerUid);

    // Deterministic mutual block document ID: userA_userB where userA < userB
    const userA = callerUid < blockedUserId ? callerUid : blockedUserId;
    const userB = callerUid < blockedUserId ? blockedUserId : callerUid;
    const blockId = `${userA}_${userB}`;

    const blockRef = db.collection('blocks').doc(blockId);

    const blockSnap = await blockRef.get();
    if (!blockSnap.exists) {
      await blockRef.set({
        userA,
        userB,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return { blockId };
  },
);
