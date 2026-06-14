// Authenticated home — shown after onboarding completes.
// M2 adds: prominent availability ON/OFF toggle for volunteers.
// Real dashboard (post tasks, offer inbox) lands in M3 + M5.

import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { latLngToCell } from 'h3-js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { useAuthState } from '../lib/auth-context';
import { GeolocationError, getCurrentLocation } from '../lib/geolocation';
import { MyTasksList } from '../components/MyTasksList';
import { OfferInbox } from '../components/OfferInbox';
import { AcceptedTasksList } from '../components/AcceptedTasksList';
import { BlockedUsersList } from '../components/BlockedUsersList';
import { CustomerDashboard } from '../components/CustomerDashboard';
import { getSkillLabel } from '../lib/catalog';
import { KarmaBadge } from '../components/KarmaBadge';
import { KarmaToast } from '../components/KarmaToast';

const H3_RESOLUTION = 9;

export default function AppHomePage() {
  const state = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const navState = location.state as { toastMessage?: string } | null;
    if (navState?.toastMessage) {
      const msg = navState.toastMessage;
      setTimeout(() => {
        setToastMessage(msg);
        // Clean up navigation state to prevent double fires on refresh
        window.history.replaceState({}, document.title);
      }, 0);
    }
  }, [location]);

  if (state.status !== 'ready') return null;
  const { user, userDoc } = state;
  const name = userDoc.displayName ?? 'there';
  const isVolunteer = userDoc.roles?.includes('volunteer') ?? false;
  const isCustomer = userDoc.roles?.includes('customer') ?? false;
  const available = userDoc.availableNow ?? false;

  // Admin home short-circuit. Admins never see volunteer/customer
  // dashboards from /app — they get a minimal landing with a direct
  // Dashboard link and a pending-reports alert.
  if (userDoc.isAdmin === true) {
    return <AdminHomeScreen name={name} />;
  }

  // Customer-facing redesign (design handoff 2026-06-14). Applies to any
  // user whose roles include 'customer' (pure customer or dual-role).
  // Volunteer-only users keep the existing layout below.
  if (isCustomer) {
    return (
      <>
        <CustomerDashboard uid={user.uid} userDoc={userDoc} />
        {toastMessage && (
          <KarmaToast
            message={toastMessage}
            onClose={() => setToastMessage(null)}
          />
        )}
      </>
    );
  }

  async function handleSignOut() {
    await signOut(auth());
    void navigate('/', { replace: true });
  }

  async function toggleAvailability() {
    setError(null);
    const ref = doc(db(), 'users', user.uid);
    if (available) {
      // Going OFF — just flip the flag. Leave lastKnownLocation in place
      // (the matching engine filters by availableNow, so stale values
      // aren't visible to anyone).
      setBusy(true);
      try {
        await updateDoc(ref, {
          availableNow: false,
          availabilityUpdatedAt: serverTimestamp(),
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not update. Try again.',
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    // Going ON — capture location first, then write.
    setBusy(true);
    try {
      const loc = await getCurrentLocation();
      const h3Cell = latLngToCell(loc.lat, loc.lng, H3_RESOLUTION);
      await updateDoc(ref, {
        availableNow: true,
        availabilityUpdatedAt: serverTimestamp(),
        lastKnownLocation: {
          lat: loc.lat,
          lng: loc.lng,
          h3Cell,
          updatedAt: serverTimestamp(),
        },
      });
    } catch (err) {
      if (err instanceof GeolocationError) {
        setError(err.userMessage);
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not update. Try again.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        {userDoc.accountStatus === 'warned' && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm flex gap-3 animate-pulse-subtle">
            <svg
              className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-semibold text-sm">Account Warning Issued</p>
              <p className="mt-1 text-xs text-amber-800">
                An administrator has issued a warning to your account. Continued violations will result in temporary suspension or deactivation.
              </p>
              {userDoc.moderationReason && (
                <p className="mt-2 text-xs font-medium bg-white/50 inline-block px-2.5 py-1 rounded-md text-amber-950">
                  Reason: {userDoc.moderationReason}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome, {name}.
            </h1>
            <p className="mt-3 text-neutral-600">
              Your dashboard lands in M5 (volunteer offers).
            </p>
          </div>
          {isVolunteer && (
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Karma Points</span>
              <KarmaBadge points={userDoc.points ?? 0} />
            </div>
          )}
        </div>

        {isVolunteer && (
          <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Volunteer Stats</h2>
            
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Trust Score</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xl font-bold text-neutral-900">
                    Score: {userDoc.trustScore ?? 30}/100
                  </span>
                  {(() => {
                    const score = userDoc.trustScore ?? 30;
                    if (score >= 85) {
                      return (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          Trusted
                        </span>
                      );
                    } else if (score >= 60) {
                      return (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          Reliable
                        </span>
                      );
                    } else {
                      return (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-800">
                          Newcomer
                        </span>
                      );
                    }
                  })()}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Completions</p>
                <p className="mt-2 text-xl font-bold text-neutral-900">
                  {userDoc.verifiedTaskCount ?? 0} tasks ({userDoc.verifiedHours?.toFixed(1) ?? '0.0'} hours)
                </p>
              </div>
            </div>

            {Object.keys(userDoc.skillPoints ?? {}).length > 0 && (
              <div className="mt-6 border-t border-neutral-100 pt-6">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Skill Points</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(userDoc.skillPoints ?? {}).map(([key, val]) => (
                    <span
                      key={key}
                      className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700"
                    >
                      {getSkillLabel(key)}: {val}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {isCustomer && (
          <>
            <section className="mt-12 rounded-2xl border border-neutral-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-neutral-900">
                Need a hand with something?
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Post a small task and we'll find a nearby volunteer.
              </p>
              <Link
                to="/create-task"
                className="mt-4 inline-block rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
              >
                Post a task
              </Link>
            </section>
            <MyTasksList uid={user.uid} />
            <BlockedUsersList uid={user.uid} />
          </>
        )}

        {isVolunteer && <OfferInbox uid={user.uid} />}
        {isVolunteer && <AcceptedTasksList uid={user.uid} />}

        {isVolunteer && (
          <section className="mt-12 rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  Available right now
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  When this is on, nearby task posters may offer you tasks.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={available}
                aria-label="Availability"
                onClick={() => void toggleAvailability()}
                disabled={busy}
                className={
                  'relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50 ' +
                  (available ? 'bg-emerald-600' : 'bg-neutral-300')
                }
              >
                <span
                  aria-hidden="true"
                  className={
                    'pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition ' +
                    (available ? 'translate-x-6' : 'translate-x-0')
                  }
                />
              </button>
            </div>
            <p
              className="mt-4 text-sm font-medium"
              aria-live="polite"
            >
              <span
                className={
                  available ? 'text-emerald-700' : 'text-neutral-500'
                }
              >
                {available ? 'You are visible to nearby task posters.' : 'You are not currently visible.'}
              </span>
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </section>
        )}

        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-12 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          Sign out
        </button>

        {toastMessage && (
          <KarmaToast
            message={toastMessage}
            onClose={() => setToastMessage(null)}
          />
        )}
      </div>
    </main>
  );
}

// Admin landing — minimal by spec: heading, dashboard CTA, and a neutral
// alert if any pending reports are awaiting review. No karma / stats /
// availability / blocks. The pending-reports subscription mirrors the
// admin dashboard's own query so the counts agree.
function AdminHomeScreen({ name }: { name: string }) {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db(), 'reports'),
      where('status', '==', 'pending'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setPendingCount(snap.size),
      () => {
        /* keep zero on error */
      },
    );
    return unsub;
  }, []);

  async function handleSignOut() {
    await signOut(auth());
    void navigate('/', { replace: true });
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {name}.
        </h1>

        <div className="mt-8">
          <Link
            to="/admin"
            className="inline-block rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Go to Admin Dashboard
          </Link>
        </div>

        {pendingCount > 0 && (
          <button
            type="button"
            onClick={() => void navigate('/admin')}
            className="mt-6 block w-full rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-left text-sm text-neutral-700 transition hover:border-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            You have <span className="font-semibold text-neutral-900">{pendingCount}</span>{' '}
            pending {pendingCount === 1 ? 'report' : 'reports'} waiting for review.
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-12 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
