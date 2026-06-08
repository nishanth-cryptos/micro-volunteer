import { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

/**
 * Recomputes the trust score for a user (volunteer) based on the formula:
 * trustScore = (verifiedTaskCount * 0.35)
 *            + (avgRating * 0.30)           // avgRating 0-5, scaled to 0-1 internally
 *            + (verifiedHours * 0.15)
 *            + (idVerified ? 0.10 : 0)
 *            + (reportPenalty * -1)
 *
 * Clamped to [0.3, 1.0] as floor/ceiling, and stored in user doc as 0-100.
 */
export async function recomputeTrustScore(
  db: Firestore,
  userId: string,
): Promise<number> {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    logger.error(`recomputeTrustScore: User ${userId} not found`);
    return 30; // default base score
  }

  const userData = userSnap.data() || {};
  const idVerified = userData.idVerified === true;
  const verifiedTaskCount = userData.verifiedTaskCount ?? 0;
  const verifiedHours = userData.verifiedHours ?? 0;
  const reportPenalty = userData.reportPenalty ?? 0;

  // Query all completed tasks by this volunteer with a customerRating
  const tasksSnap = await db
    .collection('tasks')
    .where('acceptedVolunteerId', '==', userId)
    .where('status', '==', 'completed')
    .get();

  let totalRating = 0;
  let ratedCount = 0;

  tasksSnap.forEach((doc) => {
    const data = doc.data();
    if (typeof data.customerRating === 'number') {
      totalRating += data.customerRating;
      ratedCount++;
    }
  });

  // If no ratings exist yet, default to 5.0 (perfect) so they aren't penalized
  const avgRating = ratedCount > 0 ? totalRating / ratedCount : 5.0;
  const scaledAvgRating = avgRating / 5.0; // scales 0-5 to 0-1

  const rawScore =
    verifiedTaskCount * 0.35 +
    scaledAvgRating * 0.30 +
    verifiedHours * 0.15 +
    (idVerified ? 0.10 : 0) -
    reportPenalty;

  // Floor of 0.3 (base score), ceiling of 1.0
  const clampedScore = Math.max(0.3, Math.min(1.0, rawScore));
  const trustScore = Math.round(clampedScore * 100);

  await userRef.update({ trustScore });

  logger.info(`recomputeTrustScore: User ${userId} trust score updated`, {
    userId,
    verifiedTaskCount,
    verifiedHours,
    avgRating,
    idVerified,
    reportPenalty,
    rawScore,
    clampedScore,
    trustScore,
  });

  return trustScore;
}
