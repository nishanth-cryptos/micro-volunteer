// Sign-in page — Phone OTP or Email/Password.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthMethodTabs, type AuthMethod } from '../components/AuthMethodTabs';
import { PhoneAuthForm } from '../components/PhoneAuthForm';
import { EmailAuthForm } from '../components/EmailAuthForm';
import { useRedirectWhenSignedIn } from '../lib/use-redirect-when-signed-in';

export default function LoginPage() {
  useRedirectWhenSignedIn();
  const [method, setMethod] = useState<AuthMethod>('phone');
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md px-6 py-16 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-3 text-neutral-600">
          Welcome back. Continue with phone or email.
        </p>
        <div className="mt-10">
          <AuthMethodTabs
            method={method}
            onMethodChange={setMethod}
            phonePanel={<PhoneAuthForm mode="login" />}
            emailPanel={<EmailAuthForm mode="login" />}
          />
        </div>
        <p className="mt-10 text-sm text-neutral-600">
          New here?{' '}
          <Link
            to="/signup"
            className="font-medium text-neutral-900 underline underline-offset-4 hover:no-underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
