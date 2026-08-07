// Page-level effect: once AuthProvider reports the user is signed in,
// navigate them to the next step (consent / role / app).
// Used by /login and /signup pages so the redirect waits for the
// AuthProvider state to settle, instead of racing the Firebase promise.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from './auth-context';

export function useRedirectWhenSignedIn() {
  const state = useAuthState();
  const navigate = useNavigate();

  useEffect(() => {
    if (
      state.status === 'loading' ||
      state.status === 'signed-out' ||
      state.status === 'error'
    )
      return;

    let path = '/app';
    if (state.status === 'no-doc') {
      path = '/onboarding/consent';
    } else if (state.status === 'incomplete') {
      if (!state.userDoc.consent?.acceptedAt) {
        path = '/onboarding/consent';
      } else if (!state.userDoc.roles?.length) {
        path = '/onboarding/role';
      } else {
        path = '/onboarding/profile';
      }
    }
    void navigate(path, { replace: true });
  }, [state, navigate]);
}
