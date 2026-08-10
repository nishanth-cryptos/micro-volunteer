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
import { useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QuerySnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { latLngToCell } from 'h3-js';
import { Link, useNavigate } from 'react-router-dom';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, storage } from '../lib/firebase';
import type { UserDoc } from '../lib/auth-context';
import { BlockedUsersList } from './BlockedUsersList';
import { ReasonBottomSheet } from './ReasonBottomSheet';


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
  | 'scheduled'
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
  scheduledFor?: Timestamp | null;
  completedAt?: Timestamp | null;
  acceptedVolunteerId?: string | null;
}


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
  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
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
            scheduledFor?: Timestamp | null;
            completedAt?: Timestamp | null;
            acceptedVolunteerId?: string | null;
          };
          return {
            id: d.id,
            title: data.title,
            status: data.status,
            riskLevel: data.riskLevel,
            createdAt: data.createdAt,
            scheduledFor: data.scheduledFor ?? null,
            completedAt: data.completedAt ?? null,
            acceptedVolunteerId: data.acceptedVolunteerId ?? null,
          };

        }),
      );
    });
    return unsub;
  }, [uid]);

  // Subscribe to blocks this customer participates in. Rules restrict
  // reads to participants (userA == uid || userB == uid) — querying
  // `blockedBy == uid` directly is denied by the rule, which is why the
  // old version silently showed zero. We merge both directional queries
  // and then keep only blocks this user initiated.
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
      setBlocked(
        [...merged.values()].sort((a, b) => {
          const ma = a.createdAt?.toMillis() ?? 0;
          const mb = b.createdAt?.toMillis() ?? 0;
          return mb - ma;
        }),
      );
    }

    const unsubA = onSnapshot(qA, applySnapshot, () => setBlocked([]));
    const unsubB = onSnapshot(qB, applySnapshot, () => setBlocked([]));
    return () => {
      unsubA();
      unsubB();
      merged.clear();
    };
  }, [uid]);

  const scheduled = rows.filter((r) => r.status === 'scheduled');
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
      blocked.length,
    completed: historyBuckets.completed.length,
    accepted: historyBuckets.accepted.length,
    blocked: blocked.length,
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
      <TopBar
        displayName={userDoc.displayName ?? 'You'}
        email={userDoc.email}
        photoPath={userDoc.photoURL ?? null}
        onSignOut={() => void handleSignOut()}
      />
      <div className="mx-auto max-w-7xl px-8 pt-10 pb-[124px]">
        <div key={screen} className="vc-screen-enter">
          {screen === 'tasks' && (
            <TasksScreen
              userDoc={userDoc}
              ongoing={ongoing}
              ongoingCount={ongoing.length}
              scheduled={scheduled}
            />
          )}

          {screen === 'profile' && (
            <ProfileScreen
              uid={uid}
              userDoc={userDoc}
              tasksPosted={rows.length}
              completionPct={completionPct}
              buckets={historyBuckets}
              blocked={blocked}
              counts={counts}
              filter={filter}
              onFilter={setFilter}
              onSignOut={() => void handleSignOut()}
            />
          )}
        </div>
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

