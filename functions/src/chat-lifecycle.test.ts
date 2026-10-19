// Batch 8: Chat Lifecycle Restrictions & Message Immutability Test Suite
// Verifies that:
// 1. Chat creation and message posting are permitted only in 'accepted' and 'in_progress' states.
// 2. Completed, cancelled, expired, searching, and scheduled tasks strictly deny new messages.
// 3. Messages and chat documents remain immutable for clients (no edits or deletes).
// 4. Server-authoritative system messages and mutual block enforcement are preserved.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function isChatActiveForTaskPure(
  task: { status?: string | undefined } | null | undefined,
): boolean {
  if (!task || typeof task.status !== 'string') return false;
  return task.status === 'accepted' || task.status === 'in_progress';
}

test('Batch 8 Pure Evaluator: isChatActiveForTaskPure accepts only accepted and in_progress states', () => {
  // Supported active communication states
  assert.equal(isChatActiveForTaskPure({ status: 'accepted' }), true);
  assert.equal(isChatActiveForTaskPure({ status: 'in_progress' }), true);

  // Terminated / read-only states MUST return false
  assert.equal(isChatActiveForTaskPure({ status: 'completed' }), false);
  assert.equal(isChatActiveForTaskPure({ status: 'cancelled' }), false);
  assert.equal(isChatActiveForTaskPure({ status: 'expired' }), false);

  // Pre-acceptance / unassigned states MUST return false
  assert.equal(isChatActiveForTaskPure({ status: 'searching' }), false);
  assert.equal(isChatActiveForTaskPure({ status: 'scheduled' }), false);

  // Malformed or null tasks
  assert.equal(isChatActiveForTaskPure(null), false);
  assert.equal(isChatActiveForTaskPure(undefined), false);
  assert.equal(isChatActiveForTaskPure({}), false);
});

test('Batch 8 Rules Invariant: firestore.rules gates chat and messages to active task lifecycle states', () => {
  const rulesPath = join(__dirname, '../../firestore.rules');
  const rules = readFileSync(rulesPath, 'utf-8');

  // 1. isTaskChatActive helper exists
  assert.ok(
    rules.includes('function isTaskChatActive(chatId)'),
    'firestore.rules must define isTaskChatActive(chatId) helper',
  );

  // 2. isTaskChatActive allows ONLY accepted and in_progress
  assert.ok(
    rules.includes("taskDoc.data.status in ['accepted', 'in_progress']"),
    'isTaskChatActive must restrict status strictly to accepted and in_progress',
  );

  // 3. canPostMessage enforces isTaskChatActive
  const canPostMatch = rules.match(/function canPostMessage\(chatId\) \{([\s\S]*?)\}/);
  assert.ok(canPostMatch && canPostMatch[1], 'canPostMessage function must exist');
  assert.ok(
    canPostMatch[1].includes('isTaskChatActive(chatId)'),
    'canPostMessage must check isTaskChatActive(chatId)',
  );

  // 4. validChatCreate allows ONLY accepted and in_progress
  const validChatMatch = rules.match(/function validChatCreate\(chatId\) \{([\s\S]*?)\}/);
  assert.ok(validChatMatch && validChatMatch[1], 'validChatCreate function must exist');
  assert.ok(
    validChatMatch[1].includes("task.status in ['accepted', 'in_progress']"),
    'validChatCreate must permit chat creation only for accepted and in_progress',
  );
  assert.ok(
    !validChatMatch[1].includes("'completed'"),
    'validChatCreate must NOT permit chat creation for completed tasks',
  );

  // 5. Chat inbox preview update requires isTaskChatActive
  const chatUpdateMatch = rules.match(/match \/chats\/\{chatId\} \{([\s\S]*?)allow delete:/);
  assert.ok(chatUpdateMatch && chatUpdateMatch[1], 'chats update rule block must exist');
  assert.ok(
    chatUpdateMatch[1].includes('isTaskChatActive(chatId)'),
    'chats update rule must require isTaskChatActive(chatId)',
  );

  // 6. Messages immutability: update and delete strictly denied
  const msgBlockMatch = rules.match(/match \/messages\/\{msgId\} \{([\s\S]*?)\}/);
  assert.ok(msgBlockMatch && msgBlockMatch[1], 'messages block must exist');
  assert.ok(
    msgBlockMatch[1].includes('allow update, delete: if false;'),
    'messages must be strictly immutable for clients (allow update, delete: if false;)',
  );

  // 7. System message forge prevention: client system flag must be false
  assert.ok(
    msgBlockMatch[1].includes('request.resource.data.system == false'),
    'messages create must enforce request.resource.data.system == false',
  );

  // 8. Chat document deletion strictly denied
  assert.ok(
    rules.includes('allow delete: if false;'),
    'chat document deletion must be strictly denied',
  );
});

test('Batch 8 Client Invariants: ChatPanel.tsx enforces read-only state for non-active tasks', () => {
  const panelPath = join(__dirname, '../../src/components/ChatPanel.tsx');
  const panelSrc = readFileSync(panelPath, 'utf-8');

  // 1. readOnly definition
  assert.ok(
    panelSrc.includes("const readOnly = status !== 'accepted' && status !== 'in_progress';"),
    "ChatPanel must define readOnly based on accepted and in_progress status",
  );

  // 2. handleSend guards against readOnly
  assert.ok(
    panelSrc.includes('if (!text || sending || readOnly) return;'),
    'handleSend must guard against readOnly state',
  );

  // 3. chat doc ensure effect guards against readOnly
  assert.ok(
    panelSrc.includes('if (readOnly || ensuredRef.current) return;'),
    'chat ensure effect must guard against readOnly state',
  );
});
