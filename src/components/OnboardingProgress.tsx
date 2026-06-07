// Numbered onboarding stepper shown on /signup, /onboarding/role, and
// /onboarding/profile. Three steps total. The consent gate is an
// interstitial and intentionally not numbered.

export type OnboardingStep = 1 | 2 | 3;

interface Props {
  current: OnboardingStep;
}

const STEPS: { num: OnboardingStep; label: string }[] = [
  { num: 1, label: 'Account' },
  { num: 2, label: 'Role' },
  { num: 3, label: 'Profile' },
];

export function OnboardingProgress({ current }: Props) {
  return (
    <nav aria-label="Onboarding progress" className="mb-12">
      <ol className="flex items-start justify-center gap-2 sm:gap-3">
        {STEPS.map((step, idx) => {
          const completed = current > step.num;
          const isCurrent = current === step.num;
          return (
            <li
              key={step.num}
              className="flex items-start gap-2 sm:gap-3"
            >
              <div className="flex flex-col items-center">
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className={
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition ' +
                    (completed || isCurrent
                      ? 'bg-neutral-900 text-white'
                      : 'border border-neutral-300 bg-white text-neutral-500')
                  }
                >
                  {completed ? '✓' : step.num}
                </span>
                <span
                  className={
                    'mt-2 text-xs ' +
                    (isCurrent
                      ? 'font-medium text-neutral-900'
                      : 'text-neutral-500')
                  }
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={
                    'mt-4 h-px w-10 sm:w-16 ' +
                    (completed ? 'bg-neutral-900' : 'bg-neutral-300')
                  }
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
