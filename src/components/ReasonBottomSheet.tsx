// Reusable ReasonBottomSheet component.
// Surfaces a rideshare-style bottom sheet with 4 fixed reason options.
// Tapping a reason submits immediately (no second confirm step needed).
// Governed by section 4 of implementation spec.

import { createPortal } from 'react-dom';

export interface ReasonOption<T extends string = string> {
  id: T;
  label: string;
}

interface Props<T extends string = string> {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  reasons: Array<ReasonOption<T>>;
  busy?: boolean;
  onSelect: (reasonId: T) => void;
  onClose: () => void;
}

export function ReasonBottomSheet<T extends string = string>({
  isOpen,
  title,
  subtitle,
  reasons,
  busy,
  onSelect,
  onClose,
}: Props<T>) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-neutral-900/60 p-0 sm:p-4 backdrop-blur-xs transition-opacity">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0"
        onClick={busy ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Slide-up sheet */}
      <div className="vc-fade-up relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#ececea] bg-white p-6 shadow-2xl transition-all">
        {/* Handle pill for sheet style */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-200 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-[#131312]">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 text-xs text-[#4f4b46]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition disabled:opacity-50"
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

        <ul className="mt-6 space-y-2.5">
          {reasons.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onSelect(option.id)}
                disabled={busy}
                className="group flex w-full items-center justify-between rounded-2xl border border-[#ececea] bg-[#fafaf8] p-4 text-left font-medium text-[#131312] transition hover:border-[#1f6f5c] hover:bg-[#e3efe9]/40 hover:text-[#1f6f5c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] disabled:opacity-50"
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1f6f5c]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {busy && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-[#1f6f5c]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1f6f5c] border-t-transparent" />
            Processing…
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
