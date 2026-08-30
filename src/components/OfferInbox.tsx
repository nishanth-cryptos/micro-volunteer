// Volunteer-side offer inbox. Lives on /app for volunteer / both users.
// Subscribes to collectionGroup('offers') where volunteerId == uid AND
// state == 'offered'. Each offer row is denormalised at write time by
// dispatchOffers so the inbox renders without a parent-task fetch.

import { useEffect, useState } from 'react';
import {
  collectionGroup,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { getCategory } from '../lib/catalog';

interface OfferRow {
  id: string; // path-segment doc id = volunteerId
  taskId: string;
  taskTitle: string;
  taskCategory: string;
  taskRiskLevel: 'low' | 'medium';
  distanceM: number;
  score: number;
  offeredAt: Timestamp | null;
}

interface OfferDocData {
  volunteerId: string;
  taskId: string;
  taskTitle: string;
  taskCategory: string;
  taskRiskLevel: 'low' | 'medium';
  distanceM: number;
  score: number;
  offeredAt: Timestamp | null;
  state: string;
}

interface Props {
  uid: string;
}

export function OfferInbox({ uid }: Props) {
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [busyTaskIds, setBusyTaskIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collectionGroup(db(), 'offers'),
      where('volunteerId', '==', uid),
      where('state', '==', 'offered'),
      orderBy('offeredAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data() as OfferDocData;
            return {
              id: d.id,
              taskId: data.taskId,
              taskTitle: data.taskTitle,
              taskCategory: data.taskCategory,
              taskRiskLevel: data.taskRiskLevel,
              distanceM: data.distanceM,
              score: data.score,
              offeredAt: data.offeredAt,
            };
          }),
        );
      },
      (err) => setError(err.message),
    );
    return unsub;
  }, [uid]);

  function markBusy(taskId: string, on: boolean) {
    setBusyTaskIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  async function handleAccept(taskId: string) {
    setError(null);
    markBusy(taskId, true);
    try {
      const fn = httpsCallable<{ taskId: string }, { taskId: string }>(
        functions(),
        'acceptOffer',
      );
      await fn({ taskId });
      // onSnapshot will drop the row once state flips off 'offered'.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not accept this offer.',
      );
    } finally {
      markBusy(taskId, false);
    }
  }

  async function handleReject(taskId: string) {
    setError(null);
    markBusy(taskId, true);
    try {
      const fn = httpsCallable<{ taskId: string }, { taskId: string }>(
        functions(),
        'rejectOffer',
      );
      await fn({ taskId });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not reject this offer.',
      );
    } finally {
      markBusy(taskId, false);
    }
  }

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-neutral-900">Offers for you</h2>
      {rows.length === 0 && !error && (
        <p className="mt-2 text-sm text-neutral-600">
          Nothing right now. When a nearby task matches your skills you’ll see
          it here.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const category = getCategory(row.taskCategory);
          const busy = busyTaskIds.has(row.taskId);
          return (
            <li
              key={`${row.taskId}-${row.id}`}
              className="rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">
                    {row.taskTitle || 'Untitled task'}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {category?.label ?? row.taskCategory} ·{' '}
                    <span
                      className={
                        row.taskRiskLevel === 'medium'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }
                    >
                      {row.taskRiskLevel === 'medium' ? 'Medium' : 'Low'}
                    </span>{' '}
                    · {formatDistance(row.distanceM)} away ·{' '}
                    <span className="font-medium text-neutral-700">
                      {formatFreshness(row.offeredAt)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Match score {row.score.toFixed(2)}
                  </p>
                </div>

                <div className="flex flex-shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleReject(row.taskId)}
                    disabled={busy}
                    className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAccept(row.taskId)}
                    disabled={busy}
                    className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'Accept'}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return 'unknown distance';
  if (m < 1000) return `${String(Math.round(m))} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatFreshness(ts: Timestamp | null): string {
  if (!ts) return 'posted recently';
  const diffMs = Date.now() - ts.toMillis();
  if (diffMs < 60 * 1000) return 'posted just now';
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 60) return `posted ${String(mins)} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `posted ${String(hours)}h ago`;
  return `posted ${String(Math.floor(hours / 24))}d ago`;
}
