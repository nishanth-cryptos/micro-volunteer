// Unit tests for periodicRedispatchOffers nudge progression, idempotency, and legacy task fallback.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeNudgeUpdate } from './periodic-redispatch-offers';
import { NUDGE_COPY_BANK, NEARING_EXPIRY_COPY, WAIT_TIER_CONFIG } from './nudge-copy-bank';

test('WAIT_TIER_CONFIG contains expected thresholds and radiusStepMultipliers', () => {
  assert.deepEqual(WAIT_TIER_CONFIG.fast.nudgeStages, [3, 8, 15]);
  assert.equal(WAIT_TIER_CONFIG.fast.radiusStepMultiplier, 1.5);

  assert.deepEqual(WAIT_TIER_CONFIG.normal.nudgeStages, [5, 15, 30]);
  assert.equal(WAIT_TIER_CONFIG.normal.radiusStepMultiplier, 1.0);

  assert.deepEqual(WAIT_TIER_CONFIG.flexible.nudgeStages, [10, 30, 60]);
  assert.equal(WAIT_TIER_CONFIG.flexible.radiusStepMultiplier, 0.75);
});

test('Nudge stage progression for fast tier (3, 8, 15 mins)', () => {
  const baseTime = 1000000;
  const task = {
    expectedWaitTier: 'fast',
    waitStartedAt: { toMillis: () => baseTime },
    lastNudgeStage: 0,
  };

  // 2 minutes: no nudge yet
  assert.equal(computeNudgeUpdate(task, baseTime + 2 * 60 * 1000), null);

  // 3 minutes: Stage 1
  const update1 = computeNudgeUpdate(task, baseTime + 3 * 60 * 1000);
  assert.notEqual(update1, null);
  assert.equal(update1?.nextNudgeStage, 1);
  assert.equal(update1?.statusMessage, NUDGE_COPY_BANK[1]);

  // 8 minutes with lastNudgeStage = 1: Stage 2
  const update2 = computeNudgeUpdate(
    { ...task, lastNudgeStage: 1 },
    baseTime + 8 * 60 * 1000,
  );
  assert.equal(update2?.nextNudgeStage, 2);
  assert.equal(update2?.statusMessage, NUDGE_COPY_BANK[2]);

  // 15 minutes with lastNudgeStage = 2: Stage 3
  const update3 = computeNudgeUpdate(
    { ...task, lastNudgeStage: 2 },
    baseTime + 15 * 60 * 1000,
  );
  assert.equal(update3?.nextNudgeStage, 3);
  assert.equal(update3?.statusMessage, NUDGE_COPY_BANK[3]);
});

test('Idempotency of nudge-stage writes (§8.4): same stage is not re-triggered', () => {
  const baseTime = 1000000;
  const task = {
    expectedWaitTier: 'normal',
    waitStartedAt: { toMillis: () => baseTime },
    lastNudgeStage: 1, // Already sent stage 1
  };

  // At 6 minutes (after 5-min threshold for normal tier), stage 1 should NOT be re-triggered
  const result = computeNudgeUpdate(task, baseTime + 6 * 60 * 1000);
  assert.equal(result, null, 'Stage 1 should not re-fire when lastNudgeStage === 1');
});

test('Legacy task fallback (§8.5): missing expectedWaitTier defaults to normal', () => {
  const baseTime = 1000000;
  const legacyTask = {
    // expectedWaitTier is undefined
    createdAt: { toMillis: () => baseTime },
    lastNudgeStage: 0,
  };

  // At 4 mins: no nudge for normal tier (threshold is 5 mins)
  assert.equal(computeNudgeUpdate(legacyTask, baseTime + 4 * 60 * 1000), null);

  // At 5 mins: triggers Stage 1 under normal tier defaults
  const result = computeNudgeUpdate(legacyTask, baseTime + 5 * 60 * 1000);
  assert.notEqual(result, null);
  assert.equal(result?.nextNudgeStage, 1);
  assert.equal(result?.statusMessage, NUDGE_COPY_BANK[1]);
});

test('Nearing expiry flag (§4.2): sets nearingExpiry when within 2 hours of 24h expiry & stage 3 reached', () => {
  const baseTime = 1000000;
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  const expiresAtMs = baseTime + twentyFourHoursMs;

  const task = {
    expectedWaitTier: 'normal',
    waitStartedAt: { toMillis: () => baseTime },
    expiresAt: { toMillis: () => expiresAtMs },
    lastNudgeStage: 3,
    nearingExpiry: false,
  };

  // At 22.5 hours: within 2h pre-expiry window
  const update = computeNudgeUpdate(task, baseTime + 22.5 * 60 * 60 * 1000);
  assert.notEqual(update, null);
  assert.equal(update?.nearingExpiry, true);
  assert.equal(update?.statusMessage, NEARING_EXPIRY_COPY);
});
