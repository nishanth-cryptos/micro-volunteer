// T&C consent capture — creates the users/{uid} document on accept.
// Reaches this page only when ProtectedRoute determined the user is at step
// 'consent' (no doc OR doc-but-consent-missing).
//
// Consent shape written: { tcVersion: 'v1-DRAFT', acceptedAt: <serverTimestamp> }
// T&C content is a draft placeholder — replace with reviewed copy pre-launch.

import { useId, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuthState } from '../../lib/auth-context';
import { db } from '../../lib/firebase';

const TC_VERSION = 'v1-DRAFT';

export default function ConsentPage() {
  const state = useAuthState();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkboxId = useId();
  const errorId = useId();

  if (state.status !== 'no-doc' && state.status !== 'incomplete') {
    return null;
  }
  const user = state.user;
  const userDoc = state.status === 'incomplete' ? state.userDoc : null;

  async function handleAccept() {
    setError(null);
    setBusy(true);
    try {
      const data: Record<string, unknown> = {
        consent: { tcVersion: TC_VERSION, acceptedAt: serverTimestamp() },
      };
      if (state.status === 'no-doc' || !userDoc?.displayName) {
        data.displayName = userDoc?.displayName ?? '';
      }
      if (state.status === 'no-doc' || !userDoc?.createdAt) {
        data.createdAt = serverTimestamp();
      }
      if (user.phoneNumber) data.phoneNumber = user.phoneNumber;
      if (user.email) data.email = user.email;

      const savePromise = setDoc(doc(db(), 'users', user.uid), data, { merge: true });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Connection timed out. Please ensure Firebase emulators / database are running.',
              ),
            ),
          8000,
        ),
      );

      await Promise.race([savePromise, timeoutPromise]);
      // ProtectedRoute will automatically redirect to the next step (/onboarding/role)
      // as soon as onSnapshot delivers the updated consent doc to AuthProvider.
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
    <main className="min-h-screen bg-[#fafaf8] text-[#131312]">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#ececea] bg-white px-7">
        <div className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-[#131312]">
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
      </header>

      <div className="vc-screen-enter mx-auto max-w-2xl px-6 py-12 sm:py-20">
        <h1 className="text-3xl font-bold tracking-tight text-[#131312]">Read &amp; accept</h1>
        <p className="mt-3 text-[#4f4b46]">
          A short version of our terms. The full T&amp;C is being reviewed and
          will replace this draft before launch.
        </p>

        <section className="mt-10 space-y-4 rounded-[20px] border border-[#ececea] bg-white p-7 text-sm text-[#4f4b46] shadow-sm">
          <p>
            <strong className="text-[#131312]">Be kind and safe.</strong>{' '}
            Tasks on this platform are intended for low and medium risk help
            between neighbours. Never accept a task that feels unsafe; use the
            report button if anything is off.
          </p>
          <p>
            <strong className="text-[#131312]">Verification.</strong> We may
            ask for a photo and an ID to confirm you are a real person. Medium
            risk tasks require a verified ID.
          </p>
          <p>
            <strong className="text-[#131312]">Your data.</strong> We collect
            only what each feature needs (phone or email for sign-in, your
            location for matching, etc.). We never sell your data.
          </p>
          <p>
            <strong className="text-[#131312]">Trust &amp; conduct.</strong>{' '}
            Repeated reports lead to warnings, then a suspension, then a ban.
            All decisions are recorded.
          </p>
          <p className="text-xs text-[#8a847d]">
            Document version: <span className="font-mono">{TC_VERSION}</span>
          </p>
        </section>

        <div className="mt-8 flex items-start gap-3">
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-[#ececea] text-[#1f6f5c] focus:ring-[#1f6f5c]"
            aria-describedby={error ? errorId : undefined}
          />
          <label
            htmlFor={checkboxId}
            className="text-sm font-medium text-[#131312]"
          >
            I have read and accept the above terms.
          </label>
        </div>

        {error && (
          <p id={errorId} role="alert" className="mt-4 text-sm text-[#a32a22]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={!checked || busy}
          className="mt-8 rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Accept and continue'}
        </button>
      </div>
    </main>
  );
}
