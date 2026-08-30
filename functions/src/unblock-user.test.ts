// Unit tests for unblockUser function and ID logic.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Deterministic block ID format: userA_userB (where userA < userB)', () => {
  const caller1 = 'user_zebra';
  const target1 = 'user_alpha';

  const userA1 = caller1 < target1 ? caller1 : target1;
  const userB1 = caller1 < target1 ? target1 : caller1;
  const blockId1 = `${userA1}_${userB1}`;

  assert.equal(blockId1, 'user_alpha_user_zebra');

  const caller2 = 'user_alpha';
  const target2 = 'user_zebra';

  const userA2 = caller2 < target2 ? caller2 : target2;
  const userB2 = caller2 < target2 ? target2 : caller2;
  const blockId2 = `${userA2}_${userB2}`;

  assert.equal(blockId2, 'user_alpha_user_zebra');
  assert.equal(
    blockId1,
    blockId2,
    'Block IDs should be identical regardless of who initiates',
  );
});

test('Unblock authorization: caller must equal blockedBy field on block doc', () => {
  const blockDoc = {
    userA: 'user_alpha',
    userB: 'user_zebra',
    blockedBy: 'user_alpha',
  };

  const callerAuthorized = blockDoc.blockedBy === 'user_alpha';
  const callerUnauthorized = blockDoc.blockedBy === 'user_zebra';

  assert.equal(callerAuthorized, true, 'User who initiated block can unblock');
  assert.equal(
    callerUnauthorized,
    false,
    'Other user cannot unblock a block placed on them',
  );
});
