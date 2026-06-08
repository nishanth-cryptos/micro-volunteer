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
    if (!afterData) {
      // Document was deleted
      return;
    }
    const taskId = event.params.taskId;

    // We only proceed if:
    // 1. Task was newly created with status == 'searching'
    // OR
    // 2. Task status transitioned from another state back to 'searching'
    const wasCreatedSearching = !beforeData && afterData.status === 'searching';
    const transitionedToSearching = beforeData && beforeData.status !== 'searching' && afterData.status === 'searching';

    if (!wasCreatedSearching && !transitionedToSearching) {
      return;
    }

    const db = getFirestore();
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

    // If transitioned back to searching, clear existing offers first
    if (transitionedToSearching) {
      logger.info('dispatchOffers: clearing existing offers for reassignment', { taskId });
      const existingOffers = await offersRef.get();
      if (!existingOffers.empty) {
        const deleteBatch = db.batch();
        existingOffers.docs.forEach((doc) => deleteBatch.delete(doc.ref));
        await deleteBatch.commit();
      }
    } else {
      // For new tasks, verify subcollection is empty (idempotency check)
      const existing = await offersRef.limit(1).get();
      if (!existing.empty) {
        logger.info('dispatchOffers skipped — offers subcollection not empty', {
          taskId,
        });
        return;
      }
    }

    const ranked = await rankForTask(afterData);
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
