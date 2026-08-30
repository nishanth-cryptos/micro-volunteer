// Role picker — sets users/{uid}.roles. Volunteer, customer, or both.
// Reaches this page only via ProtectedRoute requires="role" — meaning the
// user is signed in, has a doc, and has recorded consent.

import { useId, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuthState, type Role } from '../../lib/auth-context';
import { db } from '../../lib/firebase';
import { OnboardingProgress } from '../../components/OnboardingProgress';
import { Logo } from '../../components/Logo';

type Choice = 'both' | 'volunteer' | 'customer';

interface RoleOption {
  id: Choice;
  badge?: string;
  title: string;
  subtitle: string;
  icon: (props: { className?: string }) => React.ReactNode;
}

const CHOICES: RoleOption[] = [
  {
    id: 'both',
    badge: 'Recommended',
    title: 'Both — Ask & Help (Dual Role)',
    subtitle:
      'Lend a hand when you have free time, and ask for help when you need a hand. The full community experience.',
    icon: ({ className }) => (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
      </svg>
    ),
  },
  {
    id: 'volunteer',
    title: 'Volunteer — Help Neighbours',
    subtitle:
      'Receive proximity notifications when nearby neighbours need assistance matching your skills and schedule.',
    icon: ({ className }) => (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    ),
  },
  {
    id: 'customer',
    title: 'Get Help — Post Tasks',
    subtitle:
      'Post everyday small tasks (watering plants, moving groceries, tech help) and match with verified nearby volunteers.',
    icon: ({ className }) => (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
    ),
  },
];

function choiceToRoles(choice: Choice): Role[] {
  if (choice === 'volunteer') return ['volunteer'];
  if (choice === 'customer') return ['customer'];
  return ['volunteer', 'customer'];
}

export default function RolePage() {
  const state = useAuthState();
  const [choice, setChoice] = useState<Choice>('both');
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
          : 'Could not save your choice. Please try again.',
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

      <main className="vc-screen-enter mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <OnboardingProgress current={2} includeSkills={choice !== 'customer'} />

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#131312] sm:text-3xl">
            How would you like to participate?
          </h1>
          <p className="mt-2 text-sm text-[#4f4b46]">
            Choose your primary role. You can update or switch this anytime from
            your account settings.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby={groupId}
          className="mt-8 space-y-4"
        >
          <span id={groupId} className="sr-only">
            Choose your community role
          </span>
          {CHOICES.map((c) => {
            const isSelected = choice === c.id;
            const Icon = c.icon;
            return (
              <label
                key={c.id}
                htmlFor={`role-${c.id}`}
                className={
                  'relative grid grid-cols-[auto_1fr] cursor-pointer items-start gap-x-4 rounded-2xl border p-5 transition sm:p-6 ' +
                  (isSelected
                    ? 'border-[#1f6f5c] bg-white ring-2 ring-[#1f6f5c] shadow-sm'
                    : 'border-[#ececea] bg-white hover:border-[#d8d4cc] hover:shadow-sm')
                }
              >
                <input
                  id={`role-${c.id}`}
                  type="radio"
                  name="role"
                  value={c.id}
                  checked={isSelected}
                  onChange={() => setChoice(c.id)}
                  className="row-span-2 mt-1 h-5 w-5 border-[#ececea] text-[#1f6f5c] focus:ring-[#1f6f5c]"
                />
                <span className="flex items-center gap-2 text-base font-bold text-[#131312]">
                  <span
                    className={
                      'grid h-7 w-7 place-items-center rounded-lg ' +
                      (isSelected
                        ? 'bg-[#e3efe9] text-[#1f6f5c]'
                        : 'bg-[#f3f1ec] text-[#4f4b46]')
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {c.title}
                  {c.badge && (
                    <span className="rounded-full bg-[#e3efe9] px-2.5 py-0.5 text-xs font-semibold text-[#1f6f5c]">
                      {c.badge}
                    </span>
                  )}
                </span>
                <span className="col-start-2 mt-1 text-sm leading-relaxed text-[#4f4b46]">
                  {c.subtitle}
                </span>
              </label>
            );
          })}
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
          onClick={() => void handleSubmit()}
          disabled={!choice || busy}
          className="mt-8 w-full rounded-full bg-[#1f6f5c] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving role…' : 'Continue to Profile Setup →'}
        </button>
      </main>
    </div>
  );
}
