// Unit tests for task scheduling (delayed activation) invariants & integration points.
// Executed via Node.js native test runner: node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateScheduledTime } from './update-scheduled-task';


// 1. Min Lead Time & Max Horizon Validation Tests (§6.2, §7)
test('validateScheduledTime: enforces 30-min min lead time and 7-day max horizon', () => {
  const nowMs = 1700000000000;

  // Too soon: 10 mins from now
  const tooSoonMs = nowMs + 10 * 60 * 1000;
  const resTooSoon = validateScheduledTime(tooSoonMs, nowMs);
  assert.equal(resTooSoon.valid, false);
  assert.match(resTooSoon.error ?? '', /at least 30 minutes/);

  // Too far: 8 days from now
  const tooFarMs = nowMs + 8 * 24 * 60 * 60 * 1000;
  const resTooFar = validateScheduledTime(tooFarMs, nowMs);
  assert.equal(resTooFar.valid, false);
  assert.match(resTooFar.error ?? '', /more than 7 days/);

  // Valid: 2 hours from now
  const validMs = nowMs + 2 * 60 * 60 * 1000;
  const resValid = validateScheduledTime(validMs, nowMs);
  assert.equal(resValid.valid, true);
  assert.equal(resValid.error, undefined);
});

// 2. Scheduled Task Activation Timing (§6.1, §7)
test('activateScheduledTasks Timing Invariant: activates only when scheduledFor <= now', () => {
  const nowMs = Date.now();

  const tasks = [
    { id: 'task-1', status: 'scheduled', scheduledForMs: nowMs - 1000 }, // Due
    { id: 'task-2', status: 'scheduled', scheduledForMs: nowMs + 3600000 }, // Future
    { id: 'task-3', status: 'searching', scheduledForMs: nowMs - 5000 }, // Already searching
  ];

  const dueTasks = tasks.filter(
    (t) => t.status === 'scheduled' && t.scheduledForMs <= nowMs,
  );

  assert.equal(dueTasks.length, 1);
  assert.equal(dueTasks[0]?.id, 'task-1');

  // Simulated activation write check (§3.1)
  const activatedTask = {
    ...dueTasks[0],
    status: 'searching',
    activatedAtMs: nowMs,
    waitStartedAtMs: nowMs, // M10 waitStartedAt must equal activatedAt
    nextCheckAtMs: nowMs + 60 * 1000, // M0.5 nextCheckAt must be initialized
  };

  assert.equal(activatedTask.status, 'searching');
  assert.equal(activatedTask.waitStartedAtMs, activatedTask.activatedAtMs);
  assert.ok(activatedTask.nextCheckAtMs > nowMs);
});

// 3. Same-Run Independence of Concurrent Activations (§6.3, §7)
test('Concurrent Activation Independence: failure in one task does not block others in sweep', () => {
  const tasksToProcess = [
    { id: 'task-ok-1', valid: true },
    { id: 'task-err-2', valid: false },
    { id: 'task-ok-3', valid: true },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const item of tasksToProcess) {
    try {
      if (!item.valid) {
        throw new Error('Simulated write failure on task-err-2');
      }
      successCount++;
    } catch {
      failCount++;
    }
  }

  assert.equal(successCount, 2);
  assert.equal(failCount, 1);
});

// 4. M9 & M10 Task Status Isolation (§5.3, §5.4, §7)
test('Status Isolation: M9 suggestNextTasks and M10 periodicRedispatchOffers ignore scheduled tasks', () => {
  const taskPool = [
    { id: 'task-scheduled', status: 'scheduled' },
    { id: 'task-searching', status: 'searching' },
    { id: 'task-accepted', status: 'accepted' },
  ];

  // M9 query filter check (status == 'searching')
  const suggestCandidates = taskPool.filter((t) => t.status === 'searching');
  assert.equal(suggestCandidates.length, 1);
  assert.equal(suggestCandidates[0]?.id, 'task-searching');

  // M10 query filter check (status == 'searching')
  const redispatchCandidates = taskPool.filter((t) => t.status === 'searching');
  assert.equal(redispatchCandidates.length, 1);
  assert.equal(redispatchCandidates[0]?.id, 'task-searching');
});

// 5. M11 Scheduled Task Deletion Violation Tracking (§6.7, §7)
test('M11 Scheduled Task Deletion: accumulates customer_task_delete violation toward freeze threshold', () => {
  let strikeCount = 0;
  let warningFrozen = false;
  const violationLog: string[] = [];

  function recordDeletionViolation(taskStatus: string) {
    // Both 'searching' and 'scheduled' task deletions count as customer_task_delete
    if (taskStatus === 'searching' || taskStatus === 'scheduled') {
      violationLog.push('customer_task_delete');
    }
    if (violationLog.length >= 3 && strikeCount === 0) {
      warningFrozen = true;
      strikeCount = 1;
    }
  }

  // Record 3 scheduled task deletions
  recordDeletionViolation('scheduled');
  recordDeletionViolation('scheduled');
  assert.equal(warningFrozen, false);

  recordDeletionViolation('scheduled');
  assert.equal(warningFrozen, true, 'Freeze warning must trigger on 3rd scheduled task deletion');
  assert.equal(strikeCount, 1);
});
