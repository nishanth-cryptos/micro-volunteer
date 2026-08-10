// Scheduled function: activateScheduledTasks
// Checks for tasks in status 'scheduled' whose target scheduledFor time has arrived.
// Flips status to 'searching', sets activatedAt, waitStartedAt, and nextCheckAt,
// which automatically triggers dispatchOffers (onDocumentWritten) to match volunteers.

import { getApps, initializeApp } from 'firebase-admin/app';
import {
  FieldValue,
  getFirestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';
const MAX_TASKS_PER_SWEEP = 100;
const REDISPATCH_INTERVAL_MS = 60 * 1000;

export const SCHEDULING_CONFIG = {
  minLeadTimeMinutes: 30,
  maxHorizonDays: 7,
} as const;

export const activateScheduledTasks = onSchedule(
  { region: REGION, schedule: 'every 1 minutes' },
  async () => {
    const db = getFirestore();
    const now = Date.now();
    const nowTimestamp = Timestamp.fromMillis(now);

    const scheduledSnap = await db
      .collection('tasks')
      .where('status', '==', 'scheduled')
      .where('scheduledFor', '<=', nowTimestamp)
      .limit(MAX_TASKS_PER_SWEEP)
      .get();

    if (scheduledSnap.empty) return;

    let activatedCount = 0;

    for (const taskDoc of scheduledSnap.docs) {
      try {
        const taskRef = taskDoc.ref;
        const nextCheckAt = Timestamp.fromMillis(now + REDISPATCH_INTERVAL_MS);

        await db.runTransaction(async (transaction) => {
          const snap = await transaction.get(taskRef);
          if (!snap.exists) return;

          const data = snap.data() as { status?: string };
          if (data.status !== 'scheduled') return; // Guard against concurrent status changes

          transaction.update(taskRef, {
            status: 'searching',
            activatedAt: FieldValue.serverTimestamp(),
            waitStartedAt: FieldValue.serverTimestamp(),
            nextCheckAt,
          });

          // Log activation event on the task
          const eventRef = taskRef.collection('events').doc();
          transaction.set(eventRef, {
            type: 'scheduled_task_activated',
            actorUid: 'system',
            at: FieldValue.serverTimestamp(),
          });
        });

        activatedCount++;
      } catch (err) {
        logger.error('Failed to activate scheduled task', {
          taskId: taskDoc.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (activatedCount > 0) {
      logger.info('activateScheduledTasks completed', { activatedCount });
    }
  },
);
