// Volunteer-side OTP entry. The customer shows them the 4-digit code in person;
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
    if (!/^\d{4}$/.test(trimmed)) {
      setError('Please enter the 4-digit verification code from the customer.');
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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Incorrect verification code. Please check and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const isStart = phase === 'start';
  const phaseTitle = isStart
    ? 'Start Verification Code'
    : 'Completion Verification Code';
  const helpText = isStart
    ? 'Ask the customer to show you their 4-digit Start Code when you arrive. Entering it officially starts the task.'
    : 'Ask the customer for their 4-digit Completion Code once the task is finished to confirm and complete the mission.';
  const buttonText = isStart ? 'Verify & start task' : 'Verify & complete task';

  return (
    <section className="vc-fade-up mt-8 rounded-3xl border border-[#ececea] bg-white p-7 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e3efe9] text-[#1f6f5c]">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <div>
          <h2 className="text-base font-bold text-[#131312]">
            Enter {phaseTitle}
          </h2>
          <p className="mt-0.5 text-xs text-[#4f4b46]">{helpText}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="mt-6 space-y-4"
      >
        <label htmlFor={inputId} className="sr-only">
          {phaseTitle}
        </label>
        <div className="flex justify-center">
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={4}
            placeholder="• • • •"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className="w-52 rounded-2xl border border-[#ececea] bg-[#fafaf8] px-4 py-3.5 text-center font-mono text-2xl font-bold tracking-[0.35em] text-[#131312] placeholder-[#b8b3ad] transition focus:border-[#1f6f5c] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#1f6f5c]/10 shadow-xs"
          />
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-center text-xs text-red-700"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={busy || code.trim().length !== 4}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1f6f5c] px-8 py-2.5 text-xs font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] disabled:opacity-50 shadow-sm"
          >
            {busy ? 'Verifying code…' : buttonText}
          </button>
          <p className="text-[11px] text-[#8a847d]">
            🛡️ Verification protects both you and the customer.
          </p>
        </div>
      </form>
    </section>
  );
}