function TopBar({
  displayName,
  email,
  photoPath,
  onSignOut,
}: {
  displayName: string;
  email: string | undefined;
  photoPath: string | null;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const initial = initialOf(displayName);
  const photoUrl = usePhotoUrl(photoPath);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (
        popoverRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
        Hey Padosi
      </div>
      <div className="relative flex items-center gap-3.5 text-[13px] text-[#4f4b46]">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Account menu"
          onClick={() => setOpen((o) => !o)}
          className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-xs font-bold text-[#5a2900] ring-2 ring-transparent transition hover:ring-[#1f6f5c]/30 focus:outline-none focus-visible:ring-[#1f6f5c]/40"
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{initial}</span>
          )}
        </button>
        {open && (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Account"
            className="vc-fade-up absolute right-0 top-[44px] z-50 w-64 overflow-hidden rounded-2xl border border-[#ececea] bg-white shadow-[0_20px_40px_-16px_rgba(20,18,15,0.18)]"
          >
            <div className="flex items-center gap-3 border-b border-[#f3f1ec] px-4 py-4">
              <span className="grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-base font-bold text-[#5a2900]">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initial
                )}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-[#131312]">
                  {displayName}
                </div>
                {email && (
                  <div className="mt-0.5 truncate text-[12px] text-[#8a847d]">
                    {email}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] font-medium text-[#a32a22] transition hover:bg-[#fdf0ef]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ----- Tasks screen ----------------------------------------------------

function TasksScreen({
  userDoc,
  ongoing,
  ongoingCount,
  scheduled,
}: {
  userDoc: UserDoc;
  ongoing: TaskRow[];
  ongoingCount: number;
  scheduled: TaskRow[];
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
          {scheduled.length > 0 && (
            <div className="mb-6">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8a847d]">
                  Upcoming tasks
                </h2>
                <span className="font-mono text-xs text-[#8a847d]">
                  {scheduled.length} upcoming
                </span>
              </div>

              {scheduled.map((t) => (
                <ScheduledTaskCard key={t.id} task={t} />
              ))}
            </div>
          )}

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
  const [detecting, setDetecting] = useState(false);
  const [isChoosing, setIsChoosing] = useState(false);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const center = loc ? { lat: loc.lat, lng: loc.lng } : FALLBACK_CENTER;
  const hasPin = Boolean(loc);

  interface NominatimAddress {
    suburb?: string;
    neighbourhood?: string;
    residential?: string;
    city_district?: string;
    town?: string;
    city?: string;
  }

  interface NominatimResponse {
    name?: string;
    display_name?: string;
    address?: NominatimAddress;
  }

  useEffect(() => {
    if (!hasPin) return;
    let cancelled = false;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${center.lat}&lon=${center.lng}`,
    )
      .then((res) => res.json() as Promise<NominatimResponse>)
      .then((data) => {
        if (cancelled) return;
        const addr = data.address;
        const name =
          addr?.suburb ||
          addr?.neighbourhood ||
          addr?.residential ||
          addr?.city_district ||
          addr?.town ||
          addr?.city ||
          data.name ||
          (data.display_name ? data.display_name.split(',')[0] : null);
        if (name) {
          setPlaceName(name);
        }
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, hasPin]);

  const addressText = hasPin
    ? placeName
      ? `${placeName} (${loc!.lat.toFixed(4)}, ${loc!.lng.toFixed(4)})`
      : `${loc!.lat.toFixed(4)}, ${loc!.lng.toFixed(4)}`
    : 'No location set yet';

  const handleMapClick = (lat: number, lng: number) => {
    if (!isChoosing) return;
    const h3Cell = latLngToCell(lat, lng, 9);
    const currentUser = auth().currentUser;
    if (currentUser) {
      void updateDoc(doc(db(), 'users', currentUser.uid), {
        lastKnownLocation: {
          lat,
          lng,
          h3Cell,
          updatedAt: serverTimestamp(),
        },
      });
    }
    setIsChoosing(false);
  };

  const detectLocation = () => {
    if (!('geolocation' in navigator)) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const h3Cell = latLngToCell(lat, lng, 9);
        const currentUser = auth().currentUser;
        if (currentUser) {
          void updateDoc(doc(db(), 'users', currentUser.uid), {
            lastKnownLocation: {
              lat,
              lng,
              h3Cell,
              updatedAt: serverTimestamp(),
            },
          });
        }
        setDetecting(false);
      },
      () => {
        setDetecting(false);
      },
      { timeout: 10000, maximumAge: 60_000 },
    );
  };

  useEffect(() => {
    if (hasPin || !('geolocation' in navigator)) return;
    let isMounted = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMounted) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const h3Cell = latLngToCell(lat, lng, 9);
        const currentUser = auth().currentUser;
        if (currentUser) {
          void updateDoc(doc(db(), 'users', currentUser.uid), {
            lastKnownLocation: {
              lat,
              lng,
              h3Cell,
              updatedAt: serverTimestamp(),
            },
          });
        }
      },
      () => { },
      { timeout: 10000, maximumAge: 60_000 },
    );
    return () => {
      isMounted = false;
    };
  }, [hasPin]);

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#ececea] bg-white">
      <div className="relative h-[clamp(360px,55vh,640px)]">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={hasPin ? 13 : 11}
          className="h-full w-full cursor-pointer"
          scrollWheelZoom={true}
          dragging={true}
          doubleClickZoom={true}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapCenterer center={center} />
          <MapZoomControls center={center} />
          <MapClickHandler enabled={isChoosing} onPick={handleMapClick} />
          {hasPin && (
            <>
              <Marker
                position={[center.lat, center.lng]}
                draggable={isChoosing}
                eventHandlers={{
                  dragend: (e: L.LeafletEvent) => {
                    const m = e.target as L.Marker;
                    const ll = m.getLatLng();
                    handleMapClick(ll.lat, ll.lng);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent>
                  <span className="font-sans text-xs font-semibold text-[#131312]">
                    📍 {placeName ? placeName : `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`}
                  </span>
                </Tooltip>
              </Marker>
              <Circle
                center={[center.lat, center.lng]}
                radius={2500}
                pathOptions={{
                  fillColor: '#1f6f5c',
                  fillOpacity: 0.12,
                  color: '#1f6f5c',
                  weight: 1.5,
                  dashArray: '6, 6',
                }}
              />
            </>
          )}
        </MapContainer>
        {isChoosing && (
          <div className="pointer-events-none absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-[#1f6f5c] px-4 py-1.5 text-xs font-semibold text-white shadow-md">
            Click anywhere on the map or drag the pin to set location
          </div>
        )}
        {!hasPin && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/55">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#4f4b46] shadow">
              {detecting ? 'Detecting your location…' : 'Set your location to see nearby'}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ececea] bg-white px-[18px] py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#1f6f5c] ring-[3px] ring-[#1f6f5c]/20"
            aria-hidden="true"
          />
          <span className="truncate text-[13px] font-medium text-[#131312]">
            {addressText}
          </span>
          {hasPin && (
            <span className="rounded-full bg-[#e3efe9] px-2.5 py-0.5 text-[11px] font-semibold text-[#1f6f5c]">
              2.5 km coverage preview
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsChoosing((prev) => !prev)}
            className={
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition focus:outline-none ' +
              (isChoosing
                ? 'bg-[#1f6f5c] text-white shadow-sm hover:bg-[#185845]'
                : 'border border-[#ececea] bg-white text-[#4f4b46] hover:bg-[#f3f1ec] hover:border-[#d8d4cc]')
            }
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {isChoosing ? 'Lock location' : 'Choose on map'}
          </button>

          <button
            type="button"
            onClick={detectLocation}
            disabled={detecting}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ececea] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1f6f5c] transition hover:bg-[#f3f1ec] hover:border-[#d8d4cc] focus:outline-none disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {detecting ? 'Detecting…' : 'Detect my location'}
          </button>
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

function MapClickHandler({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function MapZoomControls({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();

  const handleZoomIn = () => {
    const nextZoom = Math.min(map.getZoom() + 1, 18);
    map.setView([center.lat, center.lng], nextZoom, { animate: true });
  };

  const handleZoomOut = () => {
    const nextZoom = Math.max(map.getZoom() - 1, 3);
    map.setView([center.lat, center.lng], nextZoom, { animate: true });
  };

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col overflow-hidden rounded-xl border border-[#ececea] bg-white/95 shadow-md backdrop-blur-sm">
      <button
        type="button"
        onClick={handleZoomIn}
        title="Zoom in (Magnify)"
        aria-label="Zoom in"
        className="flex h-9 w-9 items-center justify-center text-[#131312] transition hover:bg-[#f3f1ec] active:bg-[#e3efe9]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      </button>
      <div className="h-px bg-[#ececea]" />
      <button
        type="button"
        onClick={handleZoomOut}
        title="Zoom out (Minify)"
        aria-label="Zoom out"
        className="flex h-9 w-9 items-center justify-center text-[#131312] transition hover:bg-[#f3f1ec] active:bg-[#e3efe9]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
          <path d="M8 11h6" />
        </svg>
      </button>
    </div>
  );
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
      className="vc-fade-up mb-2.5 flex cursor-pointer items-center gap-3.5 rounded-2xl border border-[#ececea] bg-white px-[18px] py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d8d4cc] hover:shadow-[0_8px_20px_-12px_rgba(20,18,15,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#131312] focus-visible:ring-offset-2"
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
  uid,
  userDoc,
  tasksPosted,
  completionPct,
  buckets,
  blocked,
  counts,
  filter,
  onFilter,
  onSignOut,
}: {
  uid: string;
  userDoc: UserDoc;
  tasksPosted: number;
  completionPct: number | null;
  buckets: HistoryBuckets;
  blocked: BlockedRow[];
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
            <HeroAvatar
              displayName={userDoc.displayName}
              photoPath={userDoc.photoURL ?? null}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-2xl font-bold tracking-tight">
                {userDoc.displayName ?? 'You'}
              </div>
              <div className="mt-1 truncate text-[13px] opacity-80">
                Member · Hey Padosi
              </div>
              {verified && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                  <span className="vc-check-pop inline-flex">
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
                  </span>
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
          Past tasks & settings
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

      {filter === 'blocked' ? (
        <BlockedUsersList uid={uid} />
      ) : (
        <HistoryList filter={filter} buckets={buckets} blocked={blocked} />
      )}
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
  blocked,
}: {
  filter: HistoryFilter;
  buckets: HistoryBuckets;
  blocked: BlockedRow[];
}) {
  type HistoryItem = {
    key: string;
    title: string;
    sub: string;
    badge: { label: string; bg: string; ink: string };
    avatarInitial?: string;
    avatarPhotoPath?: string | null;
  };
  let items: HistoryItem[] = [];

  function row(task: TaskRow, status: 'completed' | 'accepted'): HistoryItem {
    const when = task.completedAt ?? task.createdAt;
    return {
      key: task.id,
      title: task.title || 'Untitled task',
      sub: `${formatDate(when)} · ${task.riskLevel === 'medium' ? 'Medium' : 'Low'} priority`,
      badge: badgeForHistoryStatus(status),
    };
  }

  function blockedRow(b: BlockedRow): HistoryItem {
    return {
      key: b.blockId,
      title: b.otherName || 'Blocked user',
      sub: b.createdAt
        ? `Blocked ${formatDate(b.createdAt)}`
        : 'Blocked',
      badge: badgeForHistoryStatus('blocked'),
      avatarInitial: (b.otherName || '?').slice(0, 1).toUpperCase(),
      avatarPhotoPath: b.otherPhotoPath,
    };
  }

  if (filter === 'all') {
    items = [
      ...buckets.completed.map((t) => row(t, 'completed')),
      ...buckets.accepted.map((t) => row(t, 'accepted')),
      ...blocked.map(blockedRow),
    ];
  } else if (filter === 'completed') {
    items = buckets.completed.map((t) => row(t, 'completed'));
  } else if (filter === 'accepted') {
    items = buckets.accepted.map((t) => row(t, 'accepted'));
  } else if (filter === 'blocked') {
    items = blocked.map(blockedRow);
  }

  const [pageSize, setPageSize] = useState<number>(5);
  const [page, setPage] = useState<number>(1);
  // Reset to page 1 whenever the filter prop changes. Render-phase state
  // update is the React 18+ idiom for "derive state from a prop change"
  // — preferred over useEffect by the react-hooks/set-state-in-effect rule.
  const [filterAtPage, setFilterAtPage] = useState<HistoryFilter>(filter);
  if (filter !== filterAtPage) {
    setFilterAtPage(filter);
    setPage(1);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#ececea] px-4 py-7 text-center text-[13px] text-[#8a847d]">
        No {filter === 'all' ? '' : filter} {filter === 'blocked' ? 'users' : 'tasks'} yet.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = items.slice(start, start + pageSize);
  const rangeStart = start + 1;
  const rangeEnd = Math.min(items.length, start + pageSize);

  return (
    <div>
      {visible.map((row) => (
        <div
          key={row.key}
          className="vc-fade-up mb-2.5 flex items-center gap-3.5 rounded-2xl border border-[#ececea] bg-white px-[18px] py-4 transition hover:border-[#d8d4cc]"
        >
          <HistoryAvatar
            initial={row.avatarInitial}
            photoPath={row.avatarPhotoPath ?? null}
          />
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] text-[#8a847d]">
          <label htmlFor="vc-page-size" className="font-medium">
            Per page
          </label>
          <select
            id="vc-page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="rounded-full border border-[#ececea] bg-white px-3 py-1.5 text-[12px] font-medium text-[#131312] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-2 focus:ring-[#1f6f5c]/20"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
          </select>
          <span className="font-mono text-[11px] text-[#8a847d]">
            {rangeStart}–{rangeEnd} of {items.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="inline-flex items-center gap-1 rounded-full border border-[#ececea] bg-white px-3 py-1.5 text-[12px] font-medium text-[#4f4b46] transition hover:border-[#1f6f5c] hover:text-[#131312] disabled:cursor-not-allowed disabled:border-[#f3f1ec] disabled:text-[#b8b3ad] disabled:hover:border-[#f3f1ec]"
            aria-label="Previous page"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Prev
          </button>
          <span className="px-2 font-mono text-[11px] text-[#8a847d]">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex items-center gap-1 rounded-full border border-[#ececea] bg-white px-3 py-1.5 text-[12px] font-medium text-[#4f4b46] transition hover:border-[#1f6f5c] hover:text-[#131312] disabled:cursor-not-allowed disabled:border-[#f3f1ec] disabled:text-[#b8b3ad] disabled:hover:border-[#f3f1ec]"
            aria-label="Next page"
          >
            Next
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Hero avatar for the Profile screen. Same gradient ring as the design
// fallback, but renders the user's onboarding photo when available.
function HeroAvatar({
  displayName,
  photoPath,
}: {
  displayName: string | undefined;
  photoPath: string | null;
}) {
  const url = usePhotoUrl(photoPath);
  return (
    <span className="grid h-[76px] w-[76px] flex-shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white/25 bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-[28px] font-bold text-[#5a2900]">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{initialOf(displayName)}</span>
      )}
    </span>
  );
}

// Avatar for a history-list row. If a Storage `photoPath` is provided,
// resolves it to a download URL; otherwise renders the clock icon (for
// task rows) or the user's initial (for blocked-user rows).
function HistoryAvatar({
  initial,
  photoPath,
}: {
  initial: string | undefined;
  photoPath: string | null;
}) {
  const url = usePhotoUrl(photoPath);
  if (initial && url) {
    return (
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-[#e3efe9]">
        <img src={url} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  if (initial) {
    return (
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-sm font-bold text-[#5a2900]">
        {initial}
      </span>
    );
  }
  return (
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
  );
}

// Resolve a Storage path to a download URL once. `null` on failure so
// the caller can fall back to an initial. Storage rules allow any
// signed-in user to read `/users/{uid}/photo`. Keyed by `path` so a
// path change re-mounts a fresh null state without a setter call.
function usePhotoUrl(path: string | null): string | null {
  // We key the cache on `path` so swapping paths re-runs the effect
  // and the previous URL is dropped before the new fetch resolves.
  const [cache, setCache] = useState<{ path: string | null; url: string | null }>(
    { path, url: null },
  );
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    void getDownloadURL(storageRef(storage(), path))
      .then((u) => {
        if (!cancelled) setCache({ path, url: u });
      })
      .catch(() => {
        if (!cancelled) setCache({ path, url: null });
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return cache.path === path ? cache.url : null;
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
        'inline-flex items-center gap-2 rounded-full px-[22px] py-2.5 text-[13px] font-semibold transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
        (active
          ? 'scale-[1.02] bg-[#131312] text-white focus-visible:ring-white'
          : 'bg-transparent text-[#8a847d] hover:scale-[1.02] hover:text-[#131312] focus-visible:ring-[#131312]')
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
    case 'scheduled':
      return 'Scheduled';
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


function ScheduledTaskCard({ task }: { task: TaskRow }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedTime = task.scheduledFor
    ? task.scheduledFor.toDate().toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    : 'Pending activation';

  const handleCancel = async (reasonId: string) => {
    setBusy(true);
    setError(null);
    try {
      const fn = httpsCallable<{ taskId: string; reason: string }, { success: boolean }>(
        functions(),
        'deleteTask',
      );
      await fn({ taskId: task.id, reason: reasonId });
      setIsCancelOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel task.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateScheduledTime = async (newScheduledForMs: number) => {
    setBusy(true);
    setError(null);
    try {
      const fn = httpsCallable<{ taskId: string; newScheduledForMs: number }, { success: boolean }>(
        functions(),
        'updateScheduledTask',
      );
      await fn({ taskId: task.id, newScheduledForMs });
      setIsEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update time.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vc-fade-up mb-3.5 rounded-2xl border border-[#c7d2fe] bg-[#eef2ff] p-4.5 shadow-xs transition-all hover:border-[#a5b4fc]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-[#131312]">
            {task.title}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#4f4b46]">
            <span>🗓</span>
            <span>
              Task scheduled at{' '}
              <span className="font-semibold text-[#4338ca]">{formattedTime}</span>
            </span>
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="rounded-full border border-[#c7d2fe] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#3730a3] transition hover:bg-[#e0e7ff] hover:border-[#a5b4fc] focus:outline-none shadow-xs"
          >
            Edit time
          </button>
          <button
            type="button"
            onClick={() => setIsCancelOpen(true)}
            className="rounded-full border border-red-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 focus:outline-none shadow-xs"
          >
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
      )}

      <ReasonBottomSheet
        isOpen={isCancelOpen}
        title="Cancel scheduled task?"
        subtitle="This will remove the task before it goes live."
        reasons={[
          { id: 'accidental_post', label: 'Accidental post' },
          { id: 'no_longer_needed', label: 'No longer needed' },
          { id: 'found_help_elsewhere', label: 'Found help elsewhere' },
          { id: 'other', label: 'Other' },
        ]}
        busy={busy}
        onSelect={(r) => void handleCancel(r)}
        onClose={() => setIsCancelOpen(false)}
      />

      <EditScheduledTimeModal
        isOpen={isEditOpen}
        currentScheduledForMs={task.scheduledFor ? task.scheduledFor.toMillis() : 0}
        onClose={() => setIsEditOpen(false)}
        onConfirm={(ms) => void handleUpdateScheduledTime(ms)}
        isSubmitting={busy}
      />
    </div>
  );
}

function EditScheduledTimeModal({
  isOpen,
  currentScheduledForMs,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  isOpen: boolean;
  currentScheduledForMs: number;
  onClose: () => void;
  onConfirm: (scheduledForMs: number) => void;
  isSubmitting: boolean;
}) {
  const [selectedIso, setSelectedIso] = useState(() => {
    const d = new Date(currentScheduledForMs || Date.now() + 3600000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [nowMs] = useState(() => Date.now());

  if (!isOpen) return null;

  const minMs = nowMs + 30 * 60 * 1000;
  const maxMs = nowMs + 7 * 24 * 60 * 60 * 1000;


  const toLocalIso = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const pickedMs = new Date(selectedIso).getTime();

    if (isNaN(pickedMs)) {
      setErrorMsg('Please select a valid date and time.');
      return;
    }

    if (pickedMs < minMs) {
      setErrorMsg('Scheduled time must be at least 30 minutes from now.');
      return;
    }

    if (pickedMs > maxMs) {
      setErrorMsg('Scheduled time cannot be more than 7 days in advance.');
      return;
    }

    onConfirm(pickedMs);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h3 className="text-lg font-bold text-neutral-900">
            Edit scheduled time
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="edit-scheduled-datetime" className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
              New Activation Time
            </label>
            <input
              id="edit-scheduled-datetime"
              type="datetime-local"
              min={toLocalIso(minMs)}
              max={toLocalIso(maxMs)}
              value={selectedIso}
              onChange={(e) => {
                setSelectedIso(e.target.value);
                setErrorMsg(null);
              }}
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-sm focus:border-[#1f6f5c] focus:bg-white focus:outline-none"
              required
            />

            <p className="mt-1 text-xs text-neutral-500">
              Min: 30 mins from now · Max: 7 days out
            </p>
          </div>

          {errorMsg && (
            <p className="rounded-xl bg-red-50 p-2.5 text-xs font-medium text-red-700">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[#1f6f5c] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#185845] focus:outline-none"
            >
              {isSubmitting ? 'Saving...' : 'Save time'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


