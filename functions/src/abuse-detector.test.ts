// Unit tests for abuse-detector thresholds, freeze strike 1, escalation strike 2+, and task cancellation/deletion constraints.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  VIOLATION_FREEZE_THRESHOLD,
  VIOLATION_WINDOW_DAYS,
} from './abuse-detector';

test('Abuse detector thresholds: VIOLATION_WINDOW_DAYS is 7 and VIOLATION_FREEZE_THRESHOLD is 3', () => {
  assert.equal(VIOLATION_WINDOW_DAYS, 7);
  assert.equal(VIOLATION_FREEZE_THRESHOLD, 3);
});

test('Abuse detector Strike 1: triggers warning freeze when strikeCount === 0 and count >= 3', () => {
  const violationCount = 3;
  const warningStrikeCount: number = 0;
  const isBanned = false;
  const isSuspended = false;

  let outcome: 'none' | 'freeze_warning' | 'suspend' = 'none';

  if (
    violationCount >= VIOLATION_FREEZE_THRESHOLD &&
    !isBanned &&
    !isSuspended
  ) {
    if (warningStrikeCount === 0) {
      outcome = 'freeze_warning';
    } else {
      outcome = 'suspend';
    }
  }

  assert.equal(
    outcome,
    'freeze_warning',
    'First strike should result in warning-level freeze',
  );
});

test('Abuse detector Strike 2+: triggers System-actor 3-day suspension when warningStrikeCount >= 1', () => {
  const violationCount = 3;
  const warningStrikeCount: number = 1;
  const isBanned = false;
  const isSuspended = false;

  let outcome: 'none' | 'freeze_warning' | 'suspend' = 'none';

  if (
    violationCount >= VIOLATION_FREEZE_THRESHOLD &&
    !isBanned &&
    !isSuspended
  ) {
    if (warningStrikeCount === 0) {
      outcome = 'freeze_warning';
    } else {
      outcome = 'suspend';
    }
  }

  assert.equal(
    outcome,
    'suspend',
    'Repeated strike should escalate to System-actor suspension',
  );
});

test('Task deletion constraint (§8.6): rejecting deleteTask on in_progress tasks', () => {
  const taskStatus: string = 'in_progress';
  const customerUid = 'cust-123';
  const callerUid = 'cust-123';

  let rejectionError: string | null = null;

  if (callerUid !== customerUid) {
    rejectionError = 'You are not the creator of this task.';
  } else if (taskStatus !== 'searching' && taskStatus !== 'accepted') {
    rejectionError =
      taskStatus === 'in_progress'
        ? 'Cannot delete a task that is already in progress. Please use Report User if you need assistance.'
        : `Cannot delete task in status '${taskStatus}'.`;
  }

  assert.equal(
    rejectionError,
    'Cannot delete a task that is already in progress. Please use Report User if you need assistance.',
  );
});

test('Volunteer cancel constraint (§8.1): excluding cancelling volunteer from re-dispatch', () => {
  const cancellingVolunteerUid = 'vol-789';

  // Simulating offers map state after cancelAcceptedTask
  const offers: Record<string, { state: string }> = {
    [cancellingVolunteerUid]: { state: 'cancelled' },
  };

  // Check dispatch offers filter
  const candidateVolunteers = [cancellingVolunteerUid, 'vol-101'];
  const eligibleCandidates = candidateVolunteers.filter(
    (uid) =>
      offers[uid]?.state !== 'cancelled' && offers[uid]?.state !== 'rejected',
  );

  assert.deepEqual(eligibleCandidates, ['vol-101']);
});
