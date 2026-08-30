// Authenticated home — shown after onboarding completes.
// Seamlessly routes and manages dual-role switching for users who are both
// Customer and Volunteer.

import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { useAuthState } from '../lib/auth-context';
import { useActiveRole } from '../lib/use-active-role';
import { CustomerDashboard } from '../components/CustomerDashboard';
import { VolunteerDashboard } from '../components/VolunteerDashboard';
import { KarmaToast } from '../components/KarmaToast';

export default function AppHomePage() {
  const state = useAuthState();
  const location = useLocation();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const navState = location.state as { toastMessage?: string } | null;
    if (navState?.toastMessage) {
      const msg = navState.toastMessage;
      setTimeout(() => {
        setToastMessage(msg);
        window.history.replaceState({}, document.title);
      }, 0);
    }
  }, [location]);

  const user = state.status === 'ready' ? state.user : null;
  const userDoc = state.status === 'ready' ? state.userDoc : null;

  const { activeRole, setActiveRole, isDualRole } = useActiveRole(
    user?.uid,
    userDoc,
  );

  if (state.status !== 'ready' || !user || !userDoc) return null;
  const name = userDoc.displayName ?? 'there';

  // Admin home short-circuit.
  if (userDoc.isAdmin === true) {
    return <AdminHomeScreen name={name} />;
  }

  // Active Role routing
  if (activeRole === 'customer') {
    return (
      <>
        <CustomerDashboard
          uid={user.uid}
          userDoc={userDoc}
          activeRole={activeRole}
          onSwitchRole={setActiveRole}
          isDualRole={isDualRole}
        />
        {toastMessage && (
          <KarmaToast
            message={toastMessage}
            onClose={() => setToastMessage(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <VolunteerDashboard
        uid={user.uid}
        userDoc={userDoc}
        activeRole={activeRole}
        onSwitchRole={setActiveRole}
        isDualRole={isDualRole}
      />
      {toastMessage && (
        <KarmaToast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </>
  );
}

// Admin landing — minimal by spec
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
