// Tabbed switcher between Phone and Email auth flows.
// Accessible: uses `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`.
// Governs UX direction: Clean segmented control with clear tactile feedback.

import { useId, type ReactNode } from 'react';

export type AuthMethod = 'phone' | 'email';

interface Props {
  method: AuthMethod;
  onMethodChange: (m: AuthMethod) => void;
  phonePanel: ReactNode;
  emailPanel: ReactNode;
}

export function AuthMethodTabs({
  method,
  onMethodChange,
  phonePanel,
  emailPanel,
}: Props) {
  const phoneId = useId();
  const emailId = useId();
  const phonePanelId = `${phoneId}-panel`;
  const emailPanelId = `${emailId}-panel`;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Choose authentication method"
        className="grid grid-cols-2 rounded-2xl border border-[#ececea] bg-[#f3f1ec] p-1.5 shadow-inner"
      >
        <Tab
          id={phoneId}
          controls={phonePanelId}
          selected={method === 'phone'}
          onClick={() => onMethodChange('phone')}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          Phone OTP
        </Tab>
        <Tab
          id={emailId}
          controls={emailPanelId}
          selected={method === 'email'}
          onClick={() => onMethodChange('email')}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          Email &amp; Password
        </Tab>
      </div>

      <div
        id={phonePanelId}
        role="tabpanel"
        aria-labelledby={phoneId}
        hidden={method !== 'phone'}
        tabIndex={0}
        className="mt-8 focus:outline-none"
      >
        {method === 'phone' && phonePanel}
      </div>

      <div
        id={emailPanelId}
        role="tabpanel"
        aria-labelledby={emailId}
        hidden={method !== 'email'}
        tabIndex={0}
        className="mt-8 focus:outline-none"
      >
        {method === 'email' && emailPanel}
      </div>
    </div>
  );
}

function Tab({
  id,
  controls,
  selected,
  onClick,
  children,
}: {
  id: string;
  controls: string;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      id={id}
      role="tab"
      type="button"
      aria-selected={selected}
      aria-controls={controls}
      onClick={onClick}
      className={
        'flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-1 ' +
        (selected
          ? 'bg-white text-[#131312] shadow-sm font-semibold'
          : 'text-[#4f4b46] hover:text-[#131312]')
      }
    >
      {children}
    </button>
  );
}
