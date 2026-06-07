// T&C consent capture — creates the users/{uid} document on accept.
// Reaches this page only when ProtectedRoute determined the user is at step
// 'consent' (no doc OR doc-but-consent-missing).
//
// Consent shape written: { tcVersion: 'v1-DRAFT', acceptedAt: <serverTimestamp> }
// T&C content is a draft placeholder — replace with reviewed copy pre-launch.

import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuthState } from '../../lib/auth-context';
import { db } from '../../lib/firebase';

const TC_VERSION = 'v1-DRAFT';

export default function ConsentPage() {
  const state = useAuthState();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkboxId = useId();
  const errorId = useId();

  if (state.status !== 'no-doc' && state.status !== 'incomplete') {
    return null;
  }
  const user = state.user;

  async function handleAccept() {
    setError(null);
    setBusy(true);
    try {
      const data: Record<string, unknown> = {
        displayName: '',
        consent: { tcVersion: TC_VERSION, acceptedAt: serverTimestamp() },
        createdAt: serverTimestamp(),
      };
      if (user.phoneNumber) data.phoneNumber = user.phoneNumber;
      if (user.email) data.email = user.email;
      await setDoc(doc(db(), 'users', user.uid), data);
      void navigate('/onboarding/role', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your acceptance. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight">Read &amp; accept</h1>
        <p className="mt-3 text-neutral-600">
          A short version of our terms. The full T&amp;C is being reviewed and
          will replace this draft before launch.
        </p>

        <section className="mt-10 space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-700">
          <p>
            <strong className="text-neutral-900">Be kind and safe.</strong>{' '}
            Tasks on this platform are intended for low and medium risk help
            between neighbours. Never accept a task that feels unsafe; use the
            report button if anything is off.
          </p>
          <p>
            <strong className="text-neutral-900">Verification.</strong> We may
            ask for a photo and an ID to confirm you are a real person. Medium
            risk tasks require a verified ID.
          </p>
          <p>
            <strong className="text-neutral-900">Your data.</strong> We collect
            only what each feature needs (phone or email for sign-in, your
            location for matching, etc.). We never sell your data.
          </p>
          <p>
            <strong className="text-neutral-900">Trust &amp; conduct.</strong>{' '}
            Repeated reports lead to warnings, then a suspension, then a ban.
            All decisions are recorded.
          </p>
          <p className="text-xs text-neutral-500">
            Document version: <span className="font-mono">{TC_VERSION}</span>
          </p>
        </section>

        <div className="mt-8 flex items-start gap-3">
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
            aria-describedby={error ? errorId : undefined}
          />
          <label
            htmlFor={checkboxId}
            className="text-sm text-neutral-800"
          >
            I have read and accept the above terms.
          </label>
        </div>

        {error && (
          <p id={errorId} role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={!checked || busy}
          className="mt-8 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Accept and continue'}
        </button>
      </div>
    </main>
  );
}
