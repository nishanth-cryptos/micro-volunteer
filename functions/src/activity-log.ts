// Shared writer for the top-level `activityLog/{id}` collection.
//
// activityLog is the site-wide reverse-chronological audit feed surfaced
// in the admin dashboard's "Activity Log" tab. Append-only, admin read,
// server-only writes (enforced in firestore.rules).
//
// Governed by memory-bank/systemPatterns.md (collection inventory).
//
// Descriptions are denormalised at write time — they should never contain
// raw UIDs since the admin UI explicitly refuses to render them. Every
// caller is expected to substitute display names / role labels into the
// description string before calling appendActivityLog.

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

export type ActivityEventType =
  | 'user_registered'
  | 'task_created'
  | 'task_accepted'
  | 'task_started'
  | 'task_completed'
  | 'report_submitted'
  | 'moderation_action'
  | 'user_blocked'
  | 'user_unblocked';

export interface ActivityLogEntry {
  eventType: ActivityEventType;
  description: string;
  // Primary actor for this event (e.g. customer for task_created,
  // volunteer for task_accepted, admin for moderation_action).
  userId: string;
  taskId?: string;
}

export async function appendActivityLog(
  db: Firestore,
  entry: ActivityLogEntry,
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      eventType: entry.eventType,
      description: entry.description,
      userId: entry.userId,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (entry.taskId) payload.taskId = entry.taskId;
    await db.collection('activityLog').add(payload);
  } catch (err) {
    // Log + swallow. activityLog is an observability surface — if it
    // fails the parent action (accept / verify / moderate / etc.) must
    // still succeed.
    logger.warn('appendActivityLog failed', {
      eventType: entry.eventType,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// Convenience for "look up a display name without bringing down the whole
// callable on a missing doc". Returns a safe fallback string the caller
// can drop into a description template.
export async function safeDisplayName(
  db: Firestore,
  uid: string,
  fallback = 'a user',
): Promise<string> {
  try {
    const snap = await db.collection('users').doc(uid).get();
    const data = snap.exists ? (snap.data() as { displayName?: string }) : null;
    return data?.displayName?.trim() || fallback;
  } catch {
    return fallback;
  }
}
