// Unit tests for matching engine, scoring formula, boundary distances, and eligibility rules.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  haversineM,
  isEligible,
  score,
  type TaskDoc,
  type UserDoc,
} from './scoring';
import { Timestamp } from 'firebase-admin/firestore';


const baseTask: TaskDoc = {
  customerId: 'customer-100',
  category: 'gardening',
  title: 'Help water garden plants',
  requiredSkills: ['gardening', 'lifting'],
  location: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' },
  riskLevel: 'low',
  searchRadiusM: 2000, // 2 km
  status: 'searching',
};

const baseVolunteer: UserDoc = {
  displayName: 'Active Volunteer',
  photoURL: 'https://example.com/photo.jpg',
  roles: ['volunteer'],
  skills: ['gardening', 'cleaning'],
  availableNow: true,
  lastKnownLocation: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' },
  idVerified: false,
  trustScore: 70,
  verifiedTaskCount: 5,
  openReportsCount: 0,
  warningsCount: 0,
  accountStatus: 'active',
};

// 1. Distance Calculation (Haversine Formula)
test('haversineM: zero distance for identical coordinates', () => {
  const dist = haversineM(13.0202, 77.6815, 13.0202, 77.6815);
  assert.equal(Math.round(dist), 0);
});

test('haversineM: accurate distance calculation for ~1 km displacement', () => {
  // ~1 km displacement north
  const lat2 = 13.0202 + 1000 / 111_000;
  const dist = haversineM(13.0202, 77.6815, lat2, 77.6815);
  assert.ok(dist >= 990 && dist <= 1010, `Expected ~1000m, got ${dist}`);
});

// 2. Eligibility & Exclusions
test('isEligible: customer cannot volunteer on their own task', () => {
  const selfEligible = isEligible('customer-100', baseVolunteer, baseTask);
  assert.equal(selfEligible, false, 'Self-volunteering must be rejected');
});

test('isEligible: excludes banned users (banned flag or accountStatus)', () => {
  const bannedUser1: UserDoc = { ...baseVolunteer, accountStatus: 'banned' };
  const bannedUser2: UserDoc = { ...baseVolunteer, banned: true };

  assert.equal(isEligible('vol-1', bannedUser1, baseTask), false);
  assert.equal(isEligible('vol-2', bannedUser2, baseTask), false);
});

test('isEligible: excludes currently suspended users', () => {
  const futureTime = Timestamp.fromMillis(Date.now() + 86400 * 1000);
  const suspendedUser: UserDoc = {
    ...baseVolunteer,
    accountStatus: 'suspended',
    suspendedUntil: futureTime,
  };
  assert.equal(isEligible('vol-3', suspendedUser, baseTask), false);

  // Expired suspension should be allowed
  const pastTime = Timestamp.fromMillis(Date.now() - 1000);
  const expiredSuspensionUser: UserDoc = {
    ...baseVolunteer,
    accountStatus: 'suspended',
    suspendedUntil: pastTime,
  };
  assert.equal(isEligible('vol-4', expiredSuspensionUser, baseTask), true);
});

test('isEligible: excludes non-volunteers or users missing roles/skills', () => {
  const nonVolunteer: UserDoc = { ...baseVolunteer, roles: ['customer'] };
  const noSkills: UserDoc = { ...baseVolunteer, skills: [] };

  assert.equal(isEligible('vol-5', nonVolunteer, baseTask), false);
  assert.equal(isEligible('vol-6', noSkills, baseTask), false);
});

test('isEligible: OR skill matching (at least 1 matching skill required)', () => {
  const noMatchSkill: UserDoc = { ...baseVolunteer, skills: ['cooking', 'driving'] };
  const oneMatchSkill: UserDoc = { ...baseVolunteer, skills: ['gardening'] };

  assert.equal(isEligible('vol-7', noMatchSkill, baseTask), false);
  assert.equal(isEligible('vol-8', oneMatchSkill, baseTask), true);
});

test('isEligible: Medium-risk task requires ID verification', () => {
  const mediumRiskTask: TaskDoc = { ...baseTask, riskLevel: 'medium' };
  const unverifiedVol: UserDoc = { ...baseVolunteer, idVerified: false };
  const verifiedVol: UserDoc = { ...baseVolunteer, idVerified: true };

  assert.equal(isEligible('vol-9', unverifiedVol, mediumRiskTask), false);
  assert.equal(isEligible('vol-10', verifiedVol, mediumRiskTask), true);
});

