// M7 in-app chat — server-side helpers.
// Purpose: create the per-task chat on acceptance and write lifecycle
//   system messages (connect / started / completed) via the Admin SDK,
//   which bypasses the participant-only Firestore rules.
// Key responsibilities:
//   - ensureChatForTask: idempotent chat creation; wipes the old
//     conversation if the task was reassigned to a different volunteer so
//     the new volunteer never sees the previous pair's messages.
//   - appendSystemMessage: append a system message + refresh inbox preview.
// Governs: memory-bank/systemPatterns.md (chats/{chatId} + messages shapes).
// NEVER log message text, display names, or UIDs from this module.

const PREVIEW_MAX = 120;


function preview(text: string): string {
  const t = text.trim();
  return t.length > PREVIEW_MAX ? `${t.slice(0, PREVIEW_MAX - 1)}…` : t;
}

/**
 * Ensure chats/{taskId} exists with the current participants. If a chat
 * already exists for the same pair it's a no-op. If it exists for a
 * DIFFERENT volunteer (task was reassigned), its messages are recursively
 * deleted before the doc is re-created so the new volunteer never inherits
 * the previous conversation.
 */
export async function ensureChatForTask(
  db: FirebaseFirestore.Firestore,
  taskId: string,
  customerId: string,
  volunteerId: string,
): Promise<void> {
  const chatRef = db.collection('chats').doc(taskId);
  const snap = await chatRef.get();

  if (snap.exists) {
    const data = snap.data() as { participants?: string[] };
    const participants = data.participants ?? [];
    if (
      participants.includes(volunteerId) &&
      participants.includes(customerId)
    ) {
      return; // already set up for this pair
    }
    // Reassigned to a new volunteer — drop the stale conversation.
    await db.recursiveDelete(chatRef.collection('messages'));
  }

  await chatRef.set({
    taskId,
    participants: [customerId, volunteerId],
    createdAt: new Date(),
    lastMessageAt: new Date(),
    lastMessagePreview: '',
  });
}

/**
 * Append a system message to a task's chat and refresh the inbox preview.
 * Best-effort: if the chat doesn't exist yet the write is skipped (the
 * caller should ensureChatForTask first when it matters).
 */
export async function appendSystemMessage(
  db: FirebaseFirestore.Firestore,
  taskId: string,
  text: string,
): Promise<void> {
  const chatRef = db.collection('chats').doc(taskId);
  const snap = await chatRef.get();
  if (!snap.exists) return;

  await chatRef.collection('messages').add({
    senderUid: 'system',
    text,
    system: true,
    sentAt: new Date(),
  });
  await chatRef.update({
    lastMessageAt: new Date(),
    lastMessagePreview: preview(text),
  });
}


