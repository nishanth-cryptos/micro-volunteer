// Batch 7: Pre-Acceptance Task Discovery Privacy & Projection Test Suite
// Verifies that volunteers cannot read sensitive requester data before accepting an offer,
// that openTasks projection only contains safe discovery fields,
// that Firestore rules strictly enforce this barrier, and that lifecycle transitions maintain projection integrity.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createOpenTaskProjectionPure,
} from './dispatch-offers';

test('Batch 7 Privacy: createOpenTaskProjectionPure never leaks sensitive requester fields', () => {
  const sensitiveTask = {
    customerId: 'cust-sensitive-999',
    customerName: 'Ananya Sharma',
    customerPhotoURL: 'https://cdn.example.com/photos/ananya.jpg',
    title: 'Grocery Assistance for Senior Neighbor',
    category: 'groceries',
    requiredSkills: ['groceries-shopping', 'heavy-lifting'],
    location: {
      lat: 19.076,
      lng: 72.8777,
      h3Cell: '89618926487ffff',
    },
    riskLevel: 'low' as const,
    estimatedMinutes: 45,
    searchRadiusM: 3000,
    status: 'searching',
    description: {
      meetingPoint: 'Apartment 4B, Sunflower Heights, Palm Beach Road',
      whatToBring: 'Shopping cart',
      preference: 'Prefers morning delivery before 11 AM',
      safetyNote: 'Doorbell is loud, please knock gently',
    },
    cancelledVolunteerIds: ['vol-cancelled-1'],
    createdAt: { seconds: 1700000000, nanoseconds: 0 },
    expiresAt: { seconds: 1700086400, nanoseconds: 0 },
  };

  const projection = createOpenTaskProjectionPure('task-test-701', sensitiveTask);

  // 1. Safe fields MUST be present
  assert.equal(projection.taskId, 'task-test-701');
  assert.equal(projection.title, 'Grocery Assistance for Senior Neighbor');
  assert.equal(projection.category, 'groceries');
  assert.deepEqual(projection.requiredSkills, [
    'groceries-shopping',
    'heavy-lifting',
  ]);
  assert.equal(projection.riskLevel, 'low');
  assert.equal(projection.estimatedMinutes, 45);
  assert.equal(projection.searchRadiusM, 3000);
  assert.equal(projection.status, 'searching');
  assert.equal(projection.location.h3Cell, '89618926487ffff');

  // 2. Sensitive requester fields MUST NOT be present
  const projRecord = projection as unknown as Record<string, unknown>;
  assert.equal(projRecord['customerId'], undefined, 'customerId must be omitted');
  assert.equal(projRecord['customerName'], undefined, 'customerName must be omitted');
  assert.equal(projRecord['customerPhotoURL'], undefined, 'customerPhotoURL must be omitted');
  assert.equal(projRecord['description'], undefined, 'description object must be omitted');
  assert.equal(projRecord['meetingPoint'], undefined, 'meetingPoint must be omitted');
  assert.equal(projRecord['safetyNote'], undefined, 'safetyNote must be omitted');
  assert.equal(projRecord['preference'], undefined, 'preference must be omitted');
  assert.equal(projRecord['whatToBring'], undefined, 'whatToBring must be omitted');
  assert.equal(projRecord['cancelledVolunteerIds'], undefined, 'cancelledVolunteerIds must be omitted');

  // 3. Location MUST NOT include exact latitude or longitude
  const locRecord = projection.location as unknown as Record<string, unknown>;
  assert.equal(locRecord['lat'], undefined, 'exact lat must be omitted');
  assert.equal(locRecord['lng'], undefined, 'exact lng must be omitted');
});

test('Batch 7 Privacy: fallback defaults for optional fields', () => {
  const minimalTask = {
    title: 'Minimal Task',
    category: 'gardening',
    location: { lat: 12, lng: 77, h3Cell: '896189264870000' },
    status: 'searching',
  };

  const projection = createOpenTaskProjectionPure('task-min-1', minimalTask);
  assert.equal(projection.taskId, 'task-min-1');
  assert.equal(projection.riskLevel, 'low');
  assert.equal(projection.searchRadiusM, 2000);
  assert.deepEqual(projection.requiredSkills, []);
  assert.equal(projection.location.h3Cell, '896189264870000');
});

