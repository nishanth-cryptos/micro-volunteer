// Email + password Auth form. Sign-up captures a confirm field;
// sign-in skips it. After success, navigates to /onboarding/consent (signup)
// or /app (login; ProtectedRoute handles the rest).

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const errorId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth(), email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth(), email.trim(), password);
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
      className="space-y-6"
    >
      <div>
        <label
          htmlFor={emailId}
          className="block text-sm font-medium text-[#131312]"
        >
          Email
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
          className="mt-2 w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-base text-[#131312] placeholder-[#8a847d] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
        />
      </div>
      <div>
        <label
          htmlFor={passwordId}
          className="block text-sm font-medium text-[#131312]"
        >
          Password
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={mode === 'signup' ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="mt-2 w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-base text-[#131312] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
        />
        {mode === 'signup' && (
          <p className="mt-2 text-xs text-[#8a847d]">
            At least 8 characters.
          </p>
        )}
      </div>
      {mode === 'signup' && (
        <div>
          <label
            htmlFor={confirmId}
            className="block text-sm font-medium text-[#131312]"
          >
            Confirm password
          </label>
          <input
            id={confirmId}
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className="mt-2 w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-base text-[#131312] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
          />
        </div>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-[#a32a22]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {busy
          ? mode === 'signup'
            ? 'Creating account…'
            : 'Signing in…'
          : mode === 'signup'
            ? 'Create account'
            : 'Sign in'}
      </button>
    </form>
  );
}
