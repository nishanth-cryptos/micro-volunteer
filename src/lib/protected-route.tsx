// Route guard: redirects based on which onboarding step the user is at.
// Each gated route declares the step it is FOR via the `requires` prop:
//   - 'consent' → renders for users who still need to record T&C consent
//   - 'role'    → renders for users who have consent but no roles yet
//   - 'ready'   → renders only for fully-onboarded users
// Users at any other step are redirected to where they belong.
// Suspended and Banned users are globally blocked here.

import { useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuthState, type AuthState } from './auth-context';
import { auth, functions } from './firebase';


export type RequiredStep = 'consent' | 'role' | 'profile' | 'skills' | 'ready';

interface ProtectedRouteProps {
  children: ReactNode;
  requires: RequiredStep;
  requiresAdmin?: boolean;
}

type CurrentStep = 'loading' | 'signed-out' | RequiredStep;

function currentStep(state: AuthState): CurrentStep {
  switch (state.status) {
    case 'loading':
      return 'loading';
    case 'signed-out':
      return 'signed-out';
    case 'error':
      return 'loading';
    case 'no-doc':
      return 'consent';
    case 'incomplete': {
      const ud = state.userDoc;
      if (!ud.consent?.acceptedAt) return 'consent';
      if (!ud.roles?.length) return 'role';
      const hasProfile = Boolean(ud.displayName) && Boolean(ud.photoURL);
      if (!hasProfile) return 'profile';
      // Volunteers/dual-role users land here when profile is done but
      // skills haven't been picked yet.
      return 'skills';
    }
    case 'ready':
      return 'ready';
  }
}

function pathForStep(step: RequiredStep): string {
  if (step === 'consent') return '/onboarding/consent';
  if (step === 'role') return '/onboarding/role';
  if (step === 'profile') return '/onboarding/profile';
  if (step === 'skills') return '/onboarding/skills';
  return '/app';
}

export function ProtectedRoute({ children, requires, requiresAdmin }: ProtectedRouteProps) {
  const state = useAuthState();
  const step = currentStep(state);
  const [now] = useState(() => Date.now());

  if (state.status === 'error') return <DatabaseErrorScreen error={state.error} />;
  if (step === 'loading') return <FullScreenSpinner />;
  if (step === 'signed-out') return <Navigate to="/login" replace />;

  // Globally intercept suspended and banned users
  if (state.status === 'ready' || state.status === 'incomplete') {
    const userDoc = state.userDoc;
    const isBanned = userDoc.accountStatus === 'banned';
    const isSuspended =
      userDoc.accountStatus === 'suspended' &&
      userDoc.suspendedUntil &&
      userDoc.suspendedUntil.toMillis() > now;

    const isFrozen =
      Boolean(userDoc.frozenAt) &&
      (!userDoc.freezeAcknowledgedAt ||
        userDoc.freezeAcknowledgedAt.toMillis() < userDoc.frozenAt!.toMillis());

    if (isBanned) {
      return <BannedScreen reason={userDoc.moderationReason} />;
    }
    if (isSuspended) {
      return (
        <SuspendedScreen
          until={userDoc.suspendedUntil!}
          reason={userDoc.moderationReason}
        />
      );
    }
    if (isFrozen) {
      return <FrozenScreen />;
    }
  }


  // Admin check
  if (requiresAdmin) {
    if (state.status !== 'ready' || state.userDoc.isAdmin !== true) {
      return <Navigate to="/app" replace />;
    }
  }

  if (step === requires) return <>{children}</>;
  return <Navigate to={pathForStep(step)} replace />;
}

function BannedScreen({ reason }: { reason?: string | undefined }) {
  async function handleSignOut() {
    await signOut(auth());
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-12 text-center text-neutral-900">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg
            className="h-6 w-6"
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
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">
          Account Permanently Banned
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Your account has been deactivated for violating our safety guidelines and terms of service.
        </p>
        {reason && (
          <div className="mt-4 rounded-lg bg-neutral-50 p-4 text-left text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">Reason: </span>
            {reason}
          </div>
        )}
        <div className="mt-6 text-xs text-neutral-500">
          If you believe this was an error, contact support at{' '}
          <a href="mailto:support@example.org" className="text-neutral-900 underline">
            support@example.org
          </a>.
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-8 w-full rounded-full border border-neutral-300 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 focus:outline-none"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function SuspendedScreen({ until, reason }: { until: Timestamp; reason?: string | undefined }) {
  async function handleSignOut() {
    await signOut(auth());
  }

  const dateStr = until.toDate().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = until.toDate().toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-12 text-center text-neutral-900">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">
          Account Suspended
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Your account is temporarily suspended until <span className="font-semibold text-neutral-900">{dateStr} at {timeStr}</span>.
        </p>
        {reason && (
          <div className="mt-4 rounded-lg bg-neutral-50 p-4 text-left text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">Reason: </span>
            {reason}
          </div>
        )}
        <div className="mt-6 text-xs text-neutral-500">
          If you have questions, please reach out to{' '}
          <a href="mailto:support@example.org" className="text-neutral-900 underline">
            support@example.org
          </a>.
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-8 w-full rounded-full border border-neutral-300 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 focus:outline-none"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function FrozenScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAcknowledge() {
    setError(null);
    setBusy(true);
    try {
      const fn = httpsCallable<void, { success: boolean }>(
        functions(),
        'unfreezeAccount',
      );
      await fn();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not acknowledge warning.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth());
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-12 text-center text-neutral-900">
      <div className="vc-fade-up w-full max-w-md rounded-3xl border border-amber-200 bg-white p-8 shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <svg
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">
          Account Notice
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          We noticed some unusual activity on your account. Whether this happened by accident or on purpose, please make sure to follow community guidelines going forward. Further repeated activity like this may result in your account being locked.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-[#fdf0ef] p-3 text-xs text-[#a32a22]"
          >
            {error}
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => void handleAcknowledge()}
            disabled={busy}
            className="w-full rounded-full bg-[#1f6f5c] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#185845] focus:outline-none disabled:opacity-50"
          >
            {busy ? 'Processing…' : 'I understand'}
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full rounded-full border border-neutral-300 py-2.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 focus:outline-none"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}


function FullScreenSpinner() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-neutral-50"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
    </div>
  );
}

function DatabaseErrorScreen({ error }: { error: Error }) {
  async function handleSignOut() {
    await signOut(auth());
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-12 text-center text-neutral-900">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">
          Database Connection Error
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Could not connect to Firebase Firestore to load your profile.
        </p>
        <div className="mt-4 rounded-lg bg-neutral-50 p-4 text-left text-xs font-mono text-neutral-700 overflow-x-auto">
          {error.message || 'Firestore connection failed.'}
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-full bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none"
          >
            Retry connection
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full rounded-full border border-neutral-300 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 focus:outline-none"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
