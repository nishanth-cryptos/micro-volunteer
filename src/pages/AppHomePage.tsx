// Authenticated home — shown after onboarding completes.
// M1.6 stub; real dashboard arrives across M3 (post tasks) and M5
// (volunteer offer inbox). Sign-out lives here for now; will move to a
// proper settings menu in M2.

import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAuthState } from '../lib/auth-context';

export default function AppHomePage() {
  const state = useAuthState();
  const navigate = useNavigate();
  const name =
    (state.status === 'ready' && state.userDoc.displayName) || 'there';

  async function handleSignOut() {
    await signOut(auth());
    void navigate('/', { replace: true });
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {name}.
        </h1>
        <p className="mt-3 text-neutral-600">
          Your dashboard lands in M3 (post tasks) and M5 (volunteer offers).
        </p>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-10 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
