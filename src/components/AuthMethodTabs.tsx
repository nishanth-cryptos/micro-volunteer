// Tabbed switcher between Phone and Email auth flows.
// Accessible: uses `role="tablist"` / `role="tab"` / `aria-selected`.
// Governs UX direction in memory-bank/systemPatterns.md (Apple-restraint).

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
        aria-label="Choose how to continue"
        className="inline-flex rounded-full bg-neutral-100 p-1"
      >
        <Tab
          id={phoneId}
          controls={phonePanelId}
          selected={method === 'phone'}
          onClick={() => onMethodChange('phone')}
        >
          Phone
        </Tab>
        <Tab
          id={emailId}
          controls={emailPanelId}
          selected={method === 'email'}
          onClick={() => onMethodChange('email')}
        >
          Email
        </Tab>
      </div>
      <div
        id={phonePanelId}
        role="tabpanel"
        aria-labelledby={phoneId}
        hidden={method !== 'phone'}
        className="mt-8"
      >
        {method === 'phone' && phonePanel}
      </div>
      <div
        id={emailPanelId}
        role="tabpanel"
        aria-labelledby={emailId}
        hidden={method !== 'email'}
        className="mt-8"
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
        'rounded-full px-5 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ' +
        (selected
          ? 'bg-white text-neutral-900 shadow-sm'
          : 'text-neutral-600 hover:text-neutral-900')
      }
    >
      {children}
    </button>
  );
}
