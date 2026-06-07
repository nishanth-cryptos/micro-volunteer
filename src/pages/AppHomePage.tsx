// Authenticated home — shown after onboarding completes.
// M2 adds: prominent availability ON/OFF toggle for volunteers.
// Real dashboard (post tasks, offer inbox) lands in M3 + M5.

import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { latLngToCell } from 'h3-js';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { useAuthState } from '../lib/auth-context';
import { GeolocationError, getCurrentLocation } from '../lib/geolocation';
import { MyTasksList } from '../components/MyTasksList';
import { OfferInbox } from '../components/OfferInbox';
import { AcceptedTasksList } from '../components/AcceptedTasksList';

const H3_RESOLUTION = 9;

export default function AppHomePage() {
  const state = useAuthState();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== 'ready') return null;
  const { user, userDoc } = state;
  const name = userDoc.displayName ?? 'there';
  const isVolunteer = userDoc.roles?.includes('volunteer') ?? false;
  const isCustomer = userDoc.roles?.includes('customer') ?? false;
  const available = userDoc.availableNow ?? false;

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
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {name}.
        </h1>
        <p className="mt-3 text-neutral-600">
          Your dashboard lands in M5 (volunteer offers).
        </p>

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
      </div>
    </main>
  );
}
