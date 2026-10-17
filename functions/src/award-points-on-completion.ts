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

    const beforeData = change.before.data() as
      | { status?: string; pointsAwarded?: boolean }
      | undefined;
    const afterData = change.after.data() as
      | {
          status?: string;
          acceptedVolunteerId?: string;
          customerId?: string;
          estimatedMinutes?: number;
          requiredSkills?: string[];
          pointsAwarded?: boolean;
        }
      | undefined;

    if (!afterData) {
      logger.info('awardPointsOnCompletion: Task was deleted, skipping points');
      return;
    }

    // Trigger only when task flips to 'completed' and points have not already been marked awarded
    if (
      afterData.status !== 'completed' ||
      beforeData?.status === 'completed' ||
      afterData.pointsAwarded === true
    ) {
      return;
    }

    const taskId = event.params.taskId;
    const volunteerId = afterData.acceptedVolunteerId;
    const customerId = afterData.customerId;
    const estimatedMinutes = afterData.estimatedMinutes ?? 0;
    const requiredSkills = afterData.requiredSkills ?? [];

    if (!volunteerId || !customerId) {
      logger.error(
        'awardPointsOnCompletion: Missing volunteerId or customerId',
        {
          taskId,
          volunteerId,
          customerId,
        },
      );
      return;
    }

    const db = getFirestore();

    // Calculate points: base + 1 pt per 15 mins estimated, capped at 8
    const durationBonus = Math.min(
      MAX_DURATION_BONUS,
      Math.floor(estimatedMinutes / 15),
    );
    const volunteerPointsAwarded = BASE_VOLUNTEER_POINTS + durationBonus;

    logger.info('awardPointsOnCompletion: Preparing to award points', {
      taskId,
      volunteerId,
      customerId,
      estimatedMinutes,
      durationBonus,
      volunteerPoints: volunteerPointsAwarded,
      customerPoints: CUSTOMER_POINTS_REWARD,
    });

    const taskRef = db.collection('tasks').doc(taskId);
    const volunteerRef = db.collection('users').doc(volunteerId);
    const customerRef = db.collection('users').doc(customerId);

    // Prepare skill points increments
    const skillPointUpdate: Record<string, FieldValue> = {};
    for (const skill of requiredSkills) {
      skillPointUpdate[`skillPoints.${skill}`] = FieldValue.increment(1);
    }

    let alreadyAwarded = false;
    let shouldAwardCustomer = false;

    await db.runTransaction(async (transaction) => {
      // 1. READ PHASE — All reads must precede writes in a Firestore transaction
      const taskSnap = await transaction.get(taskRef);
      const volunteerSnap = await transaction.get(volunteerRef);
      const customerSnap = await transaction.get(customerRef);

      if (!taskSnap.exists) {
        logger.warn(`awardPointsOnCompletion: Task ${taskId} not found in transaction`);
        return;
      }

      const taskDoc = taskSnap.data() as {
        status?: string;
        pointsAwarded?: boolean;
      };

      // Idempotency guard: abort if already awarded or task not in completed status
      if (taskDoc.pointsAwarded === true || taskDoc.status !== 'completed') {
        alreadyAwarded = true;
        logger.info(`awardPointsOnCompletion: Task ${taskId} already awarded or not completed`, {
          pointsAwarded: taskDoc.pointsAwarded,
          status: taskDoc.status,
        });
        return;
      }

      if (!volunteerSnap.exists) {
        logger.error(
          `awardPointsOnCompletion: Volunteer ${volunteerId} not found`,
        );
        return;
      }

      if (customerSnap.exists) {
        const customerRoles = customerSnap.data()?.roles as
          | string[]
          | undefined;
        shouldAwardCustomer =
          customerRoles?.includes('volunteer') ?? false;
      }

      // 2. WRITE PHASE — Atomically commit task marker + user point updates
      transaction.update(taskRef, {
        pointsAwarded: true,
        pointsAwardedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(volunteerRef, {
        points: FieldValue.increment(volunteerPointsAwarded),
        verifiedTaskCount: FieldValue.increment(1),
        verifiedHours: FieldValue.increment(estimatedMinutes / 60),
        ...skillPointUpdate,
      });

      if (shouldAwardCustomer) {
        transaction.update(customerRef, {
          points: FieldValue.increment(CUSTOMER_POINTS_REWARD),
        });
      }
    });

    if (alreadyAwarded) {
      return;
    }

    logger.info('awardPointsOnCompletion: Points awarded successfully', {
      taskId,
      volunteerId,
      customerId,
      volunteerPointsAwarded,
      customerPointsAwarded: shouldAwardCustomer ? CUSTOMER_POINTS_REWARD : 0,
    });

    // Downstream follow-up tasks: audit logging + trust score recomputation.
    // Wrapped in try/catch so transient failures cannot crash the handler or cause duplicate retries.
    try {
      await writeAuditEvent(taskId, 'completed', volunteerId, {
        pointsAwarded: volunteerPointsAwarded,
        durationBonus,
        customerPointsAwarded: shouldAwardCustomer ? CUSTOMER_POINTS_REWARD : 0,
        skillsCredited: requiredSkills,
      });
    } catch (auditErr) {
      logger.warn('awardPointsOnCompletion: Failed to write audit event (non-fatal)', {
        taskId,
        err: auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    }

    try {
      await recomputeTrustScore(db, volunteerId);
    } catch (trustErr) {
      logger.error('awardPointsOnCompletion: Failed to recompute trust score (non-fatal)', {
        volunteerId,
        err: trustErr instanceof Error ? trustErr.message : String(trustErr),
      });
    }
  },
);

export function calculatePointsAwardPure(params: {
  estimatedMinutes?: number | undefined;
  customerRoles?: string[] | undefined;
  requiredSkills?: string[] | undefined;
}): {
  durationBonus: number;
  volunteerPointsAwarded: number;
  customerPointsAwarded: number;
  verifiedHoursIncrement: number;
  skillsCredited: string[];
} {
  const estimatedMinutes = Math.max(0, params.estimatedMinutes ?? 0);
  const requiredSkills = params.requiredSkills ?? [];
  const customerRoles = params.customerRoles ?? [];

  const durationBonus = Math.min(
    MAX_DURATION_BONUS,
    Math.floor(estimatedMinutes / 15),
  );
  const volunteerPointsAwarded = BASE_VOLUNTEER_POINTS + durationBonus;

  const customerIsVolunteer = customerRoles.includes('volunteer');
  const customerPointsAwarded = customerIsVolunteer
    ? CUSTOMER_POINTS_REWARD
    : 0;
  const verifiedHoursIncrement = estimatedMinutes / 60;

  return {
    durationBonus,
    volunteerPointsAwarded,
    customerPointsAwarded,
    verifiedHoursIncrement,
    skillsCredited: requiredSkills,
  };
}

export function evaluatePointsAwardTransactionPure(params: {
  task: { status?: string | undefined; pointsAwarded?: boolean | undefined };
  volunteerExists: boolean;
  customerRoles?: string[] | undefined;
  estimatedMinutes?: number | undefined;
  requiredSkills?: string[] | undefined;
}): {
  shouldAward: boolean;
  alreadyAwarded: boolean;
  taskUpdate?: { pointsAwarded: boolean };
  volunteerAward?: {
    points: number;
    verifiedTaskCount: number;
    verifiedHours: number;
    skillPoints: Record<string, number>;
  };
  customerPointsAwarded?: number;
} {
  const { task, volunteerExists, customerRoles, estimatedMinutes, requiredSkills } = params;

  if (task.pointsAwarded === true || task.status !== 'completed') {
    return {
      shouldAward: false,
      alreadyAwarded: task.pointsAwarded === true,
    };
  }

  if (!volunteerExists) {
    return {
      shouldAward: false,
      alreadyAwarded: false,
    };
  }

  const calculation = calculatePointsAwardPure({
    estimatedMinutes,
    customerRoles,
    requiredSkills,
  });

  const skillPoints: Record<string, number> = {};
  for (const skill of calculation.skillsCredited) {
    skillPoints[skill] = 1;
  }

  return {
    shouldAward: true,
    alreadyAwarded: false,
    taskUpdate: {
      pointsAwarded: true,
    },
    volunteerAward: {
      points: calculation.volunteerPointsAwarded,
      verifiedTaskCount: 1,
      verifiedHours: calculation.verifiedHoursIncrement,
      skillPoints,
    },
    customerPointsAwarded: calculation.customerPointsAwarded,
  };
}
