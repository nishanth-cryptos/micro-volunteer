// Sign-up page — chooser between Phone OTP and Email/Password.
// Governs: memory-bank/projectbrief.md (Auth & signup is M1 feature 1).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthMethodTabs, type AuthMethod } from '../components/AuthMethodTabs';
import { PhoneAuthForm } from '../components/PhoneAuthForm';
import { EmailAuthForm } from '../components/EmailAuthForm';
import { useRedirectWhenSignedIn } from '../lib/use-redirect-when-signed-in';

export default function SignupPage() {
  useRedirectWhenSignedIn();
  const [method, setMethod] = useState<AuthMethod>('phone');
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md px-6 py-16 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-3 text-neutral-600">
          Choose how you&apos;d like to sign up.
        </p>
        <div className="mt-10">
          <AuthMethodTabs
            method={method}
            onMethodChange={setMethod}
            phonePanel={<PhoneAuthForm mode="signup" />}
            emailPanel={<EmailAuthForm mode="signup" />}
          />
        </div>
        <p className="mt-10 text-sm text-neutral-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-neutral-900 underline underline-offset-4 hover:no-underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
