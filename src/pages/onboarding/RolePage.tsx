// Role picker — sets users/{uid}.roles. Volunteer, customer, or both.
// Reaches this page only via ProtectedRoute requires="role" — meaning the
// user is signed in, has a doc, and has recorded consent.

import { useId, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuthState, type Role } from '../../lib/auth-context';
import { db } from '../../lib/firebase';
import { OnboardingProgress } from '../../components/OnboardingProgress';

type Choice = 'volunteer' | 'customer' | 'both';

const CHOICES: { id: Choice; label: string; description: string }[] = [
  {
    id: 'volunteer',
    label: 'Volunteer',
    description: 'I want to help neighbours with small tasks nearby.',
  },
  {
    id: 'customer',
    label: 'Get help',
    description: 'I want to post small tasks I need help with.',
  },
  {
    id: 'both',
    label: 'Both',
    description: 'Sometimes I help, sometimes I ask. Show me both sides.',
  },
];

function choiceToRoles(choice: Choice): Role[] {
  if (choice === 'volunteer') return ['volunteer'];
  if (choice === 'customer') return ['customer'];
  return ['volunteer', 'customer'];
}

export default function RolePage() {
  const state = useAuthState();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupId = useId();
  const errorId = useId();

  if (state.status !== 'incomplete') {
    return null;
  }
  const user = state.user;

  async function handleSubmit() {
    if (!choice) return;
    setError(null);
    setBusy(true);
    try {
      await updateDoc(doc(db(), 'users', user.uid), {
        roles: choiceToRoles(choice),
      });
      // ProtectedRoute will automatically redirect once onSnapshot delivers the new doc:
      //   - volunteer / dual: → /onboarding/profile (step 3)
      //   - customer-only:    → /onboarding/profile (step 3)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your choice. Try again.',
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
        <OnboardingProgress current={2} />
        <h1 className="text-3xl font-bold tracking-tight text-[#131312]">
          How do you want to use this?
        </h1>
        <p className="mt-3 text-[#4f4b46]">
          You can change this later in Settings.
        </p>

        <div
          role="radiogroup"
          aria-labelledby={groupId}
          className="mt-10 space-y-3.5"
        >
          <span id={groupId} className="sr-only">
            Choose your role
          </span>
          {CHOICES.map((c) => (
            <label
              key={c.id}
              htmlFor={`role-${c.id}`}
              className={
                'grid cursor-pointer grid-cols-[auto_1fr] gap-x-4 rounded-2xl border p-5 transition ' +
                (choice === c.id
                  ? 'border-[#1f6f5c] bg-[#e3efe9]/30 ring-2 ring-[#1f6f5c] shadow-sm'
                  : 'border-[#ececea] bg-white hover:border-[#d8d4cc]')
              }
            >
              <input
                id={`role-${c.id}`}
                type="radio"
                name="role"
                value={c.id}
                checked={choice === c.id}
                onChange={() => setChoice(c.id)}
                className="row-span-2 mt-1 h-5 w-5 border-[#ececea] text-[#1f6f5c] focus:ring-[#1f6f5c]"
              />
              <span className="text-base font-semibold text-[#131312]">
                {c.label}
              </span>
              <span className="col-start-2 mt-1 text-sm text-[#4f4b46]">
                {c.description}
              </span>
            </label>
          ))}
        </div>

        {error && (
          <p id={errorId} role="alert" className="mt-6 text-sm text-[#a32a22]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!choice || busy}
          className="mt-10 rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </main>
  );
}
