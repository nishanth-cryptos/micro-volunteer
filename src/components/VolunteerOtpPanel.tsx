// Volunteer-side OTP entry. The customer shows them the code in person;
// they type it here. Calls verifyStartOtp / verifyEndOtp depending on
// the current task phase. On success the task doc flips status, the
// TaskDetailPage re-renders, and this panel unmounts.

import { useId, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface Props {
  taskId: string;
  phase: 'start' | 'end';
}

export function VolunteerOtpPanel({ taskId, phase }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!/^\d{4,6}$/.test(trimmed)) {
      setError('Enter the 6-digit code the customer showed you.');
      return;
    }
    setBusy(true);
    try {
      const fnName = phase === 'start' ? 'verifyStartOtp' : 'verifyEndOtp';
      const fn = httpsCallable<
        { taskId: string; code: string },
        { taskId: string; status: string }
      >(functions(), fnName);
      await fn({ taskId, code: trimmed });
      setCode('');
      // onSnapshot of the task in TaskDetailPage will pick up the new
      // status and this panel will unmount as the page re-renders.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not verify. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const phaseLabel = phase === 'start' ? 'start' : 'end';
  const helpText =
    phase === 'start'
      ? 'Ask the customer to show you their start code. Type it here.'
      : 'When you’re done, ask the customer for the end code to finish.';
  const buttonText = phase === 'start' ? 'Start task' : 'Finish task';

  return (
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-neutral-900">
        Enter the {phaseLabel} code
      </h2>
      <p className="mt-1 text-sm text-neutral-600">{helpText}</p>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="mt-6 space-y-4"
      >
        <label htmlFor={inputId} className="sr-only">
          {phaseLabel} code
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-center text-2xl tracking-[0.5em] text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {busy ? 'Verifying…' : buttonText}
        </button>
      </form>
    </section>
  );
}
