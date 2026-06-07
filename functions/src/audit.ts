// Append-only task audit trail.
// Each event is one doc under tasks/{taskId}/events/{auto-id}.
// Clients have no write path (Firestore rules deny); Cloud Functions
// write via Admin SDK which bypasses rules.

import { FieldValue, getFirestore } from 'firebase-admin/firestore';

export type AuditEventType =
  | 'created'
  | 'offered_batch'
  | 'accepted'
  | 'rejected'
  | 'start_otp_generated'
  | 'started'
  | 'end_otp_generated'
  | 'completed'
  | 'rated'
  | 'cancelled'
  | 'expired'
  | 'reported'
  | 'radius_expanded';

export async function writeAuditEvent(
  taskId: string,
  type: AuditEventType,
  actorUid: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const db = getFirestore();
  await db
    .collection('tasks')
    .doc(taskId)
    .collection('events')
    .add({
      type,
      actorUid,
      payload,
      at: FieldValue.serverTimestamp(),
    });
}
