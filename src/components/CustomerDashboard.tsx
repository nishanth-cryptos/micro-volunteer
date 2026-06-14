// CustomerDashboard — design ported from the Claude Design handoff bundle
// (volunteer/project/Volunteer Dashboard.html, chat 2026-06-14).
// Key responsibilities:
//   - Top greeting + live indicator
//   - Real Leaflet/OSM map card showing the customer's lastKnownLocation
//     (no volunteer pins — privacy; out of scope per design Q&A 2026-06-14)
//   - "Post a task" CTA
//   - Ongoing tasks: customer's tasks filtered to searching / accepted /
//     in_progress
//   - Profile screen with hero (Tasks posted + Completion %), customer
//     details (phone + email only), and Past tasks tabs
//     (All / Completed / Accepted / Rejected / Blocked)
//   - Floating bottom-nav pill (Tasks / Profile)
// Governs: memory-bank/systemPatterns.md (UI patterns, server-authoritative
// task data, no PII logging).

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { auth, db } from '../lib/firebase';
import type { UserDoc } from '../lib/auth-context';

// Leaflet default-icon fix (same pattern as TaskLocationPicker).
interface DefaultIconProto {
  _getIconUrl?: unknown;
}
delete (L.Icon.Default.prototype as DefaultIconProto)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const FALLBACK_CENTER: { lat: number; lng: number } = {
  lat: 19.076,
  lng: 72.8777,
};

type TaskStatus =
  | 'searching'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  riskLevel: 'low' | 'medium';
  createdAt: Timestamp | null;
  completedAt?: Timestamp | null;
  acceptedVolunteerId?: string | null;
}

type ScreenKey = 'tasks' | 'profile';

type HistoryFilter = 'all' | 'completed' | 'accepted' | 'blocked';

interface Props {
  uid: string;
  userDoc: UserDoc;
}

