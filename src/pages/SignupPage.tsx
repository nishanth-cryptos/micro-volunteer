// Sign-up page — chooser between Phone OTP and Email/Password.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthMethodTabs, type AuthMethod } from '../components/AuthMethodTabs';
import { PhoneAuthForm } from '../components/PhoneAuthForm';
import { EmailAuthForm } from '../components/EmailAuthForm';
import { OnboardingProgress } from '../components/OnboardingProgress';
import { Logo } from '../components/Logo';
import { useRedirectWhenSignedIn } from '../lib/use-redirect-when-signed-in';

export default function SignupPage() {
  useRedirectWhenSignedIn();
  const [method, setMethod] = useState<AuthMethod>('phone');

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#131312]">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#ececea] bg-[#fafaf8]/90 px-6 backdrop-blur-md sm:px-10">
        <Link
          to="/"
          className="flex items-center gap-2.5 font-bold tracking-tight text-[#131312]"
        >
          <Logo size="md" />
        </Link>
        <Link
          to="/login"
          className="text-sm font-semibold text-[#1f6f5c] hover:underline"
        >
          Already registered? Sign in →
        </Link>
      </header>

      <main className="vc-screen-enter mx-auto max-w-lg px-6 py-10 sm:py-14">
        <OnboardingProgress current={1} />

        <div className="rounded-3xl border border-[#ececea] bg-white p-7 shadow-sm sm:p-10">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[#131312] sm:text-3xl">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-[#4f4b46]">
              Join your local neighbourhood circle. Start with phone or email.
            </p>
          </div>

          <div className="mt-8">
            <AuthMethodTabs
              method={method}
              onMethodChange={setMethod}
              phonePanel={<PhoneAuthForm mode="signup" />}
              emailPanel={<EmailAuthForm mode="signup" />}
            />
          </div>

          <div className="mt-8 border-t border-[#ececea] pt-6 text-center text-sm text-[#4f4b46]">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-[#1f6f5c] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
