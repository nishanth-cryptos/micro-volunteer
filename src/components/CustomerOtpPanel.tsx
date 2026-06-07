// Customer-side OTP panel. Renders inside TaskDetailPage based on the
// current task status:
//   accepted    → "Get start code" button; once fetched, shows the
//                 plaintext code with a 10-minute countdown.
//   in_progress → "Get end code" button; same code/countdown UX.
//
// Plaintext is only ever in local state — the callable returns it once,
// the task doc only carries the hash. Page refresh loses the code; the
// customer can generate a fresh one.

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

  const phaseLabel = phase === 'start' ? 'Start' : 'End';
  const helpText =
    phase === 'start'
      ? 'Show this code to the volunteer when they arrive. They’ll enter it on their phone to start the task.'
      : 'The volunteer says they’re done? Show them this code to finish the task. They’ll enter it on their phone.';

  return (
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-neutral-900">
        {phaseLabel} code
      </h2>
      <p className="mt-1 text-sm text-neutral-600">{helpText}</p>

      {code && !expired && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-neutral-900 px-6 py-5 text-white">
          <span
            className="font-mono text-3xl tracking-[0.4em]"
            aria-label={`Your code is ${code.split('').join(' ')}`}
          >
            {code}
          </span>
          <span className="text-sm text-neutral-300">
            Expires in {formatRemaining(remainingMs)}
          </span>
        </div>
      )}

      {expired && (
        <p className="mt-4 text-sm text-amber-700">
          That code has expired. Generate a new one.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={busy}
        className="mt-6 rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {busy
          ? 'Getting…'
          : code && !expired
            ? 'Get a different code'
            : `Get ${phase} code`}
      </button>
    </section>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins)}:${secs.toString().padStart(2, '0')}`;
}
