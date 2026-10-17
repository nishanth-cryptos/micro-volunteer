// Role switcher for dual-role users (Customer + Volunteer).
// Renders a sleek segmented control pill in the navigation header.
// Single-role users render nothing (zero UI clutter).

import type { ActiveRole } from '../lib/use-active-role';

interface Props {
  activeRole: ActiveRole;
  onSwitchRole: (role: ActiveRole) => void;
  isDualRole: boolean;
  compact?: boolean;
}

export function RoleSwitcher({
  activeRole,
  onSwitchRole,
  isDualRole,
  compact = false,
}: Props) {
  if (!isDualRole) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Active role mode"
      className={
        'inline-flex items-center rounded-full border border-[#ececea] bg-[#fafaf8] p-0.5 shadow-2xs ' +
        (compact ? 'text-[11px]' : 'text-xs')
      }
    >
      <button
        type="button"
        role="radio"
        aria-checked={activeRole === 'customer'}
        onClick={() => onSwitchRole('customer')}
        className={
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] ' +
          (activeRole === 'customer'
            ? 'bg-[#1f6f5c] text-white shadow-xs'
            : 'text-[#4f4b46] hover:text-[#131312]')
        }
      >
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
        <span>Need Help</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={activeRole === 'volunteer'}
        onClick={() => onSwitchRole('volunteer')}
        className={
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] ' +
          (activeRole === 'volunteer'
            ? 'bg-[#1f6f5c] text-white shadow-xs'
            : 'text-[#4f4b46] hover:text-[#131312]')
        }
      >
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <span>Help Others</span>
      </button>
    </div>
  );
}
