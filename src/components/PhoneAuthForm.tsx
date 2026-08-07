// Phone Auth — two-step form: phone number → OTP code.
// Used by both /signup and /login (Firebase's signInWithPhoneNumber is
// idempotent on existing accounts: it just signs them in).
// Auth emulator: reCAPTCHA is bypassed automatically and the OTP appears
// in the Emulator UI (and in the firebase emulators:start terminal log).

import { useEffect, useId, useRef, useState } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { readableAuthError } from '../lib/auth-errors';

interface Props {
  mode: 'signup' | 'login';
}

// `mode` is currently informational only (kept for future UX differences
// like "verify your phone again" copy). Navigation is handled by the page
// via useRedirectWhenSignedIn() to avoid racing AuthProvider state updates.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PhoneAuthForm({ mode: _mode }: Props) {
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+91 ');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const phoneId = useId();
  const codeId = useId();

  useEffect(() => {
    if (!recaptchaContainerRef.current) return;
    recaptchaRef.current = new RecaptchaVerifier(
      auth(),
      recaptchaContainerRef.current,
      { size: 'invisible' },
    );
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const verifier = recaptchaRef.current;
    if (!verifier) {
      setError('reCAPTCHA not ready. Please wait a moment and try again.');
      return;
    }
    const normalized = phone.replace(/\s+/g, '');
    setBusy(true);
    try {
      confirmationRef.current = await signInWithPhoneNumber(
        auth(),
        normalized,
        verifier,
      );
      setStep('code');
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const confirmation = confirmationRef.current;
    if (!confirmation) {
      setError('Session expired. Please request a new code.');
      setStep('phone');
      return;
    }
    setBusy(true);
    try {
      await confirmation.confirm(code.trim());
      // Page-level useRedirectWhenSignedIn() handles navigation once
      // AuthProvider catches the new user. Don't navigate from here — racing.
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {step === 'phone' ? (
        <form
          onSubmit={(e) => void handlePhoneSubmit(e)}
          noValidate
          className="space-y-6"
        >
          <div>
            <label
              htmlFor={phoneId}
              className="block text-sm font-medium text-[#131312]"
            >
              Phone number
            </label>
            <input
              id={phoneId}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={error !== null}
              aria-describedby={error ? `${phoneId}-error` : undefined}
              placeholder="+91 99999 99999"
              className="mt-2 w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-base text-[#131312] placeholder-[#8a847d] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
            />
            <p className="mt-2 text-xs text-[#8a847d]">
              Include the country code. We&apos;ll send a one-time code.
            </p>
          </div>
          {error && (
            <p
              id={`${phoneId}-error`}
              role="alert"
              className="text-sm text-[#a32a22]"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => void handleCodeSubmit(e)}
          noValidate
          className="space-y-6"
        >
          <div>
            <label
              htmlFor={codeId}
              className="block text-sm font-medium text-[#131312]"
            >
              Enter the code we sent to {phone.trim()}
            </label>
            <input
              id={codeId}
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-invalid={error !== null}
              aria-describedby={error ? `${codeId}-error` : undefined}
              className="mt-2 w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] text-[#131312] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
            />
          </div>
          {error && (
            <p
              id={`${codeId}-error`}
              role="alert"
              className="text-sm text-[#a32a22]"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify and continue'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setCode('');
              setError(null);
            }}
            className="block w-full text-sm font-medium text-[#4f4b46] transition hover:text-[#131312]"
          >
            Use a different number
          </button>
        </form>
      )}
      <div ref={recaptchaContainerRef} aria-hidden="true" />
    </>
  );
}
