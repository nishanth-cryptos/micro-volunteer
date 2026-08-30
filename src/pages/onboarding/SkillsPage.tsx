// Step 4 of onboarding (volunteers only): "What can you offer?" card grid.
// Reached only after the user has consent + role + profile (display name + photo).
// Customer-only users skip this step entirely — ProtectedRoute routes them to /app.

import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuthState } from '../../lib/auth-context';
import { db } from '../../lib/firebase';
import { SKILLS } from '../../lib/catalog';
import { OnboardingProgress } from '../../components/OnboardingProgress';
import { SkillIcon } from '../../components/SkillIcon';
import { Logo } from '../../components/Logo';

const MAX_SKILLS = 10;

export default function SkillsPage() {
  const state = useAuthState();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  if (state.status !== 'incomplete') return null;
  const user = state.user;

  function toggle(key: string) {
    setError(null);
    setSelected((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_SKILLS
          ? prev
          : [...prev, key],
    );
  }

  async function handleContinue() {
    setError(null);
    if (selected.length === 0) {
      setError('Please select at least one skill or task you can help with.');
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db(), 'users', user.uid), { skills: selected });
      // ProtectedRoute will see status flip to 'ready' once onSnapshot
      // delivers the new doc, then redirect to /app.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your skills. Please try again.',
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
      </header>

      <main className="vc-screen-enter mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <OnboardingProgress current={4} includeSkills />

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#131312] sm:text-3xl">
            What can you help with?
          </h1>
          <p className="mt-2 text-sm text-[#4f4b46]">
            Your skills help us send you relevant tasks nearby. You can select
            up to {MAX_SKILLS} and change them anytime.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#ececea] bg-white px-3.5 py-1 text-xs font-semibold text-[#131312] shadow-sm">
            <span
              className={
                'h-2 w-2 rounded-full ' +
                (selected.length > 0 ? 'bg-[#1f6f5c]' : 'bg-[#8a847d]')
              }
            />
            {selected.length} of {MAX_SKILLS} skills selected
          </div>
        </div>

        <div
          role="group"
          aria-label="Skills and task categories"
          className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
        >
          {SKILLS.map((s) => {
            const isSelected = selected.includes(s.key);
            const atLimit = !isSelected && selected.length >= MAX_SKILLS;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(s.key)}
                disabled={atLimit}
                className={
                  'group relative flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border p-4 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ' +
                  (isSelected
                    ? 'border-[#1f6f5c] bg-[#e3efe9]/50 ring-2 ring-[#1f6f5c] shadow-sm'
                    : 'border-[#ececea] bg-white hover:border-[#d8d4cc] hover:shadow-sm')
                }
              >
                {isSelected && (
                  <span className="absolute top-2.5 right-2.5 grid h-5 w-5 place-items-center rounded-full bg-[#1f6f5c] text-white shadow-xs">
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                )}
                <SkillIcon
                  skillKey={s.key}
                  className="h-10 w-10 sm:h-12 sm:w-12"
                />
                <span className="text-xs font-semibold leading-tight text-[#131312] sm:text-sm">
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div
            id={errorId}
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#f5c6cb] bg-[#fdf0ef] p-3.5 text-sm text-[#a32a22]"
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

        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => void navigate('/onboarding/profile')}
            className="rounded-full border border-[#ececea] bg-white px-6 py-3 text-sm font-semibold text-[#4f4b46] shadow-sm transition hover:border-[#d8d4cc] hover:bg-[#f3f1ec] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2"
          >
            ← Back to Profile
          </button>
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={busy || selected.length === 0}
            className="rounded-full bg-[#1f6f5c] px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving skills…' : 'Complete Setup & Enter Dashboard →'}
          </button>
        </div>
      </main>
    </div>
  );
}
