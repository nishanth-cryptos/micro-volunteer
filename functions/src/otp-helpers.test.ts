// Unit tests for OTP hash generation, salt uniqueness, constant-time comparison, and TTL.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  generateOtpCode,
  generateSalt,
  hashOtp,
  constantTimeEquals,
  OTP_TTL_MS,
  MAX_OTP_ATTEMPTS,
  evaluateOtpVerificationAttemptPure,
} from './otp';

test('OTP Code Generation: produces 4-digit zero-padded string', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateOtpCode();
    assert.equal(code.length, 4, 'OTP code must be 4 digits long');
    assert.match(code, /^\d{4}$/, 'OTP code must contain only numeric digits');
  }
});

test('OTP Salt Generation: produces unique 32-character hex string (16 bytes)', () => {
  const salts = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const salt = generateSalt();
    assert.equal(salt.length, 32, 'Salt must be 32 hex characters long');
    assert.match(salt, /^[0-9a-f]{32}$/, 'Salt must be valid hex');
    salts.add(salt);
  }
  assert.equal(salts.size, 100, '100 generated salts must all be distinct');
});

test('OTP Hash & Salt Verification: matches correct OTP and rejects wrong OTP', () => {
  const code = '4820';
  const wrongCode = '9102';
  const salt = generateSalt();

  const expectedHash = hashOtp(code, salt);
  assert.equal(
    expectedHash.length,
    64,
    'SHA-256 hash must be 64 hex characters long',
  );

  const validVerification = constantTimeEquals(
    hashOtp(code, salt),
    expectedHash,
  );
  assert.equal(validVerification, true, 'Correct OTP must match expected hash');

  const invalidVerification = constantTimeEquals(
    hashOtp(wrongCode, salt),
    expectedHash,
  );
  assert.equal(invalidVerification, false, 'Incorrect OTP must be rejected');
});

test('OTP Constant-Time Equals: handles different length inputs safely', () => {
  const str1 = 'abcdef';
  const str2 = 'abcdefg';
  const str3 = '123456';

  assert.equal(
    constantTimeEquals(str1, str2),
    false,
    'Different lengths return false',
  );
  assert.equal(
    constantTimeEquals(str1, str3),
    false,
    'Same length but different content returns false',
  );
  assert.equal(
    constantTimeEquals(str1, 'abcdef'),
    true,
    'Exact match returns true',
  );
});

test('OTP TTL Constant: is set to 10 minutes (600,000 ms)', () => {
  assert.equal(OTP_TTL_MS, 10 * 60 * 1000, 'OTP TTL must equal 10 minutes');
});

test('OTP Attempt Limit Constant: is capped at 5 attempts', () => {
  assert.equal(MAX_OTP_ATTEMPTS, 5, 'Maximum failed attempts must be 5');
});

test('OTP Expiry Check: correctly identifies expired vs valid timestamps', () => {
  const nowMs = Date.now();
  const createdMs = nowMs - 11 * 60 * 1000; // Created 11 minutes ago
  const expiresAtMs = createdMs + OTP_TTL_MS;

  const isExpired = nowMs > expiresAtMs;
  assert.equal(
    isExpired,
    true,
    'OTP created 11 minutes ago should be expired under 10-min TTL',
  );

  const freshCreatedMs = nowMs - 2 * 60 * 1000; // Created 2 minutes ago
  const freshExpiresAtMs = freshCreatedMs + OTP_TTL_MS;
  const isFreshExpired = nowMs > freshExpiresAtMs;
  assert.equal(
    isFreshExpired,
    false,
    'OTP created 2 minutes ago should remain valid',
  );
});

