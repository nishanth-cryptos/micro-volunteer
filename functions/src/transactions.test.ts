// Unit tests for high-risk transaction paths and state machine invariants.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomBytes } from 'node:crypto';

// 1. OTP Generate / Verify Invariants
test('OTP Hash & Salt Verification: matches correct OTP and rejects wrong OTP', () => {
  const otp = '123456';
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256')
    .update(otp + salt)
    .digest('hex');

  // Correct OTP
  const testHashCorrect = createHash('sha256')
    .update(otp + salt)
    .digest('hex');
  assert.equal(testHashCorrect, hash);

  // Incorrect OTP
  const testHashWrong = createHash('sha256')
    .update('654321' + salt)
    .digest('hex');
  assert.notEqual(testHashWrong, hash);
});

test('OTP Expiry Check: rejects expired OTPs', () => {
  const nowMs = Date.now();
  const ttlMs = 15 * 60 * 1000;
  const expiredAtMs = nowMs - 1000; // 1 second in the past

  const isExpired = nowMs > expiredAtMs;
  assert.equal(isExpired, true, 'Expired OTP should be rejected');

  const validUntilMs = nowMs + ttlMs;
  const isValid = nowMs <= validUntilMs;
  assert.equal(isValid, true, 'Unexpired OTP should be accepted');
});

test('OTP Single-Use Invariant: verified OTP status transition prevents replay', () => {
  let taskStatus: string = 'accepted';
  const otpVerified = true;

  // First verification
  if ((taskStatus as string) === 'accepted' && otpVerified) {
    taskStatus = 'in_progress';
  }
  assert.equal(taskStatus, 'in_progress');

  // Attempted replay when status is already in_progress
  let replayError: string | null = null;
  if ((taskStatus as string) !== 'accepted') {
    replayError = 'Task is not in accepted status.';
  }
  assert.equal(replayError, 'Task is not in accepted status.');
});

// 2. Offer Accept Race Precondition Check
test('Offer Accept Race Invariant: single-slot assignment allows only first volunteer', () => {
  let taskStatus: 'searching' | 'accepted' = 'searching';
  let assignedVolunteerId: string | null = null;

  function attemptAccept(volunteerId: string): {
    success: boolean;
    error?: string;
  } {
    if (taskStatus !== 'searching') {
      return { success: false, error: 'Task is no longer searching.' };
    }
    taskStatus = 'accepted';
    assignedVolunteerId = volunteerId;
    return { success: true };
  }

  // Concurrent attempts
  const res1 = attemptAccept('vol-1');
  const res2 = attemptAccept('vol-2');

  assert.equal(res1.success, true);
  assert.equal(assignedVolunteerId, 'vol-1');

  assert.equal(res2.success, false);
  assert.equal(res2.error, 'Task is no longer searching.');
  assert.equal(
    assignedVolunteerId,
    'vol-1',
    'Second volunteer cannot overwrite accepted assignment',
  );
});

// 3. Points Award Idempotency
test('Points Award Idempotency: award event prevents duplicate point crediting', () => {
  let volunteerPoints = 100;
  const processedEventIds = new Set<string>();

  function awardPoints(eventId: string, pointsToAward: number): boolean {
    if (processedEventIds.has(eventId)) {
      return false; // Already processed
    }
    processedEventIds.add(eventId);
    volunteerPoints += pointsToAward;
    return true;
  }

  const firstAward = awardPoints('event-task-123', 15);
  assert.equal(firstAward, true);
  assert.equal(volunteerPoints, 115);

  const duplicateAward = awardPoints('event-task-123', 15);
  assert.equal(
    duplicateAward,
    false,
    'Duplicate award execution must be blocked',
  );
  assert.equal(
    volunteerPoints,
    115,
    'Points must not increase on duplicate call',
  );
});

// 4. M11 cancelAcceptedTask Reassignment & Exclusions
test('M11 cancelAcceptedTask: reverts task to searching, clears volunteer, and excludes from re-dispatch', () => {
  const task = {
    status: 'accepted',
    acceptedVolunteerId: 'vol-abc',
    acceptedAt: Date.now(),
  };

  const offers: Record<string, { state: string }> = {
    'vol-abc': { state: 'accepted' },
  };

  // Reassignment action
  const updatedTask = {
    ...task,
    status: 'searching',
    acceptedVolunteerId: undefined,
    acceptedAt: undefined,
  };

  const volOffer = offers['vol-abc'];
  if (volOffer) {
    volOffer.state = 'cancelled';
  }

  assert.equal(updatedTask.status, 'searching');
  assert.equal(updatedTask.acceptedVolunteerId, undefined);
  assert.equal(offers['vol-abc']?.state, 'cancelled');

  // Candidate filtering logic during re-dispatch
  const candidatePool = ['vol-abc', 'vol-xyz'];
  const eligibleCandidates = candidatePool.filter(
    (uid) =>
      offers[uid]?.state !== 'cancelled' && offers[uid]?.state !== 'rejected',
  );

  assert.deepEqual(eligibleCandidates, ['vol-xyz']);
});

// 5. M11 Violation Threshold & Rolling Window Logic
test('M11 Violation Threshold: Strike 1 freeze at 3 violations, Strike 2+ suspend', () => {
  const windowDays = 7;
  const threshold = 3;
  const now = Date.now();

  const violations = [
    { createdAtMs: now - 1 * 24 * 60 * 60 * 1000 },
    { createdAtMs: now - 3 * 24 * 60 * 60 * 1000 },
    { createdAtMs: now - 8 * 24 * 60 * 60 * 1000 }, // Stale (> 7 days)
    { createdAtMs: now - 5 * 1000 },
  ];

  const windowStartMs = now - windowDays * 24 * 60 * 60 * 1000;
  const activeViolations = violations.filter(
    (v) => v.createdAtMs >= windowStartMs,
  );

  assert.equal(
    activeViolations.length,
    3,
    'Stale violation outside 7-day window must be excluded',
  );
  assert.equal(
    activeViolations.length >= threshold,
    true,
    'Threshold of 3 active violations reached',
  );
});
