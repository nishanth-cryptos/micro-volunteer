// Step 4 of onboarding (volunteers only): "What can you offer?" card grid.
// Reached only after the user has consent + role + profile (display name +
// photo). Customer-only users skip this step entirely — ProtectedRoute
// short-circuits them to /app (see lib/protected-route.tsx).
//
// Governed by: memory-bank/projectbrief.md feature #2 (roles), feature #3
// (profile / skills). Catalog source: scripts/seed/catalog.json via
// src/lib/catalog.ts.

import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuthState } from '../../lib/auth-context';
import { db } from '../../lib/firebase';
import { SKILLS } from '../../lib/catalog';
import { OnboardingProgress } from '../../components/OnboardingProgress';
import { SkillIcon } from '../../components/SkillIcon';

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
      setError('Pick at least one thing you can help with.');
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
          : 'Could not save your skills. Try again.',
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

      <div className="vc-screen-enter mx-auto max-w-3xl px-6 py-12 sm:py-20">
        <OnboardingProgress current={4} includeSkills />
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8a847d]">
          Step 4 of 4
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#131312]">
          What can you offer?
        </h1>
        <p className="mt-3 text-[#4f4b46]">
          Pick all that apply — you can always update later. Up to {MAX_SKILLS}.
        </p>

        <div
          role="group"
          aria-label="Skills you can help with"
          className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
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
                  'group flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border p-4 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ' +
                  (isSelected
                    ? 'border-[#1f6f5c] bg-[#e3efe9]/40 ring-2 ring-[#1f6f5c] shadow-sm'
                    : 'border-[#ececea] bg-white hover:border-[#d8d4cc] hover:shadow-sm')
                }
              >
                <SkillIcon skillKey={s.key} className="h-12 w-12" />
                <span className="text-sm font-semibold text-[#131312]">
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs font-medium text-[#8a847d]">
          {selected.length} / {MAX_SKILLS} selected
        </p>

        {error && (
          <p id={errorId} role="alert" className="mt-6 text-sm text-[#a32a22]">
            {error}
          </p>
        )}

        <div className="mt-10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => void navigate('/onboarding/profile')}
            className="rounded-full border border-[#ececea] bg-white px-6 py-3 text-sm font-semibold text-[#4f4b46] transition hover:bg-[#f3f1ec] hover:border-[#d8d4cc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={busy || selected.length === 0}
            className="rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Continue →'}
          </button>
        </div>
      </div>
    </main>
  );
}
