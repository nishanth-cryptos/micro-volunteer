// Scheduled re-dispatch + radius expansion for stale searching tasks.
// Implements the `expandRadius` slot called out in
// memory-bank/systemPatterns.md (Cloud Functions inventory).
//
// Runs every minute (minimum scheduler granularity on GCP). For each
// `tasks/{taskId}` still in `searching`:
//   - Skip if the task is fresher than INITIAL_GRACE_MS (the original
//     `dispatchOffers` may still be in flight or just landed).
//   - Skip if `lastRedispatchAt` is younger than REDISPATCH_INTERVAL_MS.
//   - Else: bump `searchRadiusM` by RADIUS_BUMP_M (capped MAX_RADIUS_M),
//     re-run rankForTask, and write offers for any newly-eligible
//     volunteers who don't already have an offer doc.
//
// Together with `onVolunteerAvailable` this closes the "missed the initial
// dispatch" gap from two directions: a volunteer becoming available + the
// passage of time bringing more volunteers into the expanded radius.

import { getApps, initializeApp } from 'firebase-admin/app';
import {
  FieldValue,
  getFirestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { rankForTask, type TaskDoc } from './scoring';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';
// Time the original dispatchOffers gets to land before we start poking
// the task. Avoids racing the onCreate trigger.
const INITIAL_GRACE_MS = 30 * 1000;
// Minimum gap between consecutive re-dispatches per task. ~60s matches
// the "60–90s" expand-radius cadence from systemPatterns.md.
const REDISPATCH_INTERVAL_MS = 60 * 1000;
// Radius growth per cycle and the hard ceiling (matches firestore.rules
// validator: searchRadiusM <= 10000).
const RADIUS_BUMP_M = 1000;
const MAX_RADIUS_M = 10000;
// Cap candidates written per task per cycle so a single sweep can't fan
// out to hundreds of writes.
const MAX_NEW_OFFERS_PER_TASK = 10;
// Per-sweep task cap. Searching tasks are expected to be small in the
// MVP; if this ever truncates, the next sweep one minute later picks up
// the rest.
const MAX_TASKS_PER_SWEEP = 100;

interface SearchingTask extends TaskDoc {
  createdAt?: Timestamp;
  lastRedispatchAt?: Timestamp;
}

export const periodicRedispatchOffers = onSchedule(
  { region: REGION, schedule: 'every 1 minutes' },
  async () => {
    const db = getFirestore();
    const now = Date.now();

    const tasksSnap = await db
      .collection('tasks')
      .where('status', '==', 'searching')
      .limit(MAX_TASKS_PER_SWEEP)
      .get();

    if (tasksSnap.empty) return;

    let processed = 0;
    let totalWrites = 0;

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data() as SearchingTask;
      const createdAtMs = task.createdAt?.toMillis();
      if (typeof createdAtMs === 'number' && now - createdAtMs < INITIAL_GRACE_MS) {
        continue; // brand new, let dispatchOffers settle first
      }
      const lastMs = task.lastRedispatchAt?.toMillis() ?? createdAtMs ?? 0;
      if (now - lastMs < REDISPATCH_INTERVAL_MS) continue;

      // Bump radius (idempotent at the ceiling).
      const nextRadius = Math.min(task.searchRadiusM + RADIUS_BUMP_M, MAX_RADIUS_M);
      const radiusBumped = nextRadius > task.searchRadiusM;

      // Existing offer recipients — skip them so we don't overwrite live
      // 'offered' / 'accepted' state with a fresh 'offered' doc.
      const offersSnap = await taskDoc.ref.collection('offers').get();
      const alreadyOffered = new Set(offersSnap.docs.map((d) => d.id));

      // Rank against the (possibly) expanded radius.
      const ranked = await rankForTask({ ...task, searchRadiusM: nextRadius });
      const newCandidates = ranked
        .filter((r) => !alreadyOffered.has(r.uid))
        .slice(0, MAX_NEW_OFFERS_PER_TASK);

      if (newCandidates.length === 0 && !radiusBumped) {
        // Still update lastRedispatchAt so we don't re-process this same
        // task on every cycle when there's nothing to add and nothing to
        // bump (radius already at ceiling).
        await taskDoc.ref.update({
          lastRedispatchAt: FieldValue.serverTimestamp(),
        });
        processed++;
        continue;
      }

      const batch = db.batch();
      const taskUpdate: Record<string, unknown> = {
        lastRedispatchAt: FieldValue.serverTimestamp(),
      };
      if (radiusBumped) {
        taskUpdate.searchRadiusM = nextRadius;
      }
      batch.update(taskDoc.ref, taskUpdate);

      for (const v of newCandidates) {
        const offerRef = taskDoc.ref.collection('offers').doc(v.uid);
        batch.set(offerRef, {
          volunteerId: v.uid,
          taskId: taskDoc.id,
          customerId: task.customerId,
          taskTitle: task.title,
          taskCategory: task.category,
          taskRiskLevel: task.riskLevel,
          displayName: v.displayName,
          photoURL: v.photoURL,
          state: 'offered',
          score: v.score,
          scoreBreakdown: v.scoreBreakdown,
          distanceM: v.distanceM,
          offeredAt: FieldValue.serverTimestamp(),
        });
      }

      // Audit event so the customer's task page reflects the expansion.
      if (radiusBumped) {
        const eventRef = taskDoc.ref.collection('events').doc();
        batch.set(eventRef, {
          type: 'radius_expanded',
          actorUid: 'system',
          at: FieldValue.serverTimestamp(),
          payload: {
            previousRadiusM: task.searchRadiusM,
            newRadiusM: nextRadius,
            newCandidates: newCandidates.length,
          },
        });
      }

      await batch.commit();
      processed++;
      totalWrites += newCandidates.length;
    }

    if (processed > 0) {
      logger.info('periodicRedispatchOffers swept', {
        processed,
        totalWrites,
      });
    }
  },
);
