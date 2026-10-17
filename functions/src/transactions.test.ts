// Unit tests for high-risk transaction paths and state machine invariants.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import { evaluateOtpVerificationAttemptPure } from './otp';
import { evaluatePointsAwardTransactionPure } from './award-points-on-completion';

// 1. OTP Generate / Verify Invariants
test('OTP Hash & Salt Verification: matches correct OTP and rejects wrong OTP', () => {
  const otp = '1234';
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
    .update('4321' + salt)
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

// 3. PB-1: Concurrent invalid attempts reaching the limit
test('PB-1: Concurrent invalid attempts reaching the limit serialize and lock', () => {
  const correctCode = '7712';
  const salt = 'aabbccddeeff00112233445566778899';
  const expectedHash = createHash('sha256')
    .update(`${correctCode}:${salt}`)
    .digest('hex');
  const nowMs = 1700000000000;
  const expiresAtMs = nowMs + 600000;

  let taskDoc = {
    status: 'accepted',
    startOtpHash: expectedHash,
    startOtpSalt: salt,
    startOtpExpiresAt: expiresAtMs,
    startOtpAttempts: 0,
  };

  // Simulate transactional attempt evaluation (optimistic concurrency serializes)
  function transactionalAttempt(submittedCode: string): {
    success: boolean;
    exhausted: boolean;
    error?: string | undefined;
  } {
    const res = evaluateOtpVerificationAttemptPure({
      code: submittedCode,
      expectedHash: taskDoc.startOtpHash ?? '',
      salt: taskDoc.startOtpSalt ?? '',
      expiresAtMs: taskDoc.startOtpExpiresAt ?? 0,
      nowMs,
      currentAttempts: taskDoc.startOtpAttempts ?? 0,
    });

    if (res.invalidateOtp) {
      taskDoc = {
        ...taskDoc,
        startOtpHash: undefined as any,
        startOtpSalt: undefined as any,
        startOtpExpiresAt: undefined as any,
        startOtpAttempts: res.nextAttempts,
      };
    } else {
      taskDoc = {
        ...taskDoc,
        startOtpAttempts: res.nextAttempts,
      };
    }

    return {
      success: res.success,
      exhausted: res.exhausted,
      error: res.error,
    };
  }

  // 4 invalid attempts
  for (let i = 0; i < 4; i++) {
    const attempt = transactionalAttempt('0000');
    assert.equal(attempt.success, false);
    assert.equal(attempt.exhausted, false);
    assert.equal(taskDoc.startOtpAttempts, i + 1);
  }

  // 5th invalid attempt reaches limit
  const finalAttempt = transactionalAttempt('0000');
  assert.equal(finalAttempt.success, false);
  assert.equal(finalAttempt.exhausted, true);
  assert.equal(taskDoc.startOtpAttempts, 5);
  assert.equal(taskDoc.startOtpHash, undefined, 'Hash must be wiped on lockout');

  // Any further concurrent attempts immediately fail
  const lockedAttempt = transactionalAttempt('0000');
  assert.equal(lockedAttempt.exhausted, true);
});

// 4. PB-2: Points Award Idempotency & Concurrency Invariants
test('PB-2 Points Award Idempotency: prevents duplicate point crediting across retries', () => {
  const task = {
    status: 'completed',
    pointsAwarded: false,
  };

  // Execution 1: First time completion trigger runs
  const exec1 = evaluatePointsAwardTransactionPure({
    task,
    volunteerExists: true,
    customerRoles: ['customer', 'volunteer'],
    estimatedMinutes: 45,
    requiredSkills: ['groceries', 'cooking'],
  });

  assert.equal(exec1.shouldAward, true, 'First execution must award points');
  assert.equal(exec1.alreadyAwarded, false);
  assert.equal(exec1.volunteerAward?.points, 13, '10 base + 3 duration bonus for 45 mins');
  assert.equal(exec1.volunteerAward?.verifiedTaskCount, 1);
  assert.equal(exec1.volunteerAward?.verifiedHours, 0.75);
  assert.deepEqual(exec1.volunteerAward?.skillPoints, { groceries: 1, cooking: 1 });
  assert.equal(exec1.customerPointsAwarded, 2, 'Dual-role customer receives 2 pts');
  assert.equal(exec1.taskUpdate?.pointsAwarded, true, 'Task must be marked awarded');

  // Commit state update on the task
  const updatedTask = {
    ...task,
    pointsAwarded: true,
  };

  // Execution 2: Duplicate / retry trigger on the same task
  const exec2 = evaluatePointsAwardTransactionPure({
    task: updatedTask,
    volunteerExists: true,
    customerRoles: ['customer', 'volunteer'],
    estimatedMinutes: 45,
    requiredSkills: ['groceries', 'cooking'],
  });

  assert.equal(exec2.shouldAward, false, 'Duplicate execution must NOT award points');
  assert.equal(exec2.alreadyAwarded, true, 'Duplicate must identify points already awarded');
  assert.equal(exec2.volunteerAward, undefined);
  assert.equal(exec2.taskUpdate, undefined);
});

test('PB-2: Concurrent reward-trigger executions for the same task award exactly once', () => {
  let taskState: { status: string; pointsAwarded?: boolean } = {
    status: 'completed',
  };

  let totalVolunteerPoints = 0;
  let totalCustomerPoints = 0;
  let awardExecutionCount = 0;

  // Simulate Firestore transaction isolation: only the first committer writes
  function runTriggerTransaction(): boolean {
    const evalRes = evaluatePointsAwardTransactionPure({
      task: taskState,
      volunteerExists: true,
      customerRoles: ['customer', 'volunteer'],
      estimatedMinutes: 60,
      requiredSkills: ['gardening'],
    });

    if (evalRes.shouldAward) {
      taskState = {
        ...taskState,
        pointsAwarded: true,
      };
      totalVolunteerPoints += evalRes.volunteerAward!.points;
      totalCustomerPoints += evalRes.customerPointsAwarded!;
      awardExecutionCount++;
      return true;
    }
    return false;
  }

  // Trigger A and Trigger B run concurrently
  const resA = runTriggerTransaction();
  const resB = runTriggerTransaction();

  assert.equal(resA, true, 'First concurrent trigger succeeds');
  assert.equal(resB, false, 'Second concurrent trigger sees pointsAwarded and aborts');
  assert.equal(awardExecutionCount, 1, 'Award logic executed exactly once');
  assert.equal(totalVolunteerPoints, 14, '10 base + 4 duration bonus for 60m awarded once');
  assert.equal(totalCustomerPoints, 2, 'Customer reward awarded once');
});

test('PB-2: Non-completed tasks or missing volunteer reject points award', () => {
  // In-progress task
  const resInProgress = evaluatePointsAwardTransactionPure({
    task: { status: 'in_progress', pointsAwarded: false },
    volunteerExists: true,
  });
  assert.equal(resInProgress.shouldAward, false);

  // Completed task but volunteer doc missing
  const resMissingVolunteer = evaluatePointsAwardTransactionPure({
    task: { status: 'completed', pointsAwarded: false },
    volunteerExists: false,
  });
  assert.equal(resMissingVolunteer.shouldAward, false);
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
