// Live list of the signed-in customer's recently-posted tasks.
// Subscribes to tasks where customerId == uid ordered by createdAt desc,
// limit 10. Rules already restrict read to the owning customer.
// Composite index (customerId ASC, createdAt DESC) is declared in
// firestore.indexes.json.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

type TaskStatus =
  | 'searching'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

interface TaskListRow {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: Timestamp | null;
  riskLevel: 'low' | 'medium';
}

interface Props {
  uid: string;
}

export function MyTasksList({ uid }: Props) {
  const [rows, setRows] = useState<TaskListRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db(), 'tasks'),
      where('customerId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(10),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data() as {
              title: string;
              status: TaskStatus;
              createdAt: Timestamp | null;
              riskLevel: 'low' | 'medium';
            };
            return {
              id: d.id,
              title: data.title,
              status: data.status,
              createdAt: data.createdAt,
              riskLevel: data.riskLevel,
            };
          }),
        );
      },
      (err) => setError(err.message),
    );
    return unsub;
  }, [uid]);

  if (error) {
    return (
      <p role="alert" className="mt-3 text-sm text-red-700">
        Couldn’t load your tasks: {error}
      </p>
    );
  }

  if (rows.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-neutral-900">Your tasks</h2>
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              to={`/tasks/${row.id}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-neutral-900">
                  {row.title || 'Untitled task'}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatWhen(row.createdAt)} ·{' '}
                  <span
                    className={
                      row.riskLevel === 'medium'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }
                  >
                    {row.riskLevel === 'medium' ? 'Medium' : 'Low'}
                  </span>
                </p>
              </div>
              <StatusBadge status={row.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const palette: Record<TaskStatus, string> = {
    searching: 'bg-blue-100 text-blue-800',
    accepted: 'bg-violet-100 text-violet-800',
    in_progress: 'bg-amber-100 text-amber-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-neutral-200 text-neutral-700',
    expired: 'bg-neutral-200 text-neutral-700',
  };
  const label: Record<TaskStatus, string> = {
    searching: 'Searching',
    accepted: 'Accepted',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  return (
    <span
      className={
        'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium ' +
        palette[status]
      }
    >
      {label[status]}
    </span>
  );
}

function formatWhen(t: Timestamp | null): string {
  if (!t) return 'just now';
  const ms = t.toMillis();
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${String(Math.floor(diff / 60_000))} min ago`;
  if (diff < 86_400_000) return `${String(Math.floor(diff / 3_600_000))} h ago`;
  return new Date(ms).toLocaleDateString();
}
