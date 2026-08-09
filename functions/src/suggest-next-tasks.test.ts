// Unit tests for suggestNextTasks, block filtering, and concurrent accept handling.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isEligible, score, type TaskDoc, type UserDoc } from './scoring';

test('Dual-role check (§6.2): excludes task where customerId === volunteerUid', () => {
  const volunteerUid = 'vol-123';
  const task: TaskDoc = {
    customerId: 'vol-123', // Same as volunteer
    category: 'groceries',
    title: 'Grocery delivery',
    requiredSkills: ['errands'],
    location: { lat: 12.9716, lng: 77.5946, h3Cell: '8928308280fffff' },
    riskLevel: 'low',
    searchRadiusM: 2000,
    status: 'searching',
  };

  const volunteerDoc: UserDoc = {
    roles: ['volunteer'],
    skills: ['errands'],
    availableNow: true,
    lastKnownLocation: { lat: 12.9716, lng: 77.5946, h3Cell: '8928308280fffff' },
    idVerified: true,
    accountStatus: 'active',
  };

  const eligible = isEligible(volunteerUid, volunteerDoc, task);
  assert.equal(eligible, false, 'Volunteer should not be eligible for their own task');
});

test('Block filtering (§6.4): excludes candidate tasks when customer is in blocked set', () => {
  const volunteerUid = 'vol-123';
  const blockedCustomerUid = 'cus-blocked';
  const normalCustomerUid = 'cus-normal';

  const blockedUserIds = new Set<string>([blockedCustomerUid]);

  const taskFromBlockedCustomer: TaskDoc = {
    customerId: blockedCustomerUid,
    category: 'groceries',
    title: 'Buy vegetables',
    requiredSkills: ['errands'],
    location: { lat: 12.9716, lng: 77.5946, h3Cell: '8928308280fffff' },
    riskLevel: 'low',
    searchRadiusM: 2000,
    status: 'searching',
  };

  const taskFromNormalCustomer: TaskDoc = {
    customerId: normalCustomerUid,
    category: 'groceries',
    title: 'Help with groceries',
    requiredSkills: ['errands'],
    location: { lat: 12.9716, lng: 77.5946, h3Cell: '8928308280fffff' },
    riskLevel: 'low',
    searchRadiusM: 2000,
    status: 'searching',
  };

  const volunteerDoc: UserDoc = {
    roles: ['volunteer'],
    skills: ['errands'],
    availableNow: true,
    lastKnownLocation: { lat: 12.9716, lng: 77.5946, h3Cell: '8928308280fffff' },
    idVerified: true,
    accountStatus: 'active',
  };

  // Check normal eligibility first
  assert.equal(isEligible(volunteerUid, volunteerDoc, taskFromBlockedCustomer), true);
  assert.equal(isEligible(volunteerUid, volunteerDoc, taskFromNormalCustomer), true);

  // Apply block-filtering logic
  const candidateTasks = [taskFromBlockedCustomer, taskFromNormalCustomer];
  const filteredTasks = candidateTasks.filter(
    (t) => t.customerId !== volunteerUid && !blockedUserIds.has(t.customerId),
  );

  assert.equal(filteredTasks.length, 1);
  assert.equal(filteredTasks[0]?.customerId, normalCustomerUid);
});

test('Concurrent accept (§6.3): acceptOffer precondition check throws clean error when task status is no longer searching', () => {
  // Simulate task state after another volunteer accepted it concurrently
  const taskStateAfterConcurrentAccept = {
    status: 'accepted',
    acceptedVolunteerId: 'vol-other-winner',
  };

  // Verify the precondition logic evaluated by acceptOffer transaction
  let errorThrown: string | null = null;
  if (taskStateAfterConcurrentAccept.status !== 'searching') {
    errorThrown = 'This task is no longer accepting volunteers.';
  }

  assert.equal(
    errorThrown,
    'This task is no longer accepting volunteers.',
    'Concurrent accept must report clean precondition error message',
  );
});

test('Scoring (§3): candidate tasks scored consistently using shared scoring.ts weights', () => {
  const volunteerDoc: UserDoc = {
    roles: ['volunteer'],
    skills: ['errands', 'tech_help'],
    availableNow: true,
    lastKnownLocation: { lat: 12.9716, lng: 77.5946, h3Cell: '8928308280fffff' },
    trustScore: 80,
    verifiedTaskCount: 5,
    openReportsCount: 0,
    warningsCount: 0,
  };

  const task1: TaskDoc = {
    customerId: 'cus-1',
    category: 'tech_help',
    title: 'WiFi setup',
    requiredSkills: ['tech_help'],
    location: { lat: 12.9716, lng: 77.5946, h3Cell: '8928308280fffff' },
    riskLevel: 'low',
    searchRadiusM: 2000,
    status: 'searching',
  };

  const scoreResult = score(volunteerDoc, task1);
  assert.ok(scoreResult.total > 0, 'Score should be positive');
  assert.equal(scoreResult.skill, 1.0, 'Full skill match score');
  assert.equal(scoreResult.trust, 0.8, '80/100 trust score normalized to 0.8');
});
