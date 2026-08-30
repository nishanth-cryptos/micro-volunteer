import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { checkActiveStatus } from './moderation-helper';
import { appendActivityLog } from './activity-log';

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
      // Denormalise display name + photo for each side so the "Blocked users"
      // list can render without needing a privileged read on users/{otherUid}.
      const [userASnap, userBSnap] = await Promise.all([
        db.collection('users').doc(userA).get(),
        db.collection('users').doc(userB).get(),
      ]);
      const userAData = (userASnap.data() ?? {}) as {
        displayName?: string;
        photoURL?: string;
      };
      const userBData = (userBSnap.data() ?? {}) as {
        displayName?: string;
        photoURL?: string;
      };

      await blockRef.set({
        userA,
        userB,
        blockedBy: callerUid,
        userANameSnapshot: userAData.displayName ?? '',
        userAPhotoSnapshot: userAData.photoURL ?? null,
        userBNameSnapshot: userBData.displayName ?? '',
        userBPhotoSnapshot: userBData.photoURL ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Activity log only on actual new block. Names come from the
      // snapshots we just wrote — no UID leakage. Skip if a duplicate
      // block is being re-submitted (the `if (!blockSnap.exists)` gate).
      const initiatorName =
        (callerUid === userA
          ? userAData.displayName
          : userBData.displayName
        )?.trim() || 'A user';
      const blockedName =
        (callerUid === userA
          ? userBData.displayName
          : userAData.displayName
        )?.trim() || 'a user';
      await appendActivityLog(db, {
        eventType: 'user_blocked',
        description: `${initiatorName} blocked ${blockedName}`,
        userId: callerUid,
      });
    }

    return { blockId };
  },
);
