// Route guard: redirects based on which onboarding step the user is at.
// Each gated route declares the step it is FOR via the `requires` prop:
//   - 'consent' → renders for users who still need to record T&C consent
//   - 'role'    → renders for users who have consent but no roles yet
//   - 'ready'   → renders only for fully-onboarded users
// Users at any other step are redirected to where they belong.

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthState, type AuthState } from './auth-context';

export type RequiredStep = 'consent' | 'role' | 'profile' | 'ready';

interface ProtectedRouteProps {
  children: ReactNode;
  requires: RequiredStep;
}

type CurrentStep = 'loading' | 'signed-out' | RequiredStep;

function currentStep(state: AuthState): CurrentStep {
  switch (state.status) {
    case 'loading':
      return 'loading';
    case 'signed-out':
      return 'signed-out';
    case 'no-doc':
      return 'consent';
    case 'incomplete': {
      if (!state.userDoc.consent?.acceptedAt) return 'consent';
      if (!state.userDoc.roles?.length) return 'role';
      return 'profile';
    }
    case 'ready':
      return 'ready';
  }
}

function pathForStep(step: RequiredStep): string {
  if (step === 'consent') return '/onboarding/consent';
  if (step === 'role') return '/onboarding/role';
  if (step === 'profile') return '/onboarding/profile';
  return '/app';
}

export function ProtectedRoute({ children, requires }: ProtectedRouteProps) {
  const state = useAuthState();
  const step = currentStep(state);

  if (step === 'loading') return <FullScreenSpinner />;
  if (step === 'signed-out') return <Navigate to="/login" replace />;
  if (step === requires) return <>{children}</>;
  return <Navigate to={pathForStep(step)} replace />;
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
