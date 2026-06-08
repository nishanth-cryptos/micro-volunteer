// Read-only list of users the signed-in user has blocked.
// Governed by memory-bank/systemPatterns.md (blocks collection) and
// memory-bank/projectbrief.md feature #12 (block user / trust & safety).
//
// Block docs use deterministic id `userA_userB` (userA < userB) and are
// readable by either party per firestore.rules. We query both directions
// (userA == me, userB == me) and surface only entries the current user
// initiated (`blockedBy == uid`). Display name + photo are denormalised on
// the block doc so we don't need privileged reads on the other user.

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  type QuerySnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

interface BlockedRow {
  blockId: string;
  otherUid: string;
  otherName: string;
  // Storage path (e.g. `users/{uid}/photo`) snapshot from the block doc.
  // Resolved to a download URL via `photoUrls` state below.
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
  // Cache of resolved Storage download URLs keyed by path. `null` marks a
  // resolution attempt that failed (e.g. file missing) so we don't retry.
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const qA = query(collection(db(), 'blocks'), where('userA', '==', uid));
    const qB = query(collection(db(), 'blocks'), where('userB', '==', uid));

    const merged = new Map<string, BlockedRow>();

    function applySnapshot(snap: QuerySnapshot) {
      for (const d of snap.docs) {
        const data = d.data() as BlockDocShape;
        // Only show blocks this user initiated. Legacy docs without
        // `blockedBy` are skipped — we can't attribute them.
        if (data.blockedBy !== uid) continue;
        const callerIsA = data.userA === uid;
        const otherUid = callerIsA ? data.userB : data.userA;
        const otherName = callerIsA
          ? data.userBNameSnapshot ?? ''
          : data.userANameSnapshot ?? '';
        const otherPhotoPath = callerIsA
          ? data.userBPhotoSnapshot ?? null
          : data.userAPhotoSnapshot ?? null;
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

  // Resolve any new Storage paths into download URLs. Skip paths already
  // attempted (whether successful or null). Storage rules allow any signed-in
  // user to read /users/{uid}/photo.
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
      {rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          You haven’t blocked anyone.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => {
            const resolvedUrl = row.otherPhotoPath
              ? photoUrls[row.otherPhotoPath] ?? undefined
              : undefined;
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
              <span className="flex-shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                Blocked
              </span>
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
  if (diff < 3_600_000) return `blocked ${String(Math.floor(diff / 60_000))} min ago`;
  if (diff < 86_400_000)
    return `blocked ${String(Math.floor(diff / 3_600_000))} h ago`;
  return `blocked on ${new Date(ms).toLocaleDateString()}`;
}