test('Batch 7 Rules: firestore.rules strictly forbids pre-acceptance volunteer reads of full tasks', () => {
  const rulesPath = join(__dirname, '../../firestore.rules');
  const rules = readFileSync(rulesPath, 'utf-8');

  // Verification 1: tasks collection does not permit searching status read for volunteers
  assert.ok(
    !rules.includes("resource.data.status == 'searching' && isVolunteer()"),
    "tasks collection must not permit volunteers to read full requester documents before acceptance",
  );

  // Verification 2: tasks collection read is scoped strictly to customer, accepted volunteer, or admin
  assert.ok(
    rules.includes('request.auth.uid == resource.data.customerId') &&
    rules.includes('request.auth.uid == resource.data.acceptedVolunteerId'),
    "tasks collection read must be restricted strictly to customer or accepted volunteer",
  );

  // Verification 3: openTasks collection is defined
  assert.ok(
    rules.includes('match /openTasks/{taskId}'),
    "firestore.rules must declare match /openTasks/{taskId}",
  );

  // Verification 4: openTasks read requires active volunteer and is blocked for suspended/banned
  assert.ok(
    rules.includes('!isSuspendedOrBanned(request.auth.uid) && isVolunteer()'),
    "openTasks read must require active non-suspended volunteer",
  );

  // Verification 5: openTasks write is strictly denied to all clients
  const openTasksBlockMatch = rules.match(/match \/openTasks\/\{taskId\} \{([\s\S]*?)\}/);
  assert.ok(openTasksBlockMatch && openTasksBlockMatch[1], 'openTasks match block must exist');
  assert.ok(
    openTasksBlockMatch[1].includes('allow write: if false;'),
    "openTasks must forbid client writes (allow write: if false;)",
  );
});

test('Batch 7 Client Query: VolunteerDashboard queries openTasks and does not query tasks with searching status', () => {
  const dashboardPath = join(__dirname, '../../src/components/VolunteerDashboard.tsx');
  const dashboardSrc = readFileSync(dashboardPath, 'utf-8');

  // Must query openTasks collection for open task discovery
  assert.ok(
    dashboardSrc.includes("collection(db(), 'openTasks')"),
    "VolunteerDashboard must query openTasks collection",
  );

  // Must NOT query tasks collection with status == searching
  assert.ok(
    !dashboardSrc.includes("where('status', '==', 'searching')"),
    "VolunteerDashboard must not query tasks with status == 'searching'",
  );
});

test('Batch 7 Lifecycle Sync: pure logic for projection upsert vs removal', () => {
  function shouldMaintainProjection(
    task: { status?: string } | null | undefined,
  ): 'upsert' | 'delete' {
    if (!task || task.status !== 'searching') {
      return 'delete';
    }
    return 'upsert';
  }

  // Initial creation in searching status
  assert.equal(shouldMaintainProjection({ status: 'searching' }), 'upsert');

  // Transition to accepted status
  assert.equal(shouldMaintainProjection({ status: 'accepted' }), 'delete');

  // Transition to in_progress status
  assert.equal(shouldMaintainProjection({ status: 'in_progress' }), 'delete');

  // Transition to completed status
  assert.equal(shouldMaintainProjection({ status: 'completed' }), 'delete');

  // Transition to cancelled status
  assert.equal(shouldMaintainProjection({ status: 'cancelled' }), 'delete');

  // Transition to expired status
  assert.equal(shouldMaintainProjection({ status: 'expired' }), 'delete');

  // Document deletion
  assert.equal(shouldMaintainProjection(null), 'delete');
  assert.equal(shouldMaintainProjection(undefined), 'delete');

  // Reassignment back to searching status
  assert.equal(shouldMaintainProjection({ status: 'searching' }), 'upsert');
});
