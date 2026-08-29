// Email + password Auth form.
// Sign-up captures password confirmation; sign-in provides password visibility toggle.
// Handles accessible error states, loading feedback, and honest password recovery notes.

import { useId, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { readableAuthError } from '../lib/auth-errors';

interface Props {
  mode: 'signup' | 'login';
}

export function EmailAuthForm({ mode }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForgotNote, setShowForgotNote] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const errorId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowForgotNote(false);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match. Please re-enter your password.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth(), cleanEmail, password);
      } else {
        await signInWithEmailAndPassword(auth(), cleanEmail, password);
      }
      // Navigation is handled by the page via useRedirectWhenSignedIn(),
      // which reacts to AuthProvider state changes instead of racing them.
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="space-y-5"
    >
      <div>
        <label
          htmlFor={emailId}
          className="block text-sm font-semibold text-[#131312]"
        >
          Email address
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          placeholder="name@example.com"
          className="mt-2 w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-base text-[#131312] placeholder-[#8a847d] shadow-sm transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor={passwordId}
            className="block text-sm font-semibold text-[#131312]"
          >
            Password
          </label>
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => setShowForgotNote((prev) => !prev)}
              className="text-xs font-semibold text-[#1f6f5c] hover:underline"
            >
              Forgot password?
            </button>
          )}
        </div>

        <div className="relative mt-2">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={mode === 'signup' ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
            className="w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 pr-12 text-base text-[#131312] shadow-sm transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8a847d] hover:text-[#131312] focus:outline-none"
          >
            {showPassword ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {showForgotNote && (
        <div className="rounded-xl border border-[#ececea] bg-[#f3f1ec] p-3 text-xs leading-relaxed text-[#4f4b46]">
          <strong className="text-[#131312]">Account Recovery:</strong> Automated email password reset is queued for the upcoming Phase 2 release. If you are locked out, you can sign in directly using your registered <strong className="text-[#1f6f5c]">Phone OTP</strong>.
        </div>
      )}

      {mode === 'signup' && (
        <div>
          <label
            htmlFor={confirmId}
            className="block text-sm font-semibold text-[#131312]"
          >
            Confirm password
          </label>
          <div className="relative mt-2">
            <input
              id={confirmId}
              name="confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
              placeholder="Re-enter password"
              className="w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 pr-12 text-base text-[#131312] shadow-sm transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? 'Hide confirmed password' : 'Show confirmed password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8a847d] hover:text-[#131312] focus:outline-none"
            >
              {showConfirm ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

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
        disabled={busy}
        className="w-full rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? mode === 'signup'
            ? 'Creating account…'
            : 'Signing in…'
          : mode === 'signup'
            ? 'Create free account'
            : 'Sign in'}
      </button>
    </form>
  );
}
