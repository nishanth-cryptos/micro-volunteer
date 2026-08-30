// Hook to manage active role ('customer' | 'volunteer') for dual-role users.
// Single-role users are strictly locked to their assigned role.
// Dual-role users can switch between 'customer' and 'volunteer', with their
// active choice persisted across page refreshes in localStorage.

import { useState } from 'react';
import type { UserDoc } from './auth-context';

export type ActiveRole = 'customer' | 'volunteer';

const STORAGE_KEY_PREFIX = 'hey_padosi_active_role_';

export function useActiveRole(
  uid: string | undefined,
  userDoc: UserDoc | null | undefined,
): {
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  isDualRole: boolean;
  hasCustomerRole: boolean;
  hasVolunteerRole: boolean;
} {
  const roles = userDoc?.roles ?? [];
  const hasCustomerRole = roles.includes('customer');
  const hasVolunteerRole = roles.includes('volunteer');
  const isDualRole = hasCustomerRole && hasVolunteerRole;

  // Track the user's preferred role for dual-role mode
  const [preferredRole, setPreferredRoleState] = useState<ActiveRole>(() => {
    if (uid && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + uid);
        if (saved === 'volunteer' || saved === 'customer') {
          return saved;
        }
      } catch {
        /* fallback */
      }
    }
    return 'customer';
  });

  // Calculate resolved effective active role purely from authorization + preference
  let activeRole: ActiveRole = 'customer';
  if (!isDualRole) {
    if (hasVolunteerRole) {
      activeRole = 'volunteer';
    } else {
      activeRole = 'customer';
    }
  } else {
    activeRole = preferredRole;
  }

  const setActiveRole = (nextRole: ActiveRole) => {
    if (!isDualRole) return;
    setPreferredRoleState(nextRole);
    if (uid && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + uid, nextRole);
      } catch {
        /* ignore localStorage quota/disabled errors */
      }
    }
  };

  return {
    activeRole,
    setActiveRole,
    isDualRole,
    hasCustomerRole,
    hasVolunteerRole,
  };
}
