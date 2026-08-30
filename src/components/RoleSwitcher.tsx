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
        <span aria-hidden="true">🛒</span>
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
        <span aria-hidden="true">🤝</span>
        <span>Help Others</span>
      </button>
    </div>
  );
}