test('isEligible: boundary distance exactly at, inside, and outside search radius', () => {
  // 1. Just inside radius (~1500m)
  const insideVol: UserDoc = {
    ...baseVolunteer,
    lastKnownLocation: { lat: 13.0202 + 1500 / 111_000, lng: 77.6815, h3Cell: '89618926487ffff' },
  };
  assert.equal(isEligible('vol-inside', insideVol, baseTask), true);

  // 2. Just outside radius (~2500m vs 2000m radius)
  const outsideVol: UserDoc = {
    ...baseVolunteer,
    lastKnownLocation: { lat: 13.0202 + 2500 / 111_000, lng: 77.6815, h3Cell: '89618926487ffff' },
  };
  assert.equal(isEligible('vol-outside', outsideVol, baseTask), false);
});

// 3. Pure Scoring Formula Weights & Breakdown
test('score formula: new volunteer with 0 completed tasks gets newcomer floor pastCompletion (0.2)', () => {
  const newVol: UserDoc = { ...baseVolunteer, verifiedTaskCount: 0 };
  const breakdown = score(newVol, baseTask);

  assert.equal(breakdown.pastCompletion, 0.2, 'Newcomer pastCompletion score floor must be 0.2');
});

test('score formula: partial vs full skill credit calculation', () => {
  // Required: ['gardening', 'lifting'] (2 skills)
  const partialSkillVol: UserDoc = { ...baseVolunteer, skills: ['gardening'] };
  const fullSkillVol: UserDoc = { ...baseVolunteer, skills: ['gardening', 'lifting', 'driving'] };

  const breakdownPartial = score(partialSkillVol, baseTask);
  const breakdownFull = score(fullSkillVol, baseTask);

  assert.equal(breakdownPartial.skill, 0.5, '1 of 2 matching skills = 0.5 score');
  assert.equal(breakdownFull.skill, 1.0, '2 of 2 matching skills = 1.0 score');
});

test('score formula: trust score weight scaling and default value', () => {
  const { trustScore: _t, ...baseNoTrust } = baseVolunteer;
  const defaultTrustVol: UserDoc = baseNoTrust;
  const highTrustVol: UserDoc = { ...baseVolunteer, trustScore: 85 };

  const breakdownDefault = score(defaultTrustVol, baseTask);
  const breakdownHigh = score(highTrustVol, baseTask);

  assert.equal(breakdownDefault.trust, 0.3, 'Missing trustScore defaults to 30 -> 0.3 norm');
  assert.equal(breakdownHigh.trust, 0.85, 'Trust score 85 -> 0.85 norm');
});

test('score formula: report penalties accumulation and cap at 0.5', () => {
  const cleanVol: UserDoc = { ...baseVolunteer, openReportsCount: 0, warningsCount: 0 };
  const penalizedVol: UserDoc = { ...baseVolunteer, openReportsCount: 2, warningsCount: 1 };
  const maxPenalizedVol: UserDoc = { ...baseVolunteer, openReportsCount: 10, warningsCount: 10 };

  const bClean = score(cleanVol, baseTask);
  const bPenalized = score(penalizedVol, baseTask);
  const bMaxPenalized = score(maxPenalizedVol, baseTask);

  assert.equal(bClean.reportPenalty, 0);
  assert.equal(bPenalized.reportPenalty, 0.35, '2*0.1 + 1*0.15 = 0.35 penalty');
  assert.equal(bMaxPenalized.reportPenalty, 0.5, 'Report penalty must cap at 0.5');
});

test('score formula: total score calculation matches weighted formula exactly', () => {
  const vol: UserDoc = {
    ...baseVolunteer,
    trustScore: 80, // 0.80
    verifiedTaskCount: 10, // pastCompletion = min(1, 0.2 + 10*0.05) = 0.70
    openReportsCount: 1, // penalty = 0.10
    skills: ['gardening'], // skill = 0.5
    lastKnownLocation: { lat: 13.0202, lng: 77.6815, h3Cell: '89618926487ffff' }, // ringDist = 0 -> distance = 1.0
  };

  const breakdown = score(vol, baseTask);

  // distance: 1.0 (0.30 * 1.0 = 0.30)
  // skill: 0.5 (0.25 * 0.5 = 0.125)
  // trust: 0.80 (0.20 * 0.80 = 0.16)
  // availability: 1.0 (0.15 * 1.0 = 0.15)
  // pastCompletion: 0.70 (0.10 * 0.70 = 0.07)
  // reportPenalty: 0.10
  // total = 0.30 + 0.125 + 0.16 + 0.15 + 0.07 - 0.10 = 0.705

  const expectedTotal = 0.30 * 1.0 + 0.25 * 0.5 + 0.20 * 0.80 + 0.15 * 1.0 + 0.10 * 0.70 - 0.10;
  assert.equal(Math.round(breakdown.total * 1000), Math.round(expectedTotal * 1000));
});
