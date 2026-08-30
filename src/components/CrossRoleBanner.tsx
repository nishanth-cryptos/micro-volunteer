// Cross-role awareness indicator for dual-role users.
// Ensures users never lose track of active missions or requests in their
// other role while working in the current role.

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserDoc } from '../lib/auth-context';
import type { ActiveRole } from '../lib/use-active-role';

interface Props {
  uid: string;
  userDoc: UserDoc;
  activeRole: ActiveRole;
  isDualRole: boolean;
  onSwitchRole: (role: ActiveRole) => void;
}

export function CrossRoleBanner({
  uid,
  userDoc,
  activeRole,
  isDualRole,
  onSwitchRole,
}: Props) {
  const [otherActiveCount, setOtherActiveCount] = useState(0);

  useEffect(() => {
    if (!isDualRole) return;

    if (activeRole === 'customer') {
      // In Customer mode: watch active Volunteer tasks
      const q = query(
        collection(db(), 'tasks'),
        where('acceptedVolunteerId', '==', uid),
        where('status', 'in', ['accepted', 'in_progress']),
      );
      const unsub = onSnapshot(
        q,
        (snap) => setOtherActiveCount(snap.size),
        () => setOtherActiveCount(0),
      );
      return unsub;
    } else {
      // In Volunteer mode: watch active Customer tasks
      const q = query(
        collection(db(), 'tasks'),
        where('customerId', '==', uid),
        where('status', 'in', ['searching', 'accepted', 'in_progress']),
      );
      const unsub = onSnapshot(
        q,
        (snap) => setOtherActiveCount(snap.size),
        () => setOtherActiveCount(0),
      );
      return unsub;
    }
  }, [uid, activeRole, isDualRole]);

  if (!isDualRole) return null;

  // In Customer mode
  if (activeRole === 'customer') {
    if (otherActiveCount > 0) {
      return (
        <div className="vc-fade-in mx-auto max-w-2xl px-6 pt-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1f6f5c]/20 bg-[#e3efe9]/60 px-4 py-2.5 text-xs text-[#131312]">
            <div className="flex items-center gap-2 font-medium">
              <span className="text-sm">🤝</span>
              <span>
                You have{' '}
                <strong className="font-bold text-[#1f6f5c]">
                  {otherActiveCount} active mission{otherActiveCount > 1 ? 's' : ''}
                </strong>{' '}
                as a Volunteer.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchRole('volunteer')}
              className="inline-flex items-center gap-1 font-bold text-[#1f6f5c] hover:underline focus:outline-none"
            >
              <span>Switch to Help Others →</span>
            </button>
          </div>
        </div>
      );
    }

    if (userDoc.availableNow) {
      return (
        <div className="vc-fade-in mx-auto max-w-2xl px-6 pt-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-2 text-xs text-emerald-900">
            <div className="flex items-center gap-2 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>You are currently marked available to receive volunteer requests.</span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchRole('volunteer')}
              className="font-bold text-[#1f6f5c] hover:underline focus:outline-none"
            >
              Manage availability →
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  // In Volunteer mode
  if (activeRole === 'volunteer') {
    if (otherActiveCount > 0) {
      return (
        <div className="vc-fade-in mx-auto max-w-2xl px-6 pt-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1f6f5c]/20 bg-[#e3efe9]/60 px-4 py-2.5 text-xs text-[#131312]">
            <div className="flex items-center gap-2 font-medium">
              <span className="text-sm">🛒</span>
              <span>
                You have{' '}
                <strong className="font-bold text-[#1f6f5c]">
                  {otherActiveCount} active request{otherActiveCount > 1 ? 's' : ''}
                </strong>{' '}
                as a Requester.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchRole('customer')}
              className="inline-flex items-center gap-1 font-bold text-[#1f6f5c] hover:underline focus:outline-none"
            >
              <span>Switch to Need Help →</span>
            </button>
          </div>
        </div>
      );
    }
  }

  return null;
}
