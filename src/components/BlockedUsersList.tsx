// List of users the signed-in user has blocked with Unblock action.
// Governed by memory-bank/systemPatterns.md (blocks collection) and
// memory-bank/projectbrief.md feature #12 (block user / trust & safety).

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  type QuerySnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { db, functions, storage } from '../lib/firebase';

interface BlockedRow {
  blockId: string;
  otherUid: string;
  otherName: string;
  otherPhotoPath: string | null;
  createdAt: Timestamp | null;
}

interface BlockDocShape {
  userA: string;
  userB: string;
  blockedBy?: string;
  userANameSnapshot?: string;
  userAPhotoSnapshot?: string | null;
  userBNameSnapshot?: string;
  userBPhotoSnapshot?: string | null;
  createdAt: Timestamp | null;
}

interface Props {
  uid: string;
}

export function BlockedUsersList({ uid }: Props) {
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unblockError, setUnblockError] = useState<string | null>(null);
  const [busyBlockIds, setBusyBlockIds] = useState<Set<string>>(new Set());
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const qA = query(collection(db(), 'blocks'), where('userA', '==', uid));
    const qB = query(collection(db(), 'blocks'), where('userB', '==', uid));

    const merged = new Map<string, BlockedRow>();

    function applySnapshot(snap: QuerySnapshot) {
      for (const d of snap.docs) {
        const data = d.data() as BlockDocShape;
        if (data.blockedBy !== uid) continue;
        const callerIsA = data.userA === uid;
        const otherUid = callerIsA ? data.userB : data.userA;
        const otherName = callerIsA
          ? (data.userBNameSnapshot ?? '')
          : (data.userANameSnapshot ?? '');
        const otherPhotoPath = callerIsA
          ? (data.userBPhotoSnapshot ?? null)
          : (data.userAPhotoSnapshot ?? null);
        merged.set(d.id, {
          blockId: d.id,
          otherUid,
          otherName,
          otherPhotoPath,
          createdAt: data.createdAt,
        });
      }
      setRows(
        [...merged.values()].sort((a, b) => {
          const ma = a.createdAt?.toMillis() ?? 0;
          const mb = b.createdAt?.toMillis() ?? 0;
          return mb - ma;
        }),
      );
    }

    const unsubA = onSnapshot(
      qA,
      (snap) => applySnapshot(snap),
      (err) => setError(err.message),
    );
    const unsubB = onSnapshot(
      qB,
      (snap) => applySnapshot(snap),
      (err) => setError(err.message),
    );
    return () => {
      unsubA();
      unsubB();
      merged.clear();
    };
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    const unresolved = rows
      .map((r) => r.otherPhotoPath)
      .filter((p): p is string => Boolean(p) && !(p! in photoUrls));
    if (unresolved.length === 0) return;
    void Promise.all(
      unresolved.map(async (path) => {
        try {
          const url = await getDownloadURL(storageRef(storage(), path));
          return [path, url] as const;
        } catch {
          return [path, null] as const;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [path, url] of results) {
          next[path] = url;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [rows, photoUrls]);

  async function handleUnblock(otherUid: string, blockId: string) {
    setUnblockError(null);
    setBusyBlockIds((prev) => new Set(prev).add(blockId));
    try {
      const fn = httpsCallable<{ blockedUserId: string }, { success: boolean }>(
        functions(),
        'unblockUser',
      );
      await fn({ blockedUserId: otherUid });
    } catch (err) {
      setUnblockError(
        err instanceof Error ? err.message : 'Could not unblock user.',
      );
    } finally {
      setBusyBlockIds((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
    }
  }

  if (error) {
    return (
      <p role="alert" className="mt-3 text-sm text-red-700">
        Couldn’t load blocked users: {error}
      </p>
    );
  }

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-neutral-900">Blocked users</h2>
      <p className="mt-1 text-sm text-neutral-600">
        These users won’t be matched with you, and you won’t see them in your
        nearby volunteer list.
      </p>

      {unblockError && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-[#fdf0ef] p-3 text-xs text-[#a32a22]"
        >
          {unblockError}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          You haven’t blocked anyone.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => {
            const resolvedUrl = row.otherPhotoPath
              ? (photoUrls[row.otherPhotoPath] ?? undefined)
              : undefined;
            const isBusy = busyBlockIds.has(row.blockId);

            return (
              <li
                key={row.blockId}
                className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-neutral-200">
                  {resolvedUrl ? (
                    <img
                      src={resolvedUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-full w-full items-center justify-center text-sm font-semibold text-neutral-500"
                    >
                      {(row.otherName || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {row.otherName || 'Blocked user'}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {formatWhen(row.createdAt)}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                    Blocked
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void handleUnblock(row.otherUid, row.blockId)
                    }
                    disabled={isBusy}
                    className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 disabled:opacity-50"
                  >
                    {isBusy ? 'Unblocking…' : 'Unblock'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatWhen(t: Timestamp | null): string {
  if (!t) return 'just now';
  const ms = t.toMillis();
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just blocked';
  if (diff < 3_600_000)
    return `blocked ${String(Math.floor(diff / 60_000))} min ago`;
  if (diff < 86_400_000)
    return `blocked ${String(Math.floor(diff / 3_600_000))} h ago`;
  return `blocked on ${new Date(ms).toLocaleDateString()}`;
}
