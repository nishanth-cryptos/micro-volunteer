// T&C consent capture — creates the users/{uid} document on accept.
// Reaches this page only when ProtectedRoute determined the user is at step
// 'consent' (no doc OR doc-but-consent-missing).
//
// Consent shape written: { tcVersion: 'v1-DRAFT', acceptedAt: <serverTimestamp> }

import { useId, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuthState } from '../../lib/auth-context';
import { db } from '../../lib/firebase';
import { Logo } from '../../components/Logo';

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
                'Connection timed out. Please ensure your internet connection or database is active.',
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
          : 'Could not record your acceptance. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#131312]">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#ececea] bg-[#fafaf8]/90 px-6 backdrop-blur-md sm:px-10">
        <div className="flex items-center gap-2.5 font-bold tracking-tight text-[#131312]">
          <Logo size="md" />
        </div>
        <span className="rounded-full bg-[#f3f1ec] px-3 py-1 text-xs font-semibold text-[#4f4b46]">
          Step 1: Community Agreement
        </span>
      </header>

      <main className="vc-screen-enter mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#131312] sm:text-3xl">
            Community Guidelines &amp; Terms
          </h1>
          <p className="mt-2 text-sm text-[#4f4b46]">
            Hey Padosi is built on mutual respect and neighbourly safety. Please review our core principles before continuing.
          </p>
        </div>

        <section className="mt-8 divide-y divide-[#ececea] rounded-3xl border border-[#ececea] bg-white shadow-sm">
          <div className="p-6 sm:p-7">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e3efe9] text-[#1f6f5c]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#131312]">1. Safe, Low-Risk Neighbourhood Tasks</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#4f4b46]">
                  This platform is designed for safe everyday assistance (e.g. plant watering, tech setup, carrying groceries). Never accept or perform a task that feels unsafe or violates local regulations.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-7">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e3efe9] text-[#1f6f5c]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#131312]">2. Identity &amp; Verification</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#4f4b46]">
                  To protect community members, users provide real names and profile photos. Medium-risk tasks require ID verification for added safety.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-7">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e3efe9] text-[#1f6f5c]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#131312]">3. Privacy &amp; Local Location Use</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#4f4b46]">
                  Your location is used solely to match you with nearby tasks and volunteers within your area. We never sell your personal data to third parties.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-7">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e3efe9] text-[#1f6f5c]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#131312]">4. Community Trust &amp; Moderation</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#4f4b46]">
                  Any harassment, unsafe conduct, or misuse will result in instant reporting, strike warnings, suspension, or permanent account bans.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#fafaf8] p-4 text-center text-xs text-[#8a847d] rounded-b-3xl">
            Agreement Version: <span className="font-mono font-semibold">{TC_VERSION}</span>
          </div>
        </section>

        <div className="mt-6 rounded-2xl border border-[#ececea] bg-white p-5 shadow-sm">
          <label
            htmlFor={checkboxId}
            className="flex cursor-pointer items-start gap-3 select-none"
          >
            <input
              id={checkboxId}
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              aria-describedby={error ? errorId : undefined}
              className="mt-0.5 h-5 w-5 rounded border-[#ececea] text-[#1f6f5c] focus:ring-[#1f6f5c]"
            />
            <span className="text-sm font-medium text-[#131312]">
              I have read and agree to follow the Hey Padosi Community Guidelines and Terms of Service.
            </span>
          </label>
        </div>

        {error && (
          <div
            id={errorId}
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#f5c6cb] bg-[#fdf0ef] p-3.5 text-sm text-[#a32a22]"
          >
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={!checked || busy}
          className="mt-6 w-full rounded-full bg-[#1f6f5c] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Recording acceptance…' : 'Accept & Continue to Role Selection →'}
        </button>
      </main>
    </div>
  );
}
