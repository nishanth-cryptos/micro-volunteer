// Scheduled cleanup: permanently delete users who have been banned for
// more than BAN_PURGE_THRESHOLD_MS. Runs once a day.
//
// Scope (locked in with Nishanth 2026-06-08):
//   - Firebase Auth account (auth.deleteUser)
//   - Storage files (/users/{uid}/photo, /users/{uid}/id-image)
//   - Firestore users/{uid} doc + subcollections (moderationLog,
//     deviceTokens, notifications) via recursiveDelete
//
// Explicitly NOT deleted (preserve immutable audit trail):
//   - Their tasks, including /events subcollections
//   - Reports filed by or against them
//   - blocks/{id} documents
//   - adminActions/{id} entries
//
// Dangling UID refs on tasks/offers/events/reports/blocks are tolerated by
// the UI (name resolvers render a fallback when users/{uid} is missing).

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';
const BAN_PURGE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const scheduledPurgeBannedUsers = onSchedule(
  { region: REGION, schedule: 'every 24 hours' },
  async () => {
    const db = getFirestore();
    const auth = getAuth();
    const bucket = getStorage().bucket();

    // Banned users are expected to be a small set; we filter bannedAt in
    // memory to avoid a composite index. If the banned cohort ever grows
    // large, add (accountStatus ASC, bannedAt ASC) to firestore.indexes.
    const bannedSnap = await db
      .collection('users')
      .where('accountStatus', '==', 'banned')
      .get();

    const cutoffMs = Date.now() - BAN_PURGE_THRESHOLD_MS;
    const purgeTargets = bannedSnap.docs.filter((d) => {
      const bannedAt = (d.data().bannedAt as Timestamp | undefined)?.toMillis();
      return typeof bannedAt === 'number' && bannedAt < cutoffMs;
    });

    if (purgeTargets.length === 0) {
      logger.info('scheduledPurgeBannedUsers: nothing to purge');
      return;
    }

    logger.info('scheduledPurgeBannedUsers: purging', {
      count: purgeTargets.length,
    });

    for (const doc of purgeTargets) {
      const uid = doc.id;
      try {
        // Storage: best-effort. Files may not exist (no upload during
        // onboarding) — swallow not-found per-file.
        await Promise.all(
          [`users/${uid}/photo`, `users/${uid}/id-image`].map(async (path) => {
            try {
              await bucket.file(path).delete();
            } catch (err) {
              const code =
                err && typeof err === 'object' && 'code' in err
                  ? (err as { code?: number }).code
                  : undefined;
              if (code !== 404) {
                logger.warn('purge: storage delete failed', { uid, path, err });
              }
            }
          }),
        );

        // Auth: best-effort. If the user was already removed from Auth
        // out-of-band, continue to wipe their Firestore residue.
        try {
          await auth.deleteUser(uid);
        } catch (err) {
          const code =
            err && typeof err === 'object' && 'code' in err
              ? (err as { code?: string }).code
              : undefined;
          if (code !== 'auth/user-not-found') {
            logger.warn('purge: auth delete failed', { uid, err });
          }
        }

        // Firestore: user doc + all subcollections (moderationLog,
        // deviceTokens, notifications).
        await db.recursiveDelete(doc.ref);

        logger.info('purge: user removed', { uid });
      } catch (err) {
        // Per-user failure shouldn't abort the whole sweep — log and move
        // on. The next daily run will retry.
        logger.error('purge: failed for user', { uid, err });
      }
    }
  },
);
