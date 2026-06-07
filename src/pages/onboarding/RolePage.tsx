// Role picker — sets users/{uid}.roles. Volunteer, customer, or both.
// Reaches this page only via ProtectedRoute requires="role" — meaning the
// user is signed in, has a doc, and has recorded consent.

import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuthState, type Role } from '../../lib/auth-context';
import { db } from '../../lib/firebase';

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
  const navigate = useNavigate();
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
      void navigate('/app', { replace: true });
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
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight">
          How do you want to use this?
        </h1>
        <p className="mt-3 text-neutral-600">
          You can change this later in Settings.
        </p>

        <div
          role="radiogroup"
          aria-labelledby={groupId}
          className="mt-10 space-y-3"
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
                  ? 'border-neutral-900 bg-white shadow-sm'
                  : 'border-neutral-200 bg-white hover:border-neutral-400')
              }
            >
              <input
                id={`role-${c.id}`}
                type="radio"
                name="role"
                value={c.id}
                checked={choice === c.id}
                onChange={() => setChoice(c.id)}
                className="row-span-2 mt-1 h-5 w-5 border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
              <span className="text-base font-medium text-neutral-900">
                {c.label}
              </span>
              <span className="col-start-2 mt-1 text-sm text-neutral-600">
                {c.description}
              </span>
            </label>
          ))}
        </div>

        {error && (
          <p id={errorId} role="alert" className="mt-6 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!choice || busy}
          className="mt-10 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </main>
  );
}
