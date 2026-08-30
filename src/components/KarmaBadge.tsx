// Reusable badge and trust presentation components.
// Displays points with an Indian-themed inline lotus SVG and standardized Trust Score descriptors.
// Governs: memory-bank/systemPatterns.md (Trust score [30, 100], Karma points, WCAG AA compliance).

interface KarmaBadgeProps {
  points: number;
  className?: string;
  tooltipClassName?: string;
}

export function KarmaBadge({
  points,
  className = '',
  tooltipClassName = '',
}: KarmaBadgeProps) {
  return (
    <span
      className={`relative group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-xs cursor-default select-none ${className}`}
      aria-label={`${points} neighbourhood karma points`}
    >
      {/* Custom stylized inline Lotus SVG */}
      <svg
        className="h-3.5 w-3.5 flex-shrink-0 text-amber-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M12 3C12 3 15 8 12 14C9 8 12 3 12 3Z"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <path d="M12 8C14 7 19 8 19 12C19 16 14 18 12 21" />
        <path d="M12 8C10 7 5 8 5 12C5 16 10 18 12 21" />
        <path d="M12 12C15 12 17 13 18 15" />
        <path d="M12 12C9 12 7 13 6 15" />
      </svg>
      <span>{points} pts Karma</span>

      {/* Accessible tooltip container (shows on hover/focus) */}
      <span
        role="tooltip"
        className={`absolute bottom-full left-1/2 z-50 mb-2 w-max -translate-x-1/2 scale-95 rounded-lg bg-[#131312] px-3 py-1.5 text-[11px] font-normal text-white shadow-lg opacity-0 pointer-events-none transition-all duration-150 ease-out group-hover:opacity-100 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:scale-100 ${tooltipClassName}`}
      >
        Earned through verified helpful task completions
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-[#131312]" />
      </span>
    </span>
  );
}

export function getTrustTier(score: number): {
  label: string;
  description: string;
  badgeClass: string;
} {
  if (score >= 90) {
    return {
      label: 'Exceptional Community Trust',
      description: 'Consistently verified and highly rated neighbour.',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }
  if (score >= 70) {
    return {
      label: 'High Community Trust',
      description:
        'Active verified neighbour with positive community feedback.',
      badgeClass: 'bg-[#e3efe9] text-[#1f6f5c] border-[#1f6f5c]/20',
    };
  }
  if (score >= 40) {
    return {
      label: 'Building Trust',
      description:
        'Active volunteer establishing a verified local track record.',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }
  return {
    label: 'Community Member',
    description: 'Recently joined the neighbourhood network.',
    badgeClass: 'bg-[#fafaf8] text-[#4f4b46] border-[#ececea]',
  };
}

export function TrustScorePill({
  score,
  onOpenExplainer,
}: {
  score: number;
  onOpenExplainer?: () => void;
}) {
  const tier = getTrustTier(score);

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tier.badgeClass}`}
      >
        <span aria-hidden="true">🛡️</span>
        <span>{tier.label}</span>
        <span className="opacity-70 font-mono">({score})</span>
      </span>

      {onOpenExplainer && (
        <button
          type="button"
          onClick={onOpenExplainer}
          aria-label="Learn how trust score works"
          className="grid h-5 w-5 place-items-center rounded-full bg-[#f3f1ec] text-[11px] font-bold text-[#4f4b46] transition hover:bg-[#ececea] hover:text-[#131312] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c]"
        >
          ?
        </button>
      )}
    </div>
  );
}

export function HowTrustWorksModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-labelledby="trust-modal-title"
        className="vc-fade-up relative z-10 w-full max-w-lg rounded-3xl border border-[#ececea] bg-white p-7 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e3efe9] text-lg text-[#1f6f5c]">
              🛡️
            </span>
            <div>
              <h3
                id="trust-modal-title"
                className="text-lg font-bold text-[#131312]"
              >
                How Community Trust Works
              </h3>
              <p className="text-xs text-[#4f4b46]">
                Real mutual accountability, not an algorithmic black box.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-6 space-y-4 text-xs text-[#4f4b46] leading-relaxed">
          <div className="rounded-2xl border border-[#ececea] bg-[#fafaf8] p-4">
            <div className="flex items-center gap-2 font-bold text-[#131312]">
              <span>1. In-Person Handshake Verification</span>
            </div>
            <p className="mt-1">
              Every task start and completion requires a unique 4-digit verbal
              passcode exchanged in person, preventing false or remote
              completions.
            </p>
          </div>

          <div className="rounded-2xl border border-[#ececea] bg-[#fafaf8] p-4">
            <div className="flex items-center gap-2 font-bold text-[#131312]">
              <span>2. Mutual Neighbour Feedback</span>
            </div>
            <p className="mt-1">
              Both requesters and volunteers provide mutual post-task ratings
              and feedback. Consistent helpfulness and reliability steadily
              build community trust.
            </p>
          </div>

          <div className="rounded-2xl border border-[#ececea] bg-[#fafaf8] p-4">
            <div className="flex items-center gap-2 font-bold text-[#131312]">
              <span>3. Verified Identity for Sensitive Tasks</span>
            </div>
            <p className="mt-1">
              Tasks involving home visits or sensitive assistance require
              ID-verified volunteers. ID documents are securely reviewed to keep
              the neighborhood safe.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#1f6f5c] px-6 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c]"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
