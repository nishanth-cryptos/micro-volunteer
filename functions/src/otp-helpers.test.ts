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
} from './otp';

test('OTP Code Generation: produces 6-digit zero-padded string', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateOtpCode();
    assert.equal(code.length, 6, 'OTP code must be 6 digits long');
    assert.match(code, /^\d{6}$/, 'OTP code must contain only numeric digits');
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
  const code = '482019';
  const wrongCode = '910284';
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
