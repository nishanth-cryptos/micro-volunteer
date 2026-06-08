import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Checks if a user's account is currently suspended or banned.
 * Throws a permission-denied HttpsError if the user is suspended (and the suspension has not expired)
 * or banned.
 */
export async function checkActiveStatus(
  db: FirebaseFirestore.Firestore,
  userId: string,
): Promise<void> {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'User profile not found.');
  }

  const userData = userSnap.data() || {};
  const accountStatus = userData.accountStatus ?? 'active';

  if (accountStatus === 'banned') {
    throw new HttpsError(
      'permission-denied',
      'Your account has been permanently banned.',
    );
  }

  if (accountStatus === 'suspended') {
    const suspendedUntil = userData.suspendedUntil as Timestamp | undefined;
    if (suspendedUntil && suspendedUntil.toMillis() > Date.now()) {
      const dateStr = suspendedUntil.toDate().toLocaleDateString();
      throw new HttpsError(
        'permission-denied',
        `Your account is suspended until ${dateStr}.`,
      );
    }
  }
}
