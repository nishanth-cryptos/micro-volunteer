// Self-serve "Your Routes" Screen — India DPDP Act Compliance & Trail Management
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthState } from '../lib/auth-context';
import {
  deleteCanonicalRoute,
  getCanonicalRoutes,
  getLocalTrailConsent,
  setTrailConsent,
  wipeAllTrailData,
} from '../lib/trail-service/trail-store';
import type { CanonicalRoute } from '../lib/trail-service/types';

export function YourRoutesPage() {
  const authState = useAuthState();
  const user = authState.status === 'ready' || authState.status === 'incomplete' ? authState.user : null;
  const navigate = useNavigate();

  const [consent, setConsent] = useState(() => (user ? getLocalTrailConsent(user.uid) : false));
  const [routes, setRoutes] = useState<CanonicalRoute[]>([]);
  const [loading, setLoading] = useState(() => (user ? getLocalTrailConsent(user.uid) : false));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authState.status === 'loading') return;

    if (!user) {
      void navigate('/login', { replace: true });
      return;
    }

    const currentConsent = getLocalTrailConsent(user.uid);

    if (currentConsent) {
      void loadRoutes(user.uid);
    }
  }, [user, authState.status, navigate]);

  async function loadRoutes(uid: string) {
    setLoading(true);
    try {
      const data = await getCanonicalRoutes(uid);
      setRoutes(data);
    } catch {
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConsentToggle(enabled: boolean) {
    if (!user) return;
    setStatusMessage(null);
    try {
      await setTrailConsent(user.uid, enabled);
      setConsent(enabled);
      if (enabled) {
        setStatusMessage('Commute trail mining enabled. Your routes will be inferred locally.');
        await loadRoutes(user.uid);
      } else {
        setRoutes([]);
        setStatusMessage('Trail consent revoked. All stored commute routes and trip data wiped.');
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Could not update consent.');
    }
  }

  async function handleDeleteRoute(routeId: string) {
    if (!user) return;
    try {
      await deleteCanonicalRoute(user.uid, routeId);
      setRoutes((prev) => prev.filter((r) => r.id !== routeId));
      setStatusMessage('Route deleted successfully.');
    } catch {
      setStatusMessage('Failed to delete route.');
    }
  }

  async function handleWipeAll() {
    if (!user) return;
    if (!confirm('Are you sure you want to delete all inferred commute routes and trip logs?')) {
      return;
    }
    try {
      await wipeAllTrailData(user.uid);
      setRoutes([]);
      setConsent(false);
      setStatusMessage('All trail data and consent records deleted.');
    } catch {
      setStatusMessage('Failed to wipe data.');
    }
  }

  const formatMinutesToTime = (min: number) => {
    const hrs = Math.floor(min / 60) % 24;
    const mins = min % 60;
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const formattedHrs = hrs % 12 || 12;
    return `${formattedHrs}:${mins < 10 ? '0' : ''}${mins} ${ampm}`;
  };

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#131312] vc-screen-enter">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#ececea] bg-[#fafaf8]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/app"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ececea] bg-white text-[#131312] transition hover:bg-[#f3f1ec]"
              aria-label="Back to Dashboard"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f6f5c] text-xs font-bold text-white">
                HP
              </span>
              <span className="font-bold tracking-tight text-[#131312]">
                Your Commute Routes
              </span>
            </div>
          </div>
          <span className="rounded-full bg-[#e3efe9] px-3 py-1 text-xs font-bold text-[#1f6f5c]">
            DPDP Act Compliant
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-8">
        {statusMessage && (
          <div role="status" className="rounded-2xl border border-[#1f6f5c]/20 bg-[#e3efe9]/50 p-4 text-sm font-medium text-[#1f6f5c]">
            {statusMessage}
          </div>
        )}

        {/* Privacy & Purpose Notice */}
        <section className="rounded-[24px] border border-[#ececea] bg-white p-6 sm:p-7 shadow-xs">
          <h2 className="m-0 text-xl font-bold tracking-tight text-[#131312]">
            Commute Trail Privacy & Controls
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4f4b46]">
            Hey Padosi uses on-device trail mining to detect recurring commute routes. When you leave on a route, we pre-warm nearby micro-volunteering tasks that fit into your available trip time budget.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#ececea] bg-[#fafaf8] p-4">
              <div className="text-xs font-bold text-[#1f6f5c] uppercase">On-Device Processing</div>
              <div className="mt-1 text-xs text-[#4f4b46]">Raw GPS pings stay on your device. Only derived route summaries sync.</div>
            </div>
            <div className="rounded-xl border border-[#ececea] bg-[#fafaf8] p-4">
              <div className="text-xs font-bold text-[#1f6f5c] uppercase">Customer Shield</div>
              <div className="mt-1 text-xs text-[#4f4b46]">Task posters only see "ETA X min". Your live position is never shared.</div>
            </div>
            <div className="rounded-xl border border-[#ececea] bg-[#fafaf8] p-4">
              <div className="text-xs font-bold text-[#1f6f5c] uppercase">Self-Serve Erasure</div>
              <div className="mt-1 text-xs text-[#4f4b46]">Delete any route or wipe all stored trails at any time.</div>
            </div>
          </div>

          {/* Consent Switch */}
          <div className="mt-6 flex items-center justify-between border-t border-[#ececea] pt-5">
            <div>
              <div className="text-sm font-bold text-[#131312]">
                Enable Commute Trail Matching
              </div>
              <div className="text-xs text-[#8a847d]">
                Allow TrailService to infer recurring routes for corridor task matching.
              </div>
            </div>
            <label aria-label="Toggle commute trail matching" className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => void handleConsentToggle(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-7 w-12 rounded-full bg-[#ececea] after:absolute after:top-0.5 after:left-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-[#1f6f5c] peer-checked:after:translate-x-5" />
            </label>
          </div>
        </section>

        {/* Inferred Canonical Routes */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-lg font-bold text-[#131312]">
              Inferred Canonical Routes ({routes.length})
            </h3>
            {routes.length > 0 && (
              <button
                type="button"
                onClick={() => void handleWipeAll()}
                className="text-xs font-bold text-[#a32a22] hover:underline"
              >
                Wipe all trail data
              </button>
            )}
          </div>

          {!consent ? (
            <div className="rounded-[20px] border border-[#ececea] bg-white p-8 text-center text-sm text-[#8a847d]">
              Trail matching is currently disabled. Toggle the switch above to enable route inference.
            </div>
          ) : loading ? (
            <div className="rounded-[20px] border border-[#ececea] bg-white p-8 text-center text-sm text-[#8a847d]">
              Loading your commute routes…
            </div>
          ) : routes.length === 0 ? (
            <div className="rounded-[20px] border border-[#ececea] bg-white p-8 text-center text-sm text-[#8a847d]">
              No canonical routes detected yet. Complete 3+ trips along the same path to automatically build a route!
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {routes.map((route) => {
                const depTime = formatMinutesToTime(route.departureMeanMinutes);
                const days = route.dayOfWeekMask
                  .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                  .join(', ');

                return (
                  <div
                    key={route.id}
                    className="flex flex-col justify-between rounded-[20px] border border-[#ececea] bg-white p-5 shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-[#131312]">
                          {route.destinationLabel}
                        </div>
                        <span className="rounded-full bg-[#e3efe9] px-2.5 py-0.5 text-[11px] font-bold text-[#1f6f5c]">
                          {Math.round(route.confidence * 100)}% confidence
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-[#4f4b46]">
                        <div>
                          <strong className="text-[#131312]">Departure Window:</strong> ~{depTime} (±{route.departureStdDevMinutes}m)
                        </div>
                        <div>
                          <strong className="text-[#131312]">Est. Duration:</strong> ~{route.durationMeanMinutes} mins
                        </div>
                        <div>
                          <strong className="text-[#131312]">Active Days:</strong> {days}
                        </div>
                        <div className="font-mono text-[11px] text-[#8a847d]">
                          H3 Cells: {route.h3Path.length} cells in corridor
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-end border-t border-[#ececea] pt-3">
                      <button
                        type="button"
                        onClick={() => void handleDeleteRoute(route.id)}
                        className="text-xs font-semibold text-[#a32a22] transition hover:text-red-700"
                      >
                        Delete route
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
