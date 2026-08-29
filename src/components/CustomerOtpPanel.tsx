// Customer-side OTP panel. Renders inside TaskDetailPage based on the
// current task status:
//   accepted    → "Get start code" button; once fetched, shows the
//                 plaintext code in flip-reveal cells with a countdown.
//   in_progress → "Get end code" button; same code/countdown UX.
//
// Plaintext is only ever in local state — the callable returns it once,
// the task doc only carries the hash. Page refresh loses the code; the
// customer can generate a fresh one.
//
// Visual theme ported from Claude Design handoff bundle (2026-06-14).

import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface OtpResponse {
  code: string;
  expiresAtMs: number;
}

interface Props {
  taskId: string;
  phase: 'start' | 'end';
}

export function CustomerOtpPanel({ taskId, phase }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAtMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAtMs]);

  const remainingMs = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0;
  const expired = expiresAtMs !== null && remainingMs === 0;

  async function handleGenerate() {
    setError(null);
    setBusy(true);
    try {
      const fnName = phase === 'start' ? 'generateStartOtp' : 'generateEndOtp';
      const fn = httpsCallable<{ taskId: string }, OtpResponse>(
        functions(),
        fnName,
      );
      const result = await fn({ taskId });
      setCode(result.data.code);
      setExpiresAtMs(result.data.expiresAtMs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not get a code. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const [copied, setCopied] = useState(false);

  const phaseLabel = phase === 'start' ? 'Start' : 'End';
  const helpText =
    phase === 'start'
      ? 'Share this 4-digit code with your volunteer when they arrive to officially start the task.'
      : 'When the volunteer has completed your task, share this code to confirm task completion.';

  const handleCopy = () => {
    if (!code) return;
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="vc-fade-up mt-6 rounded-3xl border border-[#ececea] bg-white p-6 shadow-xs">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold tracking-tight text-[#131312]">
          {phaseLabel} Verification Code
        </h2>
        {code && !expired && (
          <span className="font-mono text-[12px] text-[#8a847d]">
            Refreshes in {formatRemaining(remainingMs)}
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px] text-[#4f4b46]">{helpText}</p>

      {code && !expired && (
        <div className="mt-5 flex flex-col items-center">
          <div
            // Re-key so the flip animation re-runs on every fresh code.
            key={code}
            className="flex justify-center gap-2.5"
            aria-label={`Your code is ${code.split('').join(' ')}`}
          >
            {code.split('').map((digit, i) => (
              <span
                key={i}
                className="vc-cell grid h-14 w-12 place-items-center rounded-xl border border-[#ececea] bg-gradient-to-b from-white to-[#fafaf8] font-mono text-2xl font-bold text-[#131312] shadow-[0_4px_10px_-6px_rgba(20,18,15,0.15)]"
                style={{ animationDelay: `${(i * 0.08).toFixed(2)}s` }}
                aria-hidden="true"
              >
                {digit}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#ececea] bg-[#fafaf8] px-3.5 py-1 text-xs font-medium text-[#4f4b46] transition hover:border-[#1f6f5c] hover:bg-white hover:text-[#131312] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c]"
          >
            {copied ? '✓ Copied to clipboard' : '📋 Copy code'}
          </button>
        </div>
      )}

      {expired && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          That code has expired. Please generate a fresh verification code.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#f3f1ec] pt-4">
        <p className="text-xs text-[#8a847d]">
          🛡️ Protects you by ensuring tasks only start/finish with your direct confirmation.
        </p>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={busy}
          className={
            'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:opacity-50 ' +
            (code && !expired
              ? 'border border-[#ececea] bg-white text-[#4f4b46] hover:border-[#1f6f5c] hover:text-[#131312]'
              : 'bg-gradient-to-r from-[#1f6f5c] to-[#185845] text-white shadow-[0_8px_18px_-8px_rgba(31,111,92,0.55)] hover:from-[#1d6655] hover:to-[#14503e]')
          }
        >
          {busy
            ? 'Generating…'
            : code && !expired
              ? 'Generate new code'
              : `Generate ${phaseLabel.toLowerCase()} code`}
        </button>
      </div>
    </section>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins)}:${secs.toString().padStart(2, '0')}`;
}
