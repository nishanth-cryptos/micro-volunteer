// Unit tests for points calculation, duration bonuses, caps, customer eligibility, and skill points mapping.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculatePointsAwardPure } from './award-points-on-completion';

test('Points: minimum task duration (<15 mins) awards 10 base points with 0 duration bonus', () => {
  const res0 = calculatePointsAwardPure({ estimatedMinutes: 0 });
  const res10 = calculatePointsAwardPure({ estimatedMinutes: 10 });

  assert.equal(res0.durationBonus, 0);
  assert.equal(res0.volunteerPointsAwarded, 10);

  assert.equal(res10.durationBonus, 0);
  assert.equal(res10.volunteerPointsAwarded, 10);
});

test('Points: 15-minute duration boundaries increment bonus accurately', () => {
  const res14 = calculatePointsAwardPure({ estimatedMinutes: 14 });
  const res15 = calculatePointsAwardPure({ estimatedMinutes: 15 });
  const res29 = calculatePointsAwardPure({ estimatedMinutes: 29 });
  const res30 = calculatePointsAwardPure({ estimatedMinutes: 30 });

  assert.equal(res14.durationBonus, 0, '14 mins -> 0 bonus');
  assert.equal(res15.durationBonus, 1, '15 mins -> 1 bonus');
  assert.equal(res15.volunteerPointsAwarded, 11);

  assert.equal(res29.durationBonus, 1, '29 mins -> 1 bonus');
  assert.equal(res30.durationBonus, 2, '30 mins -> 2 bonus');
  assert.equal(res30.volunteerPointsAwarded, 12);
});

test('Points: duration bonus caps at MAX_DURATION_BONUS (+8 pts) for long tasks (>=120 mins)', () => {
  const res120 = calculatePointsAwardPure({ estimatedMinutes: 120 });
  const res240 = calculatePointsAwardPure({ estimatedMinutes: 240 }); // 4 hours

  assert.equal(res120.durationBonus, 8, '120 mins -> max 8 bonus');
  assert.equal(
    res120.volunteerPointsAwarded,
    18,
    'Max volunteer points = 10 + 8 = 18',
  );

  assert.equal(res240.durationBonus, 8, '240 mins -> capped at 8 bonus');
  assert.equal(
    res240.volunteerPointsAwarded,
    18,
    'Max volunteer points capped at 18',
  );
});

test('Points: customer receives 2 points if role includes volunteer, 0 if customer-only', () => {
  const pureCustomer = calculatePointsAwardPure({
    customerRoles: ['customer'],
  });
  const dualRoleCustomer = calculatePointsAwardPure({
    customerRoles: ['customer', 'volunteer'],
  });

  assert.equal(
    pureCustomer.customerPointsAwarded,
    0,
    'Customer-only gets 0 points',
  );
  assert.equal(
    dualRoleCustomer.customerPointsAwarded,
    2,
    'Dual-role customer gets 2 points',
  );
});

test('Points: verified hours increment equals estimatedMinutes / 60', () => {
  const res30 = calculatePointsAwardPure({ estimatedMinutes: 30 });
  const res90 = calculatePointsAwardPure({ estimatedMinutes: 90 });

  assert.equal(res30.verifiedHoursIncrement, 0.5);
  assert.equal(res90.verifiedHoursIncrement, 1.5);
});

test('Points: required skills mapping tracks all credited skills', () => {
  const skills = ['gardening', 'lifting', 'first_aid'];
  const res = calculatePointsAwardPure({ requiredSkills: skills });

  assert.deepEqual(res.skillsCredited, ['gardening', 'lifting', 'first_aid']);
});
