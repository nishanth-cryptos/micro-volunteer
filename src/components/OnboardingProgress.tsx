// Numbered onboarding stepper shown on /signup, /onboarding/role,
// /onboarding/profile, and (volunteers only) /onboarding/skills.
// The consent gate is an interstitial and intentionally not numbered.

export type OnboardingStep = 1 | 2 | 3 | 4;

interface Props {
  current: OnboardingStep;
  // When true, render the 4-step (volunteer) variant ending in "Skills".
  // Default is 3 steps (customer-only or pre-role pages where the role
  // is not yet known).
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
    <nav aria-label="Onboarding progress" className="mb-12">
      <ol className="flex items-start justify-center gap-2 sm:gap-3">
        {steps.map((step, idx) => {
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
                      ? 'bg-[#1f6f5c] text-white shadow-sm'
                      : 'border border-[#ececea] bg-white text-[#8a847d]')
                  }
                >
                  {completed ? '✓' : step.num}
                </span>
                <span
                  className={
                    'mt-2 text-xs ' +
                    (isCurrent
                      ? 'font-semibold text-[#131312]'
                      : 'text-[#8a847d]')
                  }
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={
                    'mt-4 h-px w-10 sm:w-16 ' +
                    (completed ? 'bg-[#1f6f5c]' : 'bg-[#ececea]')
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