export function CustomerDashboard({ uid, userDoc }: Props) {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<ScreenKey>('tasks');
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [blockedCount, setBlockedCount] = useState<number>(0);
  const [filter, setFilter] = useState<HistoryFilter>('all');

  // Subscribe to all of the customer's tasks ordered by createdAt desc.
  // Rules restrict reads to the owning customer; composite index already
  // declared (customerId ASC, createdAt DESC).
  useEffect(() => {
    const q = query(
      collection(db(), 'tasks'),
      where('customerId', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRows(
        snap.docs.map((d) => {
          const data = d.data() as {
            title: string;
            status: TaskStatus;
            riskLevel: 'low' | 'medium';
            createdAt: Timestamp | null;
            completedAt?: Timestamp | null;
            acceptedVolunteerId?: string | null;
          };
          return {
            id: d.id,
            title: data.title,
            status: data.status,
            riskLevel: data.riskLevel,
            createdAt: data.createdAt,
            completedAt: data.completedAt ?? null,
            acceptedVolunteerId: data.acceptedVolunteerId ?? null,
          };
        }),
      );
    });
    return unsub;
  }, [uid]);

  // Subscribe to blocks initiated by this customer for the "Blocked" tab
  // count and list. Rules already restrict block reads to participants.
  useEffect(() => {
    const q = query(
      collection(db(), 'blocks'),
      where('blockedBy', '==', uid),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setBlockedCount(snap.size),
      () => setBlockedCount(0),
    );
    return unsub;
  }, [uid]);

  const ongoing = rows.filter(
    (r) =>
      r.status === 'searching' ||
      r.status === 'accepted' ||
      r.status === 'in_progress',
  );
  const past = rows.filter(
    (r) =>
      r.status === 'completed' ||
      r.status === 'cancelled' ||
      r.status === 'expired',
  );

  // History buckets — map Firestore statuses onto the design's tabs.
  // "Accepted" in the design groups currently-accepted-but-not-completed
  // history; in our schema those are still in `ongoing`, so we surface
  // tasks that were *accepted* before being cancelled/expired as well as
  // anything that ended without a `completed` flip. "Rejected" maps to
  const historyBuckets = useMemo(() => {
    const completed = past.filter((r) => r.status === 'completed');
    const accepted = ongoing.filter(
      (r) => r.status === 'accepted' || r.status === 'in_progress',
    );
    return { completed, accepted };
  }, [ongoing, past]);

  const counts: Record<HistoryFilter, number> = {
    all:
      historyBuckets.completed.length +
      historyBuckets.accepted.length +
      blockedCount,
    completed: historyBuckets.completed.length,
    accepted: historyBuckets.accepted.length,
    blocked: blockedCount,
  };

  const completionPct =
    rows.length === 0
      ? null
      : Math.round((historyBuckets.completed.length / rows.length) * 100);

  async function handleSignOut() {
    await signOut(auth());
    void navigate('/', { replace: true });
  }

  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#131312]">
      <TopBar initial={initialOf(userDoc.displayName)} />
      <div className="mx-auto max-w-7xl px-8 pt-10 pb-[124px]">
        {screen === 'tasks' && (
          <TasksScreen
            userDoc={userDoc}
            ongoing={ongoing}
            ongoingCount={ongoing.length}
          />
        )}
        {screen === 'profile' && (
          <ProfileScreen
            userDoc={userDoc}
            tasksPosted={rows.length}
            completionPct={completionPct}
            buckets={historyBuckets}
            blockedCount={blockedCount}
            counts={counts}
            filter={filter}
            onFilter={setFilter}
            onSignOut={() => void handleSignOut()}
          />
        )}
      </div>
      <BottomNav
        screen={screen}
        ongoingCount={ongoing.length}
        onChange={(next) => {
          setScreen(next);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </main>
  );
}

// ----- Top bar ---------------------------------------------------------

function TopBar({ initial }: { initial: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#ececea] bg-white px-7">
      <div className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight">
        <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-gradient-to-br from-[#1f6f5c] to-[#185845] text-white">
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </span>
        Volunteer Connector
      </div>
      <div className="flex items-center gap-3.5 text-[13px] text-[#4f4b46]">
        <span
          className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-xs font-bold text-[#5a2900]"
          aria-hidden="true"
        >
          {initial}
        </span>
      </div>
    </header>
  );
}

// ----- Tasks screen ----------------------------------------------------

function TasksScreen({
  userDoc,
  ongoing,
  ongoingCount,
}: {
  userDoc: UserDoc;
  ongoing: TaskRow[];
  ongoingCount: number;
}) {
  const name = userDoc.displayName ?? 'there';
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[32px] font-bold tracking-tight">
            Welcome, {name}.
          </h1>
          <p className="mt-1.5 text-sm text-[#4f4b46]">
            Post a small task and we&apos;ll find a nearby hand.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[#8a847d]">
          <LiveDot />
          Live
        </div>
      </div>

      <MapCard userDoc={userDoc} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PostCta />
        </div>

        <div className="lg:col-span-2">
          <div className="mb-3.5 flex items-baseline justify-between">
            <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8a847d]">
              Ongoing tasks
            </h2>
            <span className="font-mono text-xs text-[#8a847d]">
              {ongoingCount} active
            </span>
          </div>

          {ongoing.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#ececea] px-4 py-7 text-center text-[13px] text-[#8a847d]">
              No active tasks. Post one and we&apos;ll start searching.
            </div>
          ) : (
            ongoing.map((t) => <OngoingTaskCard key={t.id} task={t} />)
          )}
        </div>
      </div>
    </section>
  );
}

function LiveDot() {
  return (
    <span className="relative inline-block h-2 w-2">
      <span className="absolute inset-0 rounded-full bg-[#1f6f5c]" />
      <span
        className="absolute inset-[-4px] animate-ping rounded-full bg-[#1f6f5c] opacity-25"
        aria-hidden="true"
      />
    </span>
  );
}

function MapCard({ userDoc }: { userDoc: UserDoc }) {
  const loc = userDoc.lastKnownLocation;
  const center = loc ? { lat: loc.lat, lng: loc.lng } : FALLBACK_CENTER;
  const hasPin = Boolean(loc);
  const addressText = hasPin
    ? `${loc!.lat.toFixed(4)}, ${loc!.lng.toFixed(4)}`
    : 'No location set yet';

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#ececea] bg-white">
      <div className="relative h-[clamp(360px,55vh,640px)]">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={hasPin ? 14 : 11}
          className="h-full w-full"
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapCenterer center={center} />
          {hasPin && <Marker position={[center.lat, center.lng]} />}
        </MapContainer>
        {!hasPin && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/55">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#4f4b46] shadow">
              Set your location to see nearby
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[#ececea] bg-white px-[18px] py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#1f6f5c] ring-[3px] ring-[#1f6f5c]/20"
            aria-hidden="true"
          />
          <span className="truncate text-[13px] font-medium text-[#131312]">
            {addressText}
          </span>
        </div>
      </div>
    </div>
  );
}

function MapCenterer({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center.lat, center.lng, map]);
  return null;
}

function PostCta() {
  return (
    <Link
      to="/create-task"
      className="relative block overflow-hidden rounded-[18px] bg-gradient-to-b from-[#1f6f5c] to-[#185845] px-6 py-5 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
    >
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/5"
        aria-hidden="true"
      />
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[14px] bg-white/15">
          <svg
            viewBox="0 0 24 24"
            className="h-[22px] w-[22px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="block text-[15px] font-semibold leading-tight">
          Need a hand with something?
        </span>
      </div>
      <p className="mt-3 text-[13px] opacity-80">
        Post a small task and we&apos;ll find a nearby volunteer.
      </p>
      <span className="mt-4 inline-block rounded-full bg-white px-[18px] py-2 text-[13px] font-semibold text-[#1f6f5c]">
        Post a task
      </span>
    </Link>
  );
}

function OngoingTaskCard({ task }: { task: TaskRow }) {
  const isSearching = task.status === 'searching';
  const ringBg = isSearching ? 'bg-[#e8effb]' : 'bg-[#e3efe9]';
  const ringInk = isSearching ? 'text-[#1f4baa]' : 'text-[#1f6f5c]';
  const badgeBg = isSearching ? 'bg-[#e8effb]' : 'bg-[#e3efe9]';
  const badgeInk = isSearching ? 'text-[#1f4baa]' : 'text-[#1f6f5c]';

  const subParts: string[] = [];
  if (task.createdAt) subParts.push(elapsedShort(task.createdAt));
  subParts.push(task.riskLevel === 'medium' ? 'Medium' : 'Low');

  return (
    <Link
      to={`/tasks/${task.id}`}
      className="mb-2.5 flex cursor-pointer items-center gap-3.5 rounded-2xl border border-[#ececea] bg-white px-[18px] py-4 transition hover:border-[#d8d4cc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#131312] focus-visible:ring-offset-2"
    >
      <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full ${ringBg}`}>
        {isSearching ? (
          <svg
            viewBox="0 0 24 24"
            className={`h-[18px] w-[18px] ${ringInk}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className={`h-[18px] w-[18px] ${ringInk}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-[#131312]">
          {task.title || 'Untitled task'}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-[#8a847d]">
          {isSearching && <PulseDot />}
          {isSearching && <>Searching nearby</>}
          {!isSearching && task.status === 'accepted' && <>Volunteer assigned</>}
          {!isSearching && task.status === 'in_progress' && <>In progress</>}
          {subParts.map((p, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="opacity-40">·</span>
              {p}
            </span>
          ))}
        </span>
      </span>
      <span
        className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${badgeBg} ${badgeInk}`}
      >
        {labelForStatus(task.status)}
      </span>
    </Link>
  );
}

function PulseDot() {
  return (
    <span className="relative inline-block h-2 w-2 flex-shrink-0">
      <span className="absolute inset-0 rounded-full bg-[#1f4baa]" />
      <span
        className="absolute inset-[-3px] animate-ping rounded-full bg-[#1f4baa] opacity-30"
        aria-hidden="true"
      />
    </span>
  );
}

// ----- Profile screen --------------------------------------------------

interface HistoryBuckets {
  completed: TaskRow[];
  accepted: TaskRow[];
}

function ProfileScreen({
  userDoc,
  tasksPosted,
  completionPct,
  buckets,
  blockedCount,
  counts,
  filter,
  onFilter,
  onSignOut,
}: {
  userDoc: UserDoc;
  tasksPosted: number;
  completionPct: number | null;
  buckets: HistoryBuckets;
  blockedCount: number;
  counts: Record<HistoryFilter, number>;
  filter: HistoryFilter;
  onFilter: (f: HistoryFilter) => void;
  onSignOut: () => void;
}) {
  const verified =
    userDoc.phoneNumber !== undefined ||
    (userDoc.email !== undefined && userDoc.email !== '');

  return (
    <section>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[32px] font-bold tracking-tight">
            Your profile
          </h1>
          <p className="mt-1.5 text-sm text-[#4f4b46]">
            Your details and task history.
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1f6f5c] to-[#15493b] px-7 py-7 text-white lg:col-span-1">
          <span
            className="pointer-events-none absolute -right-16 -top-16 h-[220px] w-[220px] rounded-full bg-white/5"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -bottom-20 right-10 h-40 w-40 rounded-full bg-white/[0.04]"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-[18px]">
            <span className="grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-white/25 bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-[28px] font-bold text-[#5a2900]">
              {initialOf(userDoc.displayName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-2xl font-bold tracking-tight">
                {userDoc.displayName ?? 'You'}
              </div>
              <div className="mt-1 truncate text-[13px] opacity-80">
                Member · Volunteer Connector
              </div>
              {verified && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Verified contact
                </span>
              )}
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-5">
            <div>
              <div className="font-mono text-[26px] font-bold tracking-tight">
                {tasksPosted}
              </div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] opacity-80">
                Tasks posted
              </div>
            </div>
            <div>
              <div className="font-mono text-[26px] font-bold tracking-tight">
                {completionPct === null ? '—' : `${completionPct}%`}
              </div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] opacity-80">
                Completion
              </div>
            </div>
          </div>
        </div>

        {/* Customer details + sign out */}
        <div className="lg:col-span-2">
          <div className="mb-3.5 flex items-baseline justify-between">
            <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8a847d]">
              Customer details
            </h2>
          </div>
          <div className="overflow-hidden rounded-[18px] border border-[#ececea] bg-white">
            <DetailRow
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-[#1f6f5c]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z" />
                </svg>
              }
              label="Phone"
              value={userDoc.phoneNumber ?? 'Not set'}
            />
            <DetailRow
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-[#1f6f5c]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 6L2 7" />
                </svg>
              }
              label="Email"
              value={userDoc.email ?? 'Not set'}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-full border border-[#ececea] bg-transparent px-[22px] py-2.5 text-[13px] font-medium text-[#4f4b46] transition hover:border-[#f0c4c0] hover:bg-[#fdf0ef] hover:text-[#a32a22]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Past tasks */}
      <div className="mb-3.5 flex items-baseline justify-between">
        <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8a847d]">
          Past tasks
        </h2>
        <span className="font-mono text-xs text-[#8a847d]">
          {counts.all} total
        </span>
      </div>
      <div className="mb-[18px] flex max-w-2xl gap-0.5 rounded-xl bg-[#f3f1ec] p-1.5">
        {(
          [
            ['all', 'All'],
            ['completed', 'Completed'],
            ['accepted', 'Accepted'],
            ['blocked', 'Blocked'],
          ] as Array<[HistoryFilter, string]>
        ).map(([key, label]) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilter(key)}
              className={
                'flex-1 rounded-[9px] px-1.5 py-2.5 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#131312] focus-visible:ring-offset-2 ' +
                (active
                  ? 'bg-white text-[#131312] shadow-sm'
                  : 'bg-transparent text-[#4f4b46]')
              }
              aria-pressed={active}
            >
              {label}{' '}
              <span
                className={
                  'ml-1 inline-block rounded-full px-1.5 py-px font-mono text-[10px] ' +
                  (active
                    ? 'bg-[#e3efe9] text-[#1f6f5c]'
                    : 'bg-[#ececea] text-[#8a847d]')
                }
              >
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      <HistoryList
        filter={filter}
        buckets={buckets}
        blockedCount={blockedCount}
      />
    </section>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-[#f3f1ec] px-[18px] py-4 last:border-b-0">
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] bg-[#e3efe9]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a847d]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-medium text-[#131312]">
          {value}
        </div>
      </div>
    </div>
  );
}

function HistoryList({
  filter,
  buckets,
  blockedCount,
}: {
  filter: HistoryFilter;
  buckets: HistoryBuckets;
  blockedCount: number;
}) {
  let items: Array<{
    key: string;
    title: string;
    sub: string;
    badge: { label: string; bg: string; ink: string };
  }> = [];

  function row(task: TaskRow, status: 'completed' | 'accepted') {
    const when = task.completedAt ?? task.createdAt;
    return {
      key: task.id,
      title: task.title || 'Untitled task',
      sub: `${formatDate(when)} · ${task.riskLevel === 'medium' ? 'Medium' : 'Low'} priority`,
      badge: badgeForHistoryStatus(status),
    };
  }

  if (filter === 'all') {
    items = [
      ...buckets.completed.map((t) => row(t, 'completed')),
      ...buckets.accepted.map((t) => row(t, 'accepted')),
    ];
    if (blockedCount > 0) {
      items.push({
        key: '__blocked',
        title: `${blockedCount} blocked ${blockedCount === 1 ? 'user' : 'users'}`,
        sub: 'These users can no longer be matched with your tasks',
        badge: badgeForHistoryStatus('blocked'),
      });
    }
  } else if (filter === 'completed') {
    items = buckets.completed.map((t) => row(t, 'completed'));
  } else if (filter === 'accepted') {
    items = buckets.accepted.map((t) => row(t, 'accepted'));
  } else if (filter === 'blocked') {
    if (blockedCount > 0) {
      items = [
        {
          key: '__blocked',
          title: `${blockedCount} blocked ${blockedCount === 1 ? 'user' : 'users'}`,
          sub: 'Manage blocks from your task details pages',
          badge: badgeForHistoryStatus('blocked'),
        },
      ];
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#ececea] px-4 py-7 text-center text-[13px] text-[#8a847d]">
        No {filter === 'all' ? '' : filter} {filter === 'blocked' ? 'users' : 'tasks'} yet.
      </div>
    );
  }

  return (
    <div>
      {items.map((row) => (
        <div
          key={row.key}
          className="mb-2.5 flex items-center gap-3.5 rounded-2xl border border-[#ececea] bg-white px-[18px] py-4"
        >
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-[#e3efe9]">
            <svg
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px] text-[#1f6f5c]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-[#131312]">
              {row.title}
            </span>
            <span className="mt-0.5 block truncate text-xs text-[#8a847d]">
              {row.sub}
            </span>
          </span>
          <span
            className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${row.badge.bg} ${row.badge.ink}`}
          >
            {row.badge.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ----- Bottom nav ------------------------------------------------------

function BottomNav({
  screen,
  ongoingCount,
  onChange,
}: {
  screen: ScreenKey;
  ongoingCount: number;
  onChange: (next: ScreenKey) => void;
}) {
  return (
    <nav
      className="fixed bottom-[18px] left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full border border-[#ececea] bg-white p-1.5 shadow-[0_12px_32px_-10px_rgba(20,18,15,0.18),0_4px_10px_-4px_rgba(20,18,15,0.08)]"
      aria-label="Primary"
    >
      <NavButton
        active={screen === 'tasks'}
        onClick={() => onChange('tasks')}
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        }
        label="Tasks"
        badge={ongoingCount > 0 ? String(ongoingCount) : null}
      />
      <NavButton
        active={screen === 'profile'}
        onClick={() => onChange('profile')}
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        }
        label="Profile"
        badge={null}
      />
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-2 rounded-full px-[22px] py-2.5 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
        (active
          ? 'bg-[#131312] text-white focus-visible:ring-white'
          : 'bg-transparent text-[#8a847d] hover:text-[#131312] focus-visible:ring-[#131312]')
      }
      aria-pressed={active}
    >
      {icon}
      {label}
      {badge && (
        <span className="rounded-full bg-[#1f6f5c] px-1.5 py-[1px] font-mono text-[10px] leading-tight text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

// ----- Helpers ---------------------------------------------------------

function initialOf(name: string | undefined): string {
  if (!name) return 'U';
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  return trimmed[0]?.toUpperCase() ?? 'U';
}

function labelForStatus(s: TaskStatus): string {
  switch (s) {
    case 'searching':
      return 'Searching';
    case 'accepted':
      return 'Accepted';
    case 'in_progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
  }
}

function elapsedShort(t: Timestamp): string {
  const diff = Date.now() - t.toMillis();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${String(Math.floor(diff / 60_000))} min elapsed`;
  if (diff < 86_400_000) return `${String(Math.floor(diff / 3_600_000))} h elapsed`;
  return new Date(t.toMillis()).toLocaleDateString();
}

function formatDate(t: Timestamp | null | undefined): string {
  if (!t) return '—';
  return new Date(t.toMillis()).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function badgeForHistoryStatus(
  s: 'completed' | 'accepted' | 'blocked',
): { label: string; bg: string; ink: string } {
  switch (s) {
    case 'completed':
      return { label: 'Completed', bg: 'bg-[#e3efe9]', ink: 'text-[#1f6f5c]' };
    case 'accepted':
      return { label: 'Accepted', bg: 'bg-[#e3efe9]', ink: 'text-[#1f6f5c]' };
    case 'blocked':
      return { label: 'Blocked', bg: 'bg-[#f1ede6]', ink: 'text-[#4f4b46]' };
  }
}

