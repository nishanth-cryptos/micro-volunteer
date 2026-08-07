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
    <main className="min-h-screen bg-[#fafaf8] text-[#131312]">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#ececea] bg-white px-7">
        <div className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-[#131312]">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-gradient-to-br from-[#1f6f5c] to-[#185845] text-white">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </span>
          Hey Padosi
        </div>
      </header>

      <div className="vc-screen-enter mx-auto max-w-md px-6 py-12 sm:py-20">
        <h1 className="text-3xl font-bold tracking-tight text-[#131312]">Sign in</h1>
        <p className="mt-3 text-[#4f4b46]">
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
        <p className="mt-10 text-sm text-[#4f4b46]">
          New here?{' '}
          <Link
            to="/signup"
            className="font-semibold text-[#1f6f5c] hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
