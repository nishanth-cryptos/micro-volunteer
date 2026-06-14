// M7 in-app chat panel.
// Purpose: live 1:1 conversation between a task's customer and its accepted
//   volunteer. Opens only after acceptance (status accepted/in_progress);
//   read-only once the task is completed/cancelled/expired.
// Key responsibilities:
//   - Subscribe to chats/{taskId}/messages (ordered by sentAt).
//   - Send participant messages (client-direct writes, guarded by rules).
//   - Ensure the chat doc exists for legacy/seeded accepted tasks.
//   - Surface report (per-message + user-level via ReportBlockPanel) and
//     block (customer-only) actions in the header.
//   - Disable composing when either party has blocked the other.
// Governs: memory-bank/systemPatterns.md (chats/{chatId} + messages shapes,
//   "Chat: opens after acceptance; report/block in the header").

import { useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { ReportBlockPanel } from './ReportBlockPanel';

type TaskStatus =
  | 'searching'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

interface ChatMessage {
  id: string;
  senderUid: string;
  text: string;
  system?: boolean;
  sentAt: Timestamp | null;
  reportedBy?: string[];
}

interface ChatPanelProps {
  taskId: string;
  customerId: string;
  acceptedVolunteerId: string;
  status: TaskStatus;
  viewerUid: string;
  viewerRole: 'customer' | 'volunteer';
  otherPartyUid: string;
  otherPartyName: string;
  // Whether reporting is allowed for this viewer right now (window + role
  // gate computed by the parent; the server re-checks regardless).
  canReport: boolean;
}

const PREVIEW_MAX = 120;

function makePreview(text: string): string {
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text;
}

function formatTime(ts: Timestamp | null): string {
  if (!ts) return '';
  try {
    return ts
      .toDate()
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ChatPanel({
  taskId,
  customerId,
  acceptedVolunteerId,
  status,
  viewerUid,
  viewerRole,
  otherPartyUid,
  otherPartyName,
  canReport,
}: ChatPanelProps) {
  const readOnly = status !== 'accepted' && status !== 'in_progress';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-message report modal.
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const [msgReason, setMsgReason] = useState('inappropriate');
  const [msgDetails, setMsgDetails] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [msgDone, setMsgDone] = useState(false);

  const ensuredRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to the message stream.
  useEffect(() => {
    const chatRef = doc(db(), 'chats', taskId);
    const messagesQ = query(
      collection(chatRef, 'messages'),
      orderBy('sentAt', 'asc'),
    );
    const unsub = onSnapshot(
      messagesQ,
      (snap) => {
        setMessages(
          snap.docs.map((d) => {
            const data = d.data() as Omit<ChatMessage, 'id'>;
            return { id: d.id, ...data };
          }),
        );
        setLoadError(null);
      },
      (err) => setLoadError(err.message),
    );
    return () => unsub();
  }, [taskId]);

  // Ensure the chat doc exists. New accepts create it server-side in
  // acceptOffer; this covers legacy/seeded tasks accepted before M7. A
  // concurrent create (server or another tab) is harmless.
  useEffect(() => {
    if (readOnly || ensuredRef.current) return;
    ensuredRef.current = true;
    const chatRef = doc(db(), 'chats', taskId);
    void (async () => {
      try {
        const snap = await getDoc(chatRef);
        if (!snap.exists()) {
          await setDoc(chatRef, {
            taskId,
            participants: [customerId, acceptedVolunteerId],
            createdAt: serverTimestamp(),
            lastMessageAt: serverTimestamp(),
            lastMessagePreview: '',
          });
        }
      } catch {
        // Listener will pick up the chat regardless of who created it.
      }
    })();
  }, [taskId, customerId, acceptedVolunteerId, readOnly]);

  // Subscribe to the mutual-block doc (deterministic sorted id).
  useEffect(() => {
    const blockId = [viewerUid, otherPartyUid].sort().join('_');
    const unsub = onSnapshot(
      doc(db(), 'blocks', blockId),
      (snap) => setIsBlocked(snap.exists()),
      () => setIsBlocked(false),
    );
    return () => unsub();
  }, [viewerUid, otherPartyUid]);

  // Keep the latest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSendError(null);
    setSending(true);
    try {
      const chatRef = doc(db(), 'chats', taskId);
      await addDoc(collection(chatRef, 'messages'), {
        senderUid: viewerUid,
        text,
        system: false,
        sentAt: serverTimestamp(),
      });
      await updateDoc(chatRef, {
        lastMessageAt: serverTimestamp(),
        lastMessagePreview: makePreview(text),
      });
      setDraft('');
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : 'Could not send. Try again.',
      );
    } finally {
      setSending(false);
    }
  }

  function closeMsgModal() {
    setReportTarget(null);
    setMsgDetails('');
    setMsgReason('inappropriate');
    setMsgError(null);
    setMsgDone(false);
  }

  async function submitMessageReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportTarget) return;
    setMsgError(null);
    setMsgBusy(true);
    try {
      const fn = httpsCallable<
        {
          reportedUserId: string;
          taskId: string;
          reason: string;
          details: string;
          messageRef: string;
        },
        { reportId: string }
      >(functions(), 'reportUser');
      await fn({
        reportedUserId: otherPartyUid,
        taskId,
        reason: msgReason,
        details: msgDetails,
        messageRef: `chats/${taskId}/messages/${reportTarget.id}`,
      });
      setMsgDone(true);
      setTimeout(() => closeMsgModal(), 2500);
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === 'functions/already-exists') {
        setMsgError('You’ve already reported this user on this task.');
      } else {
        setMsgError(
          err instanceof Error
            ? err.message
            : 'Could not submit report. Try again.',
        );
      }
    } finally {
      setMsgBusy(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-700">
            {otherPartyName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-900">
              {otherPartyName}
            </p>
            <p className="text-xs text-neutral-500">
              {readOnly ? 'Conversation closed' : 'Chat'}
            </p>
          </div>
        </div>
        {!readOnly && canReport && (
          <ReportBlockPanel
            variant="inline"
            taskId={taskId}
            reportedUserId={otherPartyUid}
            reportedUserName={otherPartyName}
            viewerRole={viewerRole}
          />
        )}
      </header>

      {/* Messages */}
      <div className="flex h-80 flex-col gap-2 overflow-y-auto bg-neutral-50 px-4 py-4">
        {loadError && (
          <p role="alert" className="text-center text-xs text-red-600">
            Couldn’t load messages.
          </p>
        )}
        {!loadError && messages.length === 0 && (
          <p className="my-auto text-center text-sm text-neutral-400">
            {readOnly
              ? 'No messages were exchanged.'
              : 'No messages yet. Say hello and sort out the details.'}
          </p>
        )}
        {messages.map((m) => {
          if (m.system) {
            return (
              <div key={m.id} className="my-1 flex justify-center">
                <span className="rounded-full bg-neutral-200/70 px-3 py-1 text-center text-xs text-neutral-600">
                  {m.text}
                </span>
              </div>
            );
          }
          const mine = m.senderUid === viewerUid;
          const alreadyReported = (m.reportedBy ?? []).includes(viewerUid);
          return (
            <div
              key={m.id}
              className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? 'rounded-br-sm bg-neutral-900 text-white'
                    : 'rounded-bl-sm border border-neutral-200 bg-white text-neutral-900'
                }`}
              >
                {m.text}
              </div>
              <div className="mt-0.5 flex items-center gap-2 px-1 text-[11px] text-neutral-400">
                <span>{formatTime(m.sentAt)}</span>
                {!mine && !readOnly && canReport && !alreadyReported && (
                  <button
                    type="button"
                    onClick={() => setReportTarget(m)}
                    className="underline underline-offset-2 hover:text-red-600 focus:outline-none"
                  >
                    Report
                  </button>
                )}
                {!mine && alreadyReported && (
                  <span className="text-red-500">Reported</span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {readOnly ? (
        <p className="border-t border-neutral-200 px-5 py-3 text-center text-xs text-neutral-500">
          This conversation is read-only.
        </p>
      ) : isBlocked ? (
        <p className="border-t border-neutral-200 bg-red-50/40 px-5 py-3 text-center text-xs text-red-600">
          Messaging is disabled because this user is blocked.
        </p>
      ) : (
        <form
          onSubmit={(e) => void handleSend(e)}
          className="border-t border-neutral-200 px-3 py-3"
        >
          {sendError && (
            <p role="alert" className="mb-2 px-1 text-xs text-red-600">
              {sendError}
            </p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend(e);
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Type a message…"
              className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <button
              type="submit"
              disabled={sending || draft.trim().length === 0}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      )}

      {/* Per-message report modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-neutral-900">
              Report message
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Your report goes to an administrator. {otherPartyName} won’t know
              you reported them.
            </p>

            <blockquote className="mt-4 max-h-24 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              “{reportTarget.text}”
            </blockquote>

            {msgDone ? (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
                Report submitted. Thank you for helping keep the community safe.
              </div>
            ) : (
              <form onSubmit={(e) => void submitMessageReport(e)} className="mt-5">
                <div>
                  <label
                    htmlFor="msg-report-reason"
                    className="block text-sm font-medium text-neutral-700"
                  >
                    Reason
                  </label>
                  <select
                    id="msg-report-reason"
                    value={msgReason}
                    onChange={(e) => setMsgReason(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  >
                    <option value="inappropriate">Inappropriate behavior</option>
                    <option value="safety">Safety concern</option>
                    <option value="fraud">Fraud or scam</option>
                    <option value="other">Other reason</option>
                  </select>
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="msg-report-details"
                    className="block text-sm font-medium text-neutral-700"
                  >
                    Details (optional, max 500 characters)
                  </label>
                  <textarea
                    id="msg-report-details"
                    value={msgDetails}
                    onChange={(e) => setMsgDetails(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="What was wrong with this message?"
                    className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                {msgError && (
                  <p role="alert" className="mt-3 text-sm font-medium text-red-700">
                    {msgError}
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeMsgModal}
                    disabled={msgBusy}
                    className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={msgBusy}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none disabled:opacity-50"
                  >
                    {msgBusy ? 'Submitting…' : 'Submit report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
