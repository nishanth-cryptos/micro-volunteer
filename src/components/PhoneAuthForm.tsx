// Phone Auth — two-step form: phone number → OTP code.
// Used by both /signup and /login (Firebase's signInWithPhoneNumber is
// idempotent on existing accounts: it just signs them in).

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

export function PhoneAuthForm({ mode }: Props) {
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+91 ');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const phoneId = useId();
  const codeId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!recaptchaContainerRef.current) return;
    try {
      recaptchaRef.current = new RecaptchaVerifier(
        auth(),
        recaptchaContainerRef.current,
        { size: 'invisible' },
      );
    } catch {
      // Recaptcha may already be initialized in this container
    }
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (step === 'code' && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [step]);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = phone.replace(/\s+/g, '');
    if (normalized.length < 10) {
      setError('Please enter a complete phone number with country code.');
      return;
    }
    const verifier = recaptchaRef.current;
    if (!verifier) {
      setError('Verification service not ready. Please refresh the page.');
      return;
    }
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
    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    const confirmation = confirmationRef.current;
    if (!confirmation) {
      setError('Verification session expired. Please request a new code.');
      setStep('phone');
      return;
    }
    setBusy(true);
    try {
      await confirmation.confirm(cleanCode);
      // Page-level useRedirectWhenSignedIn() handles navigation once
      // AuthProvider catches the new user.
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendCode() {
    setError(null);
    const verifier = recaptchaRef.current;
    if (!verifier) return;
    const normalized = phone.replace(/\s+/g, '');
    setBusy(true);
    try {
      confirmationRef.current = await signInWithPhoneNumber(
        auth(),
        normalized,
        verifier,
      );
      setCode('');
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {step === 'phone' ? (
        <form
          onSubmit={(e) => void handlePhoneSubmit(e)}
          noValidate
          className="space-y-5"
        >
          <div>
            <label
              htmlFor={phoneId}
              className="block text-sm font-semibold text-[#131312]"
            >
              Mobile phone number
            </label>
            <div className="relative mt-2">
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
                aria-describedby={error ? errorId : `${phoneId}-hint`}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-base text-[#131312] placeholder-[#8a847d] shadow-sm transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
              />
            </div>
            <p id={`${phoneId}-hint`} className="mt-2 text-xs text-[#8a847d]">
              We&apos;ll send a 6-digit SMS verification code. Standard rates
              may apply.
            </p>
          </div>

          {error && (
            <div
              id={errorId}
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-[#f5c6cb] bg-[#fdf0ef] p-3.5 text-sm text-[#a32a22]"
            >
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || phone.trim().length < 6}
            className="w-full rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? 'Sending code…'
              : mode === 'signup'
                ? 'Send verification code'
                : 'Sign in with OTP'}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => void handleCodeSubmit(e)}
          noValidate
          className="space-y-5"
        >
          <div className="rounded-2xl border border-[#ececea] bg-white p-5 text-center shadow-sm">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#e3efe9] text-[#1f6f5c]">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <label
              htmlFor={codeId}
              className="mt-3 block text-sm font-semibold text-[#131312]"
            >
              Enter 6-digit code
            </label>
            <p className="mt-1 text-xs text-[#8a847d]">
              Sent to{' '}
              <span className="font-semibold text-[#131312]">
                {phone.trim()}
              </span>
            </p>

            <div className="mt-4">
              <input
                ref={codeInputRef}
                id={codeId}
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                aria-invalid={error !== null}
                aria-describedby={error ? errorId : undefined}
                placeholder="••••••"
                className="w-full rounded-xl border border-[#ececea] bg-[#fafaf8] px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-[#131312] transition focus:border-[#1f6f5c] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
              />
            </div>
          </div>

          {error && (
            <div
              id={errorId}
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-[#f5c6cb] bg-[#fdf0ef] p-3.5 text-sm text-[#a32a22]"
            >
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || code.trim().length !== 6}
            className="w-full rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Verifying code…' : 'Verify & Continue'}
          </button>

          <div className="flex items-center justify-between pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
              className="font-semibold text-[#4f4b46] hover:text-[#131312] hover:underline"
            >
              ← Change phone number
            </button>
            <button
              type="button"
              onClick={() => void handleResendCode()}
              disabled={busy}
              className="font-semibold text-[#1f6f5c] hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </form>
      )}
      <div ref={recaptchaContainerRef} aria-hidden="true" />
    </div>
  );
}
