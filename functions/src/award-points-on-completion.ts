import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { writeAuditEvent } from './audit';
import { recomputeTrustScore } from './recompute-trust-score';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';
const BASE_VOLUNTEER_POINTS = 10;
const CUSTOMER_POINTS_REWARD = 2;
const MAX_DURATION_BONUS = 8; // Capped at +8 pts (proportional to 15-min blocks up to 2 hours)

export const awardPointsOnCompletion = onDocumentUpdated(
  { document: 'tasks/{taskId}', region: REGION },
  async (event) => {
    const change = event.data;
    if (!change) {
      logger.warn('awardPointsOnCompletion: Fired without data');
      return;
    }

    const beforeData = change.before.data() as { status?: string } | undefined;
    const afterData = change.after.data() as {
      status?: string;
      acceptedVolunteerId?: string;
      customerId?: string;
      estimatedMinutes?: number;
      requiredSkills?: string[];
    } | undefined;

    if (!afterData) {
      logger.info('awardPointsOnCompletion: Task was deleted, skipping points');
      return;
    }

    // Trigger only when task flips to 'completed'
    if (afterData.status !== 'completed' || beforeData?.status === 'completed') {
      return;
    }

    const taskId = event.params.taskId;
    const volunteerId = afterData.acceptedVolunteerId;
    const customerId = afterData.customerId;
    const estimatedMinutes = afterData.estimatedMinutes ?? 0;
    const requiredSkills = afterData.requiredSkills ?? [];

    if (!volunteerId || !customerId) {
      logger.error('awardPointsOnCompletion: Missing volunteerId or customerId', {
        taskId,
        volunteerId,
        customerId,
      });
      return;
    }

    const db = getFirestore();

    // Calculate points: base + 1 pt per 15 mins estimated, capped at 8
    const durationBonus = Math.min(
      MAX_DURATION_BONUS,
      Math.floor(estimatedMinutes / 15),
    );
    const volunteerPointsAwarded = BASE_VOLUNTEER_POINTS + durationBonus;

    logger.info('awardPointsOnCompletion: Awarding points', {
      taskId,
      volunteerId,
      customerId,
      estimatedMinutes,
      durationBonus,
      volunteerPoints: volunteerPointsAwarded,
      customerPoints: CUSTOMER_POINTS_REWARD,
    });

    const volunteerRef = db.collection('users').doc(volunteerId);
    const customerRef = db.collection('users').doc(customerId);

    // Prepare skill points increments
    const skillPointUpdate: Record<string, FieldValue> = {};
    for (const skill of requiredSkills) {
      skillPointUpdate[`skillPoints.${skill}`] = FieldValue.increment(1);
    }

    let shouldAwardCustomer = false;

    await db.runTransaction(async (transaction) => {
      const volunteerSnap = await transaction.get(volunteerRef);
      const customerSnap = await transaction.get(customerRef);

      if (!volunteerSnap.exists) {
        logger.error(`awardPointsOnCompletion: Volunteer ${volunteerId} not found`);
        return;
      }

      transaction.update(volunteerRef, {
        points: FieldValue.increment(volunteerPointsAwarded),
        verifiedTaskCount: FieldValue.increment(1),
        verifiedHours: FieldValue.increment(estimatedMinutes / 60),
        ...skillPointUpdate,
      });

      if (customerSnap.exists) {
        const customerRoles = customerSnap.data()?.roles as string[] | undefined;
        const customerIsVolunteer = customerRoles?.includes('volunteer') ?? false;
        if (customerIsVolunteer) {
          transaction.update(customerRef, {
            points: FieldValue.increment(CUSTOMER_POINTS_REWARD),
          });
          shouldAwardCustomer = true;
        }
      }
    });

    // Log the award event in the audit trail
    await writeAuditEvent(taskId, 'completed', volunteerId, {
      pointsAwarded: volunteerPointsAwarded,
      durationBonus,
      customerPointsAwarded: shouldAwardCustomer ? CUSTOMER_POINTS_REWARD : 0,
      skillsCredited: requiredSkills,
    });

    // Recompute trust score for the volunteer
    await recomputeTrustScore(db, volunteerId);
  },
);
