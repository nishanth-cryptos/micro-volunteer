// Shared abuse detection helper for cancellation and deletion flows.
// Governed by section 6 of implementation spec.

import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { appendActivityLog, safeDisplayName } from './activity-log';

export const VIOLATION_WINDOW_DAYS = 7;
export const VIOLATION_FREEZE_THRESHOLD = 3;

export type ViolationType =
  | 'volunteer_cancel_after_accept'
  | 'customer_task_delete';

export async function recordViolationAndCheckAbuse(
  db: Firestore,
  uid: string,
  violationType: ViolationType,
  taskId: string,
  reason: string,
): Promise<{ frozen: boolean; suspended: boolean }> {
  const userRef = db.collection('users').doc(uid);

  // 1. Record the violation in subcollection
  await userRef.collection('violations').add({
    type: violationType,
    taskId,
    reason,
    createdAt: FieldValue.serverTimestamp(),
  });

  // 2. Query count within rolling window
  const windowStartMs = Date.now() - VIOLATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const windowStart = Timestamp.fromMillis(windowStartMs);

  const violationsSnap = await userRef
    .collection('violations')
    .where('createdAt', '>=', windowStart)
    .get();

  const count = violationsSnap.size;

  if (count < VIOLATION_FREEZE_THRESHOLD) {
    return { frozen: false, suspended: false };
  }

  // 3. Fetch user status to determine escalation level
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return { frozen: false, suspended: false };
  }

  const userData = userSnap.data() as {
    accountStatus?: string;
    banned?: boolean;
    frozenAt?: Timestamp;
    freezeAcknowledgedAt?: Timestamp;
    warningStrikeCount?: number;
  };

  const isBanned = userData.accountStatus === 'banned' || userData.banned === true;
  const isSuspended = userData.accountStatus === 'suspended';
  if (isBanned || isSuspended) {
    return { frozen: false, suspended: isSuspended };
  }

  const strikeCount = userData.warningStrikeCount ?? 0;
  const userName = await safeDisplayName(db, uid, 'A user');

  if (strikeCount === 0) {
    // Strike 1: Warning-level freeze
    await userRef.update({
      frozenAt: FieldValue.serverTimestamp(),
      frozenReason: 'Unusual cancellation/deletion frequency detected.',
      warningStrikeCount: 1,
    });

    await appendActivityLog(db, {
      eventType: 'account_auto_frozen',
      description: `${userName}'s account was automatically frozen (Warning Strike 1)`,
      userId: uid,
      taskId,
    });

    return { frozen: true, suspended: false };
  }

  // Strike 2+: Formal System-actor 3-day suspension
  const suspendedUntil = Timestamp.fromMillis(
    Date.now() + 3 * 24 * 60 * 60 * 1000,
  );
  const reasonText = 'Repeated cancellation/deletion policy violations after warning.';

  const batch = db.batch();

  batch.update(userRef, {
    accountStatus: 'suspended',
    suspendedUntil,
    moderationReason: reasonText,
    frozenAt: FieldValue.delete(),
    frozenReason: FieldValue.delete(),
  });

  // Moderation log entry
  const logRef = userRef.collection('moderationLog').doc();
  batch.set(logRef, {
    action: 'suspend',
    reason: reasonText,
    adminId: 'System',
    timestamp: FieldValue.serverTimestamp(),
  });

  // Global admin action entry
  const adminActionRef = db.collection('adminActions').doc();
  batch.set(adminActionRef, {
    adminUid: 'System',
    targetUid: uid,
    action: 'suspend',
    reason: reasonText,
    relatedReportId: null,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: suspendedUntil,
  });

  await batch.commit();

  await appendActivityLog(db, {
    eventType: 'moderation_action',
    description: `System suspended ${userName} for 3 days (Repeated policy violations)`,
    userId: 'System',
    taskId,
  });

  return { frozen: false, suspended: true };
}
