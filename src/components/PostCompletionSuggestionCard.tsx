// Post-completion nearby task suggestions card.
// Surfaces up to 2 nearby open tasks to a volunteer immediately after they
// complete a task (verifyEndOtp).
//
// Reuses the existing accept-offer callable flow and scoring math.
// Phrased in the warm "Hey Padosi" brand voice.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { getCategory } from '../lib/catalog';

export interface SuggestedTaskData {
  taskId: string;
  title: string;
  category: string;
  customerName: string;
  distanceM: number;
  createdAt: number;
  score: number;
  scoreBreakdown: {
    distance: number;
    skill: number;
    trust: number;
    availability: number;
    pastCompletion: number;
    reportPenalty: number;
  };
}

interface Props {
  taskId: string;
  volunteerUid: string;
}

export function PostCompletionSuggestionCard({ taskId, volunteerUid }: Props) {
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const [tasks, setTasks] = useState<SuggestedTaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<Set<string>>(
    new Set(),
  );
  const [allDismissed, setAllDismissed] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchSuggestions() {
      try {
        const fn = httpsCallable<{ taskId: string }, { tasks: SuggestedTaskData[] }>(
          functions(),
          'suggestNextTasks',
        );
        const res = await fn({ taskId });
        if (isMounted) {
          setTasks(res.data.tasks || []);
        }
      } catch {
        // Fail silently per requirements (§4) if suggestions fail to load
        if (isMounted) setTasks([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchSuggestions();
    return () => {
      isMounted = false;
    };
  }, [taskId]);

  const visibleTasks = tasks.filter((t) => !dismissedTaskIds.has(t.taskId));

  if (loading || allDismissed || visibleTasks.length === 0) {
    return toastMessage ? (
      <div className="vc-fade-up mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
        {toastMessage}
      </div>
    ) : null;
  }

  async function handleAccept(suggestedTaskId: string) {
    setError(null);
    setBusyTaskId(suggestedTaskId);
    try {
      const fn = httpsCallable<{ taskId: string }, { taskId: string }>(
        functions(),
        'acceptOffer',
      );
      await fn({ taskId: suggestedTaskId });
      void navigate(`/tasks/${suggestedTaskId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not accept this task. It may no longer be available.',
      );
    } finally {
      setBusyTaskId(null);
    }
  }

  function handleDismissOne(suggestedTaskId: string) {
    setDismissedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(suggestedTaskId);
      return next;
    });
  }

  async function handleDismissAll() {
    try {
      // Flip availability toggle OFF on user doc in Firestore
      const userRef = doc(db(), 'users', volunteerUid);
      await updateDoc(userRef, { availableNow: false });
    } catch {
      /* ignore update failure */
    }
    setAllDismissed(true);
    setToastMessage('All good — see you next time!');
  }

  const isMultiple = visibleTasks.length > 1;

  return (
    <section className="vc-fade-up mt-8 rounded-3xl border border-[#ececea] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900">
            Nice work! While you’re out and about…
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {isMultiple
              ? 'You’re on a roll 🙂 A couple of neighbors nearby could use your help.'
              : 'Here is a nearby task that matches what you do best.'}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ul className="mt-5 space-y-4">
        {visibleTasks.map((t) => {
          const category = getCategory(t.category);
          const busy = busyTaskId === t.taskId;
          const distLabel = formatDistance(t.distanceM);
          const freshnessMin = Math.max(
            0,
            Math.floor((now - t.createdAt) / 60000),
          );

          const neighborCopy = t.customerName
            ? `${t.customerName}’s task is just ${distLabel} away and matches what you’re good at. Up for one more?`
            : `There’s a neighbor nearby who could use a hand with ${category?.label ?? t.category.toLowerCase()}.`;

          return (
            <li
              key={t.taskId}
              className="rounded-2xl border border-neutral-200 bg-[#fafaf8] p-5 transition hover:border-[#1f6f5c]/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900">
                      {t.title || 'Untitled task'}
                    </span>
                    <span className="text-xs text-neutral-500">
                      · posted {freshnessMin} min ago
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-neutral-700">
                    {neighborCopy}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {category?.label ?? t.category} · {distLabel} away · score{' '}
                    {t.score.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-neutral-200/80 pt-3">
                <button
                  type="button"
                  onClick={() => handleDismissOne(t.taskId)}
                  disabled={busy}
                  className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
                >
                  Not right now
                </button>
                <button
                  type="button"
                  onClick={() => void handleAccept(t.taskId)}
                  disabled={busy}
                  className="rounded-full bg-[#1f6f5c] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#15493b] disabled:opacity-50 shadow-sm"
                >
                  {busy ? 'Accepting…' : 'Accept'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex justify-center border-t border-neutral-100 pt-4">
        <button
          type="button"
          onClick={() => void handleDismissAll()}
          className="text-xs font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-900 transition"
        >
          I’m done for now
        </button>
      </div>
    </section>
  );
}

function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return 'nearby';
  if (m < 1000) return `${String(Math.round(m))} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
