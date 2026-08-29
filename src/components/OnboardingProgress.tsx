// Numbered onboarding stepper shown on /signup, /onboarding/role,
// /onboarding/profile, and (volunteers only) /onboarding/skills.
// The consent gate is an interstitial community agreement and intentionally precedes roles.

export type OnboardingStep = 1 | 2 | 3 | 4;

interface Props {
  current: OnboardingStep;
  // When true, render the 4-step (volunteer) variant ending in "Skills".
  // Default is 3 steps (customer-only or pre-role pages where the role is not yet known).
  includeSkills?: boolean;
}

const BASE_STEPS: { num: OnboardingStep; label: string }[] = [
  { num: 1, label: 'Account' },
  { num: 2, label: 'Role' },
  { num: 3, label: 'Profile' },
];
const SKILLS_STEP: { num: OnboardingStep; label: string } = {
  num: 4,
  label: 'Skills',
};

export function OnboardingProgress({ current, includeSkills }: Props) {
  const steps = includeSkills ? [...BASE_STEPS, SKILLS_STEP] : BASE_STEPS;

  return (
    <nav aria-label="Onboarding progress" className="mb-10 sm:mb-12">
      <ol className="flex items-center justify-center gap-1 sm:gap-2">
        {steps.map((step, idx) => {
          const completed = current > step.num;
          const isCurrent = current === step.num;
          return (
            <li
              key={step.num}
              className="flex items-center"
            >
              <div className="flex flex-col items-center">
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className={
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition sm:h-9 sm:w-9 sm:text-sm ' +
                    (completed
                      ? 'bg-[#1f6f5c] text-white shadow-sm'
                      : isCurrent
                        ? 'border-2 border-[#1f6f5c] bg-white text-[#1f6f5c] shadow-sm'
                        : 'border border-[#ececea] bg-[#f3f1ec] text-[#8a847d]')
                  }
                >
                  {completed ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.num
                  )}
                </span>
                <span
                  className={
                    'mt-1.5 text-[11px] sm:text-xs ' +
                    (isCurrent
                      ? 'font-bold text-[#131312]'
                      : completed
                        ? 'font-medium text-[#1f6f5c]'
                        : 'text-[#8a847d]')
                  }
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={
                    'mx-1.5 mb-5 h-[2px] w-8 sm:mx-3 sm:w-14 ' +
                    (current > step.num ? 'bg-[#1f6f5c]' : 'bg-[#ececea]')
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
