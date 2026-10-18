// Firestore onCreate/onUpdate trigger on tasks/{taskId}.
// On a new searching task, or when a task goes back to searching status (reassignment),
// score eligible volunteers and write per-volunteer offer documents.
//
// Volunteers see their offers via a collection-group query (volunteerId ==
// uid AND state == 'offered').

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { rankForTask, type TaskDoc } from './scoring';
import { appendActivityLog, safeDisplayName } from './activity-log';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';
const INITIAL_BATCH_SIZE = 10;
export function computeDispatchExclusionsPure(
  task: { cancelledVolunteerIds?: string[] | undefined } | null | undefined,
  existingOffers: Array<{ id: string; state?: string | undefined }>,
): Set<string> {
  const excluded = new Set<string>();
  if (task && Array.isArray(task.cancelledVolunteerIds)) {
    for (const uid of task.cancelledVolunteerIds) {
      if (typeof uid === 'string' && uid.length > 0) {
        excluded.add(uid);
      }
    }
  }
  for (const offer of existingOffers) {
    if (
      offer.state === 'cancelled' ||
      offer.state === 'rejected' ||
      offer.state === 'offered' ||
      offer.state === 'accepted'
    ) {
      excluded.add(offer.id);
    }
  }
  return excluded;
}

export interface OpenTaskProjection {
  taskId: string;
  title: string;
  category: string;
  requiredSkills: string[];
  riskLevel: 'low' | 'medium';
  estimatedMinutes?: number | undefined;
  searchRadiusM: number;
  location: { h3Cell: string };
  status: 'searching';
  createdAt?: unknown;
  expiresAt?: unknown;
}

export function createOpenTaskProjectionPure(
  taskId: string,
  task: Partial<TaskDoc> & {
    estimatedMinutes?: number | undefined;
    createdAt?: unknown;
    expiresAt?: unknown;
  },
): OpenTaskProjection {
  return {
    taskId,
    title: task.title || '',
    category: task.category || '',
    requiredSkills: Array.isArray(task.requiredSkills) ? task.requiredSkills : [],
    riskLevel: task.riskLevel === 'medium' ? 'medium' : 'low',
    ...(typeof task.estimatedMinutes === 'number'
      ? { estimatedMinutes: task.estimatedMinutes }
      : {}),
    searchRadiusM:
      typeof task.searchRadiusM === 'number' ? task.searchRadiusM : 2000,
    location: {
      h3Cell: task.location?.h3Cell || '',
    },
    status: 'searching',
    ...(task.createdAt !== undefined ? { createdAt: task.createdAt } : {}),
    ...(task.expiresAt !== undefined ? { expiresAt: task.expiresAt } : {}),
  };
}

export const dispatchOffers = onDocumentWritten(
  { document: 'tasks/{taskId}', region: REGION },
  async (event) => {
    const change = event.data;
    if (!change) {
      logger.warn('dispatchOffers fired without a change object');
      return;
    }
    const beforeData = change.before?.data() as TaskDoc | undefined;
    const afterData = change.after?.data() as TaskDoc | undefined;
    const taskId = event.params.taskId;
    const db = getFirestore();

    // 1. Maintain openTasks discovery projection for volunteers.
    // Clean up projection if task is deleted or no longer searching.
    if (!afterData || afterData.status !== 'searching') {
      try {
        await db.collection('openTasks').doc(taskId).delete();
      } catch (err) {
        logger.warn('Failed to delete openTasks projection', { taskId, err });
      }
      if (!afterData) {
        // Document was deleted
        return;
      }
    } else if (afterData.status === 'searching') {
      try {
        const projection = createOpenTaskProjectionPure(taskId, afterData);
        await db.collection('openTasks').doc(taskId).set(projection);
      } catch (err) {
        logger.warn('Failed to upsert openTasks projection', { taskId, err });
      }
    }

    // We only proceed with matching dispatch if:
    // 1. Task was newly created with status == 'searching'
    // OR
    // 2. Task status transitioned from another state back to 'searching'
    const wasCreatedSearching = !beforeData && afterData.status === 'searching';
    const transitionedToSearching =
      beforeData &&
      beforeData.status !== 'searching' &&
      afterData.status === 'searching';

    if (!wasCreatedSearching && !transitionedToSearching) {
      return;
    }

    const offersRef = db.collection('tasks').doc(taskId).collection('offers');

    // Activity log: only on initial task creation, not on the
    // back-to-searching reassignment path (that already gets its own
    // 'reassigned' audit event on the task itself).
    if (wasCreatedSearching) {
      const customerName = await safeDisplayName(
        db,
        afterData.customerId,
        'A customer',
      );
      await appendActivityLog(db, {
        eventType: 'task_created',
        description: `${customerName} posted task '${afterData.title}'`,
        userId: afterData.customerId,
        taskId,
      });
    }


    // For new tasks, verify subcollection is empty (idempotency check).
    // If offers already exist on a newly created task, avoid duplicate dispatch.
    if (wasCreatedSearching) {
      const existing = await offersRef.limit(1).get();
      if (!existing.empty) {
        logger.info('dispatchOffers skipped — offers subcollection not empty', {
          taskId,
        });
        return;
      }
    }

    // Read existing offers without deleting them. This preserves audit history
    // and ensures volunteers who cancelled or rejected are excluded from reassignment.
    const existingOffersSnap = await offersRef.get();
    const existingOffers = existingOffersSnap.docs.map((d) => ({
      id: d.id,
      state: (d.data() as { state?: string }).state,
    }));

    const excludedUids = computeDispatchExclusionsPure(
      afterData,
      existingOffers,
    );

    const ranked = await rankForTask(afterData, excludedUids);
    const top = ranked.slice(0, INITIAL_BATCH_SIZE);
    if (top.length === 0) {
      logger.info('dispatchOffers: no eligible volunteers', { taskId });
      return;
    }

    const batch = db.batch();
    for (const v of top) {
      batch.set(offersRef.doc(v.uid), {
        volunteerId: v.uid,
        taskId,
        // Denormalised for the volunteer inbox so it can render without
        // looking up the parent task on every row.
        customerId: afterData.customerId,
        taskTitle: afterData.title,
        taskCategory: afterData.category,
        taskRiskLevel: afterData.riskLevel,
        // Denormalised volunteer profile so the customer's task detail
        // can render names + avatars without reading users/{uid}
        // (which is owner-scoped by rules).
        displayName: v.displayName,
        photoURL: v.photoURL,
        state: 'offered',
        score: v.score,
        scoreBreakdown: v.scoreBreakdown,
        distanceM: v.distanceM,
        offeredAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    logger.info('dispatchOffers wrote offers', {
      taskId,
      count: top.length,
    });
  },
);
