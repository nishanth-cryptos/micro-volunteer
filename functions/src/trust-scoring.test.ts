// Unit tests for trust score calculation formula, saturation caps, penalties, and clamping.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeTrustScorePure } from './recompute-trust-score';

test('Trust Score: newcomer with zero completed tasks and no ratings gets default base score', () => {
  const result = computeTrustScorePure({
    verifiedTaskCount: 0,
    verifiedHours: 0,
    idVerified: false,
    ratedCount: 0,
    totalRating: 0,
    reportPenalty: 0,
  });

  // rawScore = 0.35*0 + 0.30*1.0 + 0.15*0 + 0.10*0 - 0 = 0.30
  // trustScore = round(0.30 * 100) = 30
  assert.equal(result.rawScore, 0.30);
  assert.equal(result.clampedScore, 0.30);
  assert.equal(result.trustScore, 30);
});

test('Trust Score: ID verification adds exactly +0.10 (+10 points)', () => {
  const resultUnverified = computeTrustScorePure({ idVerified: false });
  const resultVerified = computeTrustScorePure({ idVerified: true });

  assert.equal(resultUnverified.trustScore, 30);
  assert.equal(resultVerified.trustScore, 40);
});

test('Trust Score: task saturation caps contribution at 20 tasks', () => {
  const atCap = computeTrustScorePure({ verifiedTaskCount: 20 });
  const aboveCap = computeTrustScorePure({ verifiedTaskCount: 100 });

  // 20 tasks -> taskNorm = 1.0 (0.35 contribution)
  // 100 tasks -> taskNorm = 1.0 (0.35 contribution)
  assert.equal(atCap.trustScore, 65); // 0.35 + 0.30 = 0.65 -> 65
  assert.equal(aboveCap.trustScore, 65);
});

test('Trust Score: hour saturation caps contribution at 40 hours', () => {
  const atCap = computeTrustScorePure({ verifiedHours: 40 });
  const aboveCap = computeTrustScorePure({ verifiedHours: 500 });

  // 40 hours -> hoursNorm = 1.0 (0.15 contribution)
  assert.equal(atCap.trustScore, 45); // 0.30 + 0.15 = 0.45 -> 45
  assert.equal(aboveCap.trustScore, 45);
});

test('Trust Score: maxed-out volunteer pegs at score 90 (Trusted threshold 85)', () => {
  const maxed = computeTrustScorePure({
    verifiedTaskCount: 20, // 0.35
    verifiedHours: 40,     // 0.15
    idVerified: true,       // 0.10
    totalRating: 25,        // 5.0 avg -> 0.30
    ratedCount: 5,
    reportPenalty: 0,
  });

  // 0.35 + 0.30 + 0.15 + 0.10 = 0.90 -> 90
  assert.equal(maxed.trustScore, 90);
  assert.ok(maxed.trustScore >= 85, 'Maxed volunteer must reach Emerald Trusted threshold (>=85)');
});

test('Trust Score: rating scaling handles 1-star to 5-star ratings accurately', () => {
  const oneStar = computeTrustScorePure({ totalRating: 1, ratedCount: 1 });
  const fiveStar = computeTrustScorePure({ totalRating: 5, ratedCount: 1 });

  // 1-star -> avg 1.0 -> scaledAvgRating 0.2 -> 0.30 * 0.2 = 0.06
  // rawScore = 0.06 -> clamped to 0.30 -> 30
  assert.equal(oneStar.trustScore, 30);
  // 5-star -> avg 5.0 -> scaledAvgRating 1.0 -> 0.30 * 1.0 = 0.30
  // rawScore = 0.30 -> 30
  assert.equal(fiveStar.trustScore, 30);
});

test('Trust Score: report penalty deduction clamps to minimum floor 30', () => {
  const penalizedNewcomer = computeTrustScorePure({
    verifiedTaskCount: 0,
    reportPenalty: 0.50, // Penalty larger than raw score 0.30
  });

  // rawScore = 0.30 - 0.50 = -0.20
  // clampedScore = max(0.3, -0.20) = 0.30
  assert.equal(penalizedNewcomer.rawScore, -0.20);
  assert.equal(penalizedNewcomer.clampedScore, 0.30);
  assert.equal(penalizedNewcomer.trustScore, 30);
});

test('Trust Score: maximum clamp ceiling bounds score at 100', () => {
  // Hypothetical raw score exceeding 1.0
  const overflowScore = computeTrustScorePure({
    verifiedTaskCount: 50,
    verifiedHours: 100,
    idVerified: true,
    totalRating: 50,
    ratedCount: 10,
    reportPenalty: -0.5, // Negative penalty override
  });

  assert.equal(overflowScore.clampedScore, 1.0);
  assert.equal(overflowScore.trustScore, 100);
});