test('PB-1: Repeated incorrect Start OTP submissions decrement remaining attempts and lock at limit', () => {
  const correctCode = '3491';
  const salt = generateSalt();
  const expectedHash = hashOtp(correctCode, salt);
  const nowMs = 1700000000000;
  const expiresAtMs = nowMs + OTP_TTL_MS;

  let currentAttempts = 0;

  // Attempts 1 to 4: Each incorrect code increases attempt counter
  for (let i = 1; i <= 4; i++) {
    const res = evaluateOtpVerificationAttemptPure({
      code: '0000',
      expectedHash,
      salt,
      expiresAtMs,
      nowMs,
      currentAttempts,
    });

    assert.equal(res.success, false, `Attempt ${i} must fail`);
    assert.equal(res.exhausted, false, `Attempt ${i} must not be exhausted`);
    assert.equal(res.nextAttempts, i, `Next attempts must equal ${i}`);
    assert.equal(
      res.remainingAttempts,
      5 - i,
      `Remaining attempts must equal ${5 - i}`,
    );
    assert.equal(res.invalidateOtp, false, `Attempt ${i} should not invalidate yet`);
    assert.match(
      res.error ?? '',
      new RegExp(`That code is wrong\\. ${5 - i} attempt`),
    );

    currentAttempts = res.nextAttempts;
  }

  // 5th incorrect attempt: Hits limit and locks out
  const finalAttempt = evaluateOtpVerificationAttemptPure({
    code: '0000',
    expectedHash,
    salt,
    expiresAtMs,
    nowMs,
    currentAttempts,
  });

  assert.equal(finalAttempt.success, false, '5th attempt must fail');
  assert.equal(finalAttempt.exhausted, true, '5th attempt must be exhausted');
  assert.equal(finalAttempt.nextAttempts, 5, 'Next attempts must be 5');
  assert.equal(finalAttempt.remainingAttempts, 0, 'Remaining attempts must be 0');
  assert.equal(finalAttempt.invalidateOtp, true, '5th attempt must invalidate OTP material');
  assert.match(finalAttempt.error ?? '', /Too many failed attempts/);

  // Subsequent attempt (6th) when already locked: Immediately rejected
  const lockedAttempt = evaluateOtpVerificationAttemptPure({
    code: correctCode, // Even with correct code, locked OTP is blocked!
    expectedHash,
    salt,
    expiresAtMs,
    nowMs,
    currentAttempts: 5,
  });

  assert.equal(lockedAttempt.success, false);
  assert.equal(lockedAttempt.exhausted, true);
  assert.equal(lockedAttempt.remainingAttempts, 0);
  assert.match(lockedAttempt.error ?? '', /Too many failed attempts/);
});

test('PB-1: Repeated incorrect End OTP submissions decrement attempts and lockout', () => {
  const correctCode = '8821';
  const salt = generateSalt();
  const expectedHash = hashOtp(correctCode, salt);
  const nowMs = 1700000000000;
  const expiresAtMs = nowMs + OTP_TTL_MS;

  let currentAttempts = 0;

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = evaluateOtpVerificationAttemptPure({
      code: '9999',
      expectedHash,
      salt,
      expiresAtMs,
      nowMs,
      currentAttempts,
    });

    if (attempt < 5) {
      assert.equal(res.exhausted, false);
      assert.equal(res.remainingAttempts, 5 - attempt);
    } else {
      assert.equal(res.exhausted, true);
      assert.equal(res.remainingAttempts, 0);
      assert.equal(res.invalidateOtp, true);
    }
    currentAttempts = res.nextAttempts;
  }
});

test('PB-1: Customer regeneration resets attempt counter to 0 and invalidates previous code', () => {
  const oldCode = '1111';
  const oldSalt = generateSalt();
  const oldHash = hashOtp(oldCode, oldSalt);
  const nowMs = 1700000000000;
  const oldExpiresAtMs = nowMs + OTP_TTL_MS;

  // Volunteer exhausted all 5 attempts on the old code
  const exhaustedRes = evaluateOtpVerificationAttemptPure({
    code: '0000',
    expectedHash: oldHash,
    salt: oldSalt,
    expiresAtMs: oldExpiresAtMs,
    nowMs,
    currentAttempts: 5,
  });
  assert.equal(exhaustedRes.exhausted, true);

  // Customer regenerates: new code, new salt, attempt counter reset to 0
  const newCode = '2222';
  const newSalt = generateSalt();
  const newHash = hashOtp(newCode, newSalt);
  const newExpiresAtMs = nowMs + OTP_TTL_MS;
  const resetAttempts = 0;

  // Submitting old code against new hash fails as attempt 1
  const submitOld = evaluateOtpVerificationAttemptPure({
    code: oldCode,
    expectedHash: newHash,
    salt: newSalt,
    expiresAtMs: newExpiresAtMs,
    nowMs,
    currentAttempts: resetAttempts,
  });
  assert.equal(submitOld.success, false);
  assert.equal(submitOld.nextAttempts, 1);
  assert.equal(submitOld.remainingAttempts, 4);

  // Submitting correct new code succeeds!
  const submitNew = evaluateOtpVerificationAttemptPure({
    code: newCode,
    expectedHash: newHash,
    salt: newSalt,
    expiresAtMs: newExpiresAtMs,
    nowMs,
    currentAttempts: submitOld.nextAttempts,
  });
  assert.equal(submitNew.success, true);
  assert.equal(submitNew.exhausted, false);
});

test('PB-1: Expired OTP is rejected before checking attempts', () => {
  const correctCode = '5555';
  const salt = generateSalt();
  const expectedHash = hashOtp(correctCode, salt);
  const nowMs = 1700000000000;
  const expiredAtMs = nowMs - 1000; // 1 second expired

  const res = evaluateOtpVerificationAttemptPure({
    code: correctCode,
    expectedHash,
    salt,
    expiresAtMs: expiredAtMs,
    nowMs,
    currentAttempts: 2,
  });

  assert.equal(res.success, false);
  assert.equal(res.expired, true);
  assert.equal(res.exhausted, false);
  assert.match(res.error ?? '', /This code has expired/);
});
