import { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

// Saturation caps: a volunteer reaches the maximum contribution from these
// counters at TASK_SATURATION tasks / HOURS_SATURATION verified hours. Above
// that, the marginal benefit is zero. Without these caps, raw counts dominate
// the rawScore and every active volunteer pegs at 100 within a week.
const TASK_SATURATION = 20;
const HOURS_SATURATION = 40;

/**
 * Recomputes the trust score for a user (volunteer).
 *
 * Each component is normalised to [0,1] before applying its weight, so the
 * weighted sum stays in [0, 0.9]. Then we subtract penalties, clamp to
 * [0.3, 1.0], and store as 0-100.
 *
 *   rawScore = 0.35 * min(1, verifiedTaskCount / TASK_SATURATION)
 *            + 0.30 * scaledAvgRating
 *            + 0.15 * min(1, verifiedHours / HOURS_SATURATION)
 *            + 0.10 * (idVerified ? 1 : 0)
 *            - reportPenalty
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

  // No ratings yet → default scaledAvgRating to 1.0 so newcomers aren't
  // penalised on the rating component.
  const avgRating = ratedCount > 0 ? totalRating / ratedCount : 5.0;
  const scaledAvgRating = avgRating / 5.0;

  const taskNorm = Math.min(1, verifiedTaskCount / TASK_SATURATION);
  const hoursNorm = Math.min(1, verifiedHours / HOURS_SATURATION);

  const rawScore =
    0.35 * taskNorm +
    0.30 * scaledAvgRating +
    0.15 * hoursNorm +
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
