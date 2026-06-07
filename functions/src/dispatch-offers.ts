// Firestore onCreate trigger on tasks/{taskId}.
// On a new searching task, score eligible volunteers and write per-volunteer
// offer documents at tasks/{taskId}/offers/{volunteerId}.
//
// Volunteers see their offers via a collection-group query (volunteerId ==
// uid AND state == 'offered'). The offer's denormalised taskTitle + customerId
// let the inbox render without a parent-task fetch per row.
//
// Idempotency: if the offers subcollection already has any document we
// skip. Re-running the same trigger (e.g. on emulator hot-reload) won't
// duplicate offers.

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { rankForTask, type TaskDoc } from './scoring';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';
const INITIAL_BATCH_SIZE = 10;

export const dispatchOffers = onDocumentCreated(
  { document: 'tasks/{taskId}', region: REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.warn('dispatchOffers fired without a document snapshot');
      return;
    }
    const taskId = event.params.taskId;
    const task = snap.data() as TaskDoc;
    if (task.status !== 'searching') {
      logger.info('dispatchOffers skipped — task not in searching state', {
        taskId,
        status: task.status,
      });
      return;
    }

    const db = getFirestore();
    const offersRef = db.collection('tasks').doc(taskId).collection('offers');

    const existing = await offersRef.limit(1).get();
    if (!existing.empty) {
      logger.info('dispatchOffers skipped — offers subcollection not empty', {
        taskId,
      });
      return;
    }

    const ranked = await rankForTask(task);
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
        customerId: task.customerId,
        taskTitle: task.title,
        taskCategory: task.category,
        taskRiskLevel: task.riskLevel,
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
