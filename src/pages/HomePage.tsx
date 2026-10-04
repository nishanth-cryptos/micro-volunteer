// Public landing page — shown to signed-out visitors.
// Governs: Phase 1 Product Refinement — Safety-first, hyperlocal micro-volunteering.

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'need-help' | 'want-help'>('need-help');
  const tabNeedHelpRef = useRef<HTMLButtonElement>(null);
  const tabWantHelpRef = useRef<HTMLButtonElement>(null);

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: 'need-help' | 'want-help',
  ) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (currentTab === 'need-help') {
        setActiveTab('want-help');
        tabWantHelpRef.current?.focus();
      } else {
        setActiveTab('need-help');
        tabNeedHelpRef.current?.focus();
      }
    }
  };

  const needHelpSteps = [
    {
      number: '1',
      heading: 'Tell us what you need.',
      body: 'Write a few words, like "water my plants this weekend," then choose a place and category.',
    },
    {
      number: '2',
      heading: 'A neighbour says "I can help."',
      body: 'Nearby volunteers see your request. Check their profile and trust score before you say yes.',
    },
    {
      number: '3',
      heading: 'Meet up and confirm with a code.',
      body: 'You and your helper share a 4-digit code in person, so you both know the help really happened.',
    },
  ];

  const wantHelpSteps = [
    {
      number: '1',
      heading: 'See who needs a hand nearby.',
      body: "Browse requests close to you that match what you're good at.",
    },
    {
      number: '2',
      heading: 'Offer to help.',
      body: 'Chat securely in the app to agree on details. You can report or block anyone, anytime.',
    },
    {
      number: '3',
      heading: 'Finish with a code and earn trust.',
      body: 'Share the 4-digit code in person. Every completed task adds to your trust rating.',
    },
  ];

  const currentSteps = activeTab === 'need-help' ? needHelpSteps : wantHelpSteps;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#131312]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#ececea] bg-[#fafaf8]/90 px-6 backdrop-blur-md sm:px-10">
        <Link
          to="/"
          className="flex items-center gap-2.5 font-bold tracking-tight text-[#131312]"
        >
          <Logo size="md" />
        </Link>

        <nav
          aria-label="Main Navigation"
          className="hidden items-center gap-8 text-sm font-medium text-[#4f4b46] md:flex"
        >
          <a href="#how-it-works" className="transition hover:text-[#131312]">
            How it works
          </a>
          <a href="#safety" className="transition hover:text-[#131312]">
            Safety &amp; Trust
          </a>
          <a href="#volunteers" className="transition hover:text-[#131312]">
            Volunteering
          </a>
          <a href="#community" className="transition hover:text-[#131312]">
            Dual-Role Model
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-[#4f4b46] transition hover:text-[#131312] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c]"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-full bg-[#1f6f5c] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2"
          >
            Get started
          </Link>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="vc-screen-enter mx-auto max-w-6xl px-6 py-24 sm:py-28 lg:py-32">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
            {/* Left Column: Text & Actions */}
            <div className="text-left lg:col-span-7">
              <p className="text-sm font-semibold text-[#1f6f5c]">
                Neighbourly help you can trust
              </p>

              <h1 className="mt-3 text-[36px] font-bold leading-[1.15] tracking-tight text-[#131312] sm:text-[46px] lg:text-[56px]">
                Hey Padosi, can you help?
              </h1>

              <p className="mt-5 max-w-[540px] text-[19px] leading-[1.6] text-[#4f4b46]">
                Ask a kind neighbour for everyday help, or offer your time and skills. Every helper has a profile, every meeting ends with a 4-digit code, and you can report or block anyone, anytime.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  to="/signup"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#1f6f5c] px-7 text-base font-semibold text-white shadow-sm transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2"
                >
                  Ask for help
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full border-[1.5px] border-[#1f6f5c] bg-white px-7 text-base font-semibold text-[#1f6f5c] transition hover:bg-[#e3efe9]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2"
                >
                  Offer to help
                </Link>
              </div>

              {/* Reassurance line with shield */}
              <div className="mt-4 flex items-center gap-2 text-sm text-[#4f4b46]">
                <svg
                  className="h-4 w-4 shrink-0 text-[#1f6f5c]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span>Free to join. Every helper has a profile.</span>
              </div>

              {/* Safety anchor link */}
              <div className="mt-2">
                <a
                  href="#safety"
                  className="inline-flex min-h-[48px] items-center text-sm font-medium text-[#1f6f5c] underline underline-offset-4 transition hover:text-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2"
                >
                  See how safety works
                </a>
              </div>
            </div>

            {/* Right Column: Visual Area with Overlapping Sample Request Card */}
            <div className="relative mx-auto w-full max-w-[420px] lg:col-span-5 lg:max-w-none">
              {/* Placeholder image area (rounded corners, 4:5 ratio) */}
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-[#ececea] bg-[#f0eee9]">
                {/* Swap src below for a real, warm photo of neighbours helping each other */}
                <img
                  src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500' fill='none'><rect width='400' height='500' fill='%23f0eee9'/><circle cx='200' cy='200' r='46' fill='%23e3efe9'/><circle cx='200' cy='190' r='16' fill='%231f6f5c'/><path d='M172 232c0-15 12.5-27 28-27s28 12 28 27' stroke='%231f6f5c' stroke-width='3' stroke-linecap='round'/><circle cx='236' cy='182' r='11' fill='%23d2e3dc'/><path d='M222 216c0-9 6-16 16-16s16 7 16 16' stroke='%231f6f5c' stroke-width='2.5' stroke-linecap='round'/><text x='200' y='290' text-anchor='middle' font-family='-apple-system,BlinkMacSystemFont,sans-serif' font-size='15' font-weight='600' fill='%23131312'>Neighbours helping neighbours</text><text x='200' y='314' text-anchor='middle' font-family='-apple-system,BlinkMacSystemFont,sans-serif' font-size='13' fill='%2366615b'>Swap with a warm 4:5 community photo</text></svg>"
                  alt="Neighbours in a residential community greeting each other and offering everyday help"
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Overlapping small phone-style card at bottom-left */}
              <div className="absolute -bottom-4 left-3 right-3 rounded-2xl border border-[#ececea] bg-white p-4 shadow-sm sm:-bottom-5 sm:-left-5 sm:right-auto sm:max-w-[310px]">
                <p className="text-sm font-semibold text-[#131312]">
                  Help carrying a parcel upstairs
                </p>
                <p className="mt-1 text-xs text-[#4f4b46]">
                  80m away · 2 neighbours nearby
                </p>
                <div className="mt-3 flex items-center gap-1.5 border-t border-[#ececea] pt-2.5 text-xs font-semibold text-[#1f6f5c]">
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-[#1f6f5c]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span>Helper verified</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Row Below Hero */}
          <div className="mt-16 grid grid-cols-1 gap-8 border-t border-[#ececea] pt-10 text-left md:grid-cols-3 md:gap-10 sm:mt-20 sm:pt-12">
            <div className="flex items-start gap-3.5">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-[#1f6f5c]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <div>
                <h3 className="text-[17px] font-bold text-[#131312]">
                  A code that proves you met
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#4f4b46]">
                  You and your helper share a 4-digit code in person, so you both know the help really happened.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-[#1f6f5c]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <div>
                <h3 className="text-[17px] font-bold text-[#131312]">
                  Extra checks for bigger tasks
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#4f4b46]">
                  Simple jobs are matched quickly. Bigger ones go to ID-verified helpers.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-[#1f6f5c]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
              <div>
                <h3 className="text-[17px] font-bold text-[#131312]">
                  Neighbours within walking distance
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#4f4b46]">
                  Requests go to active helpers nearby, so help is never far.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="border-t border-[#ececea] bg-white py-24 sm:py-32"
        >
          <div className="mx-auto max-w-5xl px-6">
            <div className="max-w-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1f6f5c]">
                CLEAR, SIMPLE PROCESS
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#131312] sm:text-4xl">
                How Hey Padosi works
              </h2>
              <p className="mt-3 text-lg text-[#4f4b46]">
                Getting help from a neighbour takes three simple steps.
              </p>
            </div>

            {/* Two-Tab Switcher */}
            <div
              role="tablist"
              aria-label="How Hey Padosi works by role"
              className="mt-10 flex flex-wrap gap-3 sm:flex-nowrap"
            >
              <button
                ref={tabNeedHelpRef}
                id="tab-need-help"
                type="button"
                role="tab"
                aria-selected={activeTab === 'need-help'}
                aria-controls="panel-need-help"
                tabIndex={activeTab === 'need-help' ? 0 : -1}
                onClick={() => setActiveTab('need-help')}
                onKeyDown={(e) => handleTabKeyDown(e, 'need-help')}
                className={`min-h-[48px] rounded-full px-6 py-3 text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 ${activeTab === 'need-help'
                  ? 'border border-[#1f6f5c] bg-[#1f6f5c] text-white shadow-sm'
                  : 'border border-[#d8d4cc] bg-[#fafaf8] text-[#4f4b46] hover:border-[#1f6f5c] hover:text-[#131312]'
                  }`}
              >
                I need help
              </button>

              <button
                ref={tabWantHelpRef}
                id="tab-want-help"
                type="button"
                role="tab"
                aria-selected={activeTab === 'want-help'}
                aria-controls="panel-want-help"
                tabIndex={activeTab === 'want-help' ? 0 : -1}
                onClick={() => setActiveTab('want-help')}
                onKeyDown={(e) => handleTabKeyDown(e, 'want-help')}
                className={`min-h-[48px] rounded-full px-6 py-3 text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 ${activeTab === 'want-help'
                  ? 'border border-[#1f6f5c] bg-[#1f6f5c] text-white shadow-sm'
                  : 'border border-[#d8d4cc] bg-[#fafaf8] text-[#4f4b46] hover:border-[#1f6f5c] hover:text-[#131312]'
                  }`}
              >
                I want to help
              </button>
            </div>

            {/* Tab Panel with soft fade transition */}
            <div
              role="tabpanel"
              id={activeTab === 'need-help' ? 'panel-need-help' : 'panel-want-help'}
              aria-labelledby={activeTab === 'need-help' ? 'tab-need-help' : 'tab-want-help'}
              key={activeTab}
              className="mt-12 sm:mt-16"
              style={{ animation: 'vc-fade-in 180ms ease-out both' }}
            >
              <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
                {/* Left column: Vertical timeline */}
                <div className="relative lg:col-span-7">
                  {/* Connecting thin line between step numbers */}
                  <div
                    className="absolute left-[19px] sm:left-[23px] top-6 bottom-10 w-px bg-[#d8d4cc]"
                    aria-hidden="true"
                  />

                  <div className="space-y-12 sm:space-y-14">
                    {currentSteps.map((step) => (
                      <div
                        key={step.number}
                        className="relative flex items-start gap-6 sm:gap-8"
                      >
                        <span
                          className="relative z-10 flex w-10 sm:w-12 shrink-0 justify-center bg-white py-1 font-bold text-3xl sm:text-4xl text-[#1f6f5c] select-none"
                          aria-hidden="true"
                        >
                          {step.number}
                        </span>
                        <div className="pt-1">
                          <h3 className="text-[24px] font-bold text-[#131312] leading-tight">
                            {step.heading}
                          </h3>
                          <p className="mt-2.5 text-[17px] text-[#4f4b46] leading-relaxed">
                            {step.body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right column: Phone-style mockup */}
                <div className="flex justify-center lg:col-span-5">
                  <div className="w-full max-w-[320px] rounded-[32px] border-2 border-[#131312] bg-[#fafaf8] p-4 shadow-sm">
                    {/* Screen notch indicator */}
                    <div
                      className="mx-auto mb-4 h-3.5 w-24 rounded-full bg-[#131312]/15"
                      aria-hidden="true"
                    />

                    {activeTab === 'need-help' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-[#ececea] pb-2.5">
                          <span className="text-[13px] font-bold text-[#131312]">
                            Your Request
                          </span>
                          <span className="rounded-full bg-[#e3efe9] px-2.5 py-0.5 text-[11px] font-semibold text-[#1f6f5c]">
                            Active
                          </span>
                        </div>

                        <div className="rounded-xl border border-[#ececea] bg-white p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1f6f5c]">
                            Step 1 • Need
                          </div>
                          <div className="mt-1 text-[13px] font-bold text-[#131312]">
                            Water my plants this weekend
                          </div>
                          <div className="mt-0.5 text-[12px] text-[#4f4b46]">
                            Indiranagar • Plants &amp; Garden
                          </div>
                        </div>

                        <div className="rounded-xl border border-[#1f6f5c]/30 bg-white p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1f6f5c]">
                              Step 2 • Helper
                            </span>
                            <span className="rounded bg-[#e3efe9] px-1.5 py-0.5 text-[11px] font-bold text-[#1f6f5c]">
                              96 Trust
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f6f5c] text-xs font-bold text-white">
                              P
                            </div>
                            <div>
                              <div className="text-[13px] font-bold text-[#131312]">
                                Priya S.
                              </div>
                              <div className="text-[11px] text-[#4f4b46]">
                                Neighbour • 0.3 km away
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-[12px] font-medium text-[#1f6f5c]">
                            Says &ldquo;I can help&rdquo;
                          </div>
                        </div>

                        <div className="rounded-xl border border-[#ececea] bg-white p-3 text-center">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1f6f5c]">
                            Step 3 • Verify
                          </div>
                          <div className="mt-1 text-[12px] text-[#4f4b46]">
                            Share 4-digit code in person
                          </div>
                          <div className="mt-2 flex justify-center gap-2 font-mono text-base font-bold text-[#131312]">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ececea] bg-[#fafaf8]">
                              4
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ececea] bg-[#fafaf8]">
                              8
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ececea] bg-[#fafaf8]">
                              2
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ececea] bg-[#fafaf8]">
                              0
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-[#ececea] pb-2.5">
                          <span className="text-[13px] font-bold text-[#131312]">
                            Nearby Requests
                          </span>
                          <span className="rounded-full bg-[#e3efe9] px-2.5 py-0.5 text-[11px] font-semibold text-[#1f6f5c]">
                            3 available
                          </span>
                        </div>

                        <div className="rounded-xl border border-[#ececea] bg-white p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1f6f5c]">
                              Step 1 • Browse
                            </span>
                            <span className="text-[11px] font-medium text-[#4f4b46]">
                              0.4 km away
                            </span>
                          </div>
                          <div className="mt-1 text-[13px] font-bold text-[#131312]">
                            Water my plants this weekend
                          </div>
                          <div className="mt-0.5 text-[12px] text-[#4f4b46]">
                            Matches your skills
                          </div>
                        </div>

                        <div className="rounded-xl border border-[#1f6f5c]/30 bg-white p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1f6f5c]">
                            Step 2 • Offer &amp; Chat
                          </div>
                          <div className="mt-1.5 rounded-lg bg-[#fafaf8] p-2 text-[12px] text-[#131312]">
                            &ldquo;I can stop by Saturday morning at 10 AM.&rdquo;
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#4f4b46]">
                            <span>Secure in-app chat</span>
                            <span className="font-semibold text-[#1f6f5c]">
                              Agreed
                            </span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[#ececea] bg-white p-3 text-center">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1f6f5c]">
                            Step 3 • Finish
                          </div>
                          <div className="mt-1 text-[12px] text-[#4f4b46]">
                            Enter 4-digit code from neighbour
                          </div>
                          <div className="mt-2 flex justify-center gap-2 font-mono text-base font-bold text-[#131312]">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ececea] bg-[#fafaf8]">
                              4
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ececea] bg-[#fafaf8]">
                              8
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ececea] bg-[#fafaf8]">
                              2
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ececea] bg-[#fafaf8]">
                              0
                            </span>
                          </div>
                          <div className="mt-2 text-[11px] font-semibold text-[#1f6f5c]">
                            Earns community trust
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Safety & Trust Section */}
        <section id="safety" className="py-24 sm:py-32">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[15px] font-bold uppercase tracking-wider text-[#1f6f5c]">
                SAFETY, BUILT IN
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#131312] sm:text-4xl">
                Safety you can see at every step.
              </h2>
              <p className="mt-3 text-[17px] leading-relaxed text-[#4f4b46]">
                Here&apos;s how Hey Padosi protects both the person asking and the person helping.
              </p>
            </div>

            <div className="mt-16 sm:mt-20 divide-y divide-[#ececea]">
              {/* Stage 1: Before you meet */}
              <div className="pb-12 sm:pb-16 grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-12 items-start">
                <div className="md:col-span-4 lg:col-span-5 md:sticky md:top-24">
                  <span className="text-[15px] font-semibold tracking-wide text-[#8a847d]">
                    01
                  </span>
                  <h3 className="mt-1 font-heading text-[28px] font-bold text-[#131312] leading-tight">
                    Before you meet
                  </h3>
                  <p className="mt-2 text-[17px] leading-relaxed text-[#4f4b46]">
                    Knowing who you are connecting with before anyone arrives.
                  </p>
                </div>

                <div className="md:col-span-8 lg:col-span-7 divide-y divide-[#ececea]">
                  {/* Item 1 */}
                  <div className="pb-8 first:pt-0">
                    <div className="flex items-start gap-4">
                      <svg
                        className="mt-1 h-6 w-6 shrink-0 text-[#1f6f5c]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <div>
                        <h4 className="text-[20px] font-bold text-[#131312] leading-snug">
                          Real people, real profiles
                        </h4>
                        <p className="mt-2 text-[17px] leading-relaxed text-[#4f4b46]">
                          Everyone has a photo and a name. Volunteers can also verify with a college, workplace or home address ID.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="pt-8">
                    <div className="flex items-start gap-4">
                      <svg
                        className="mt-1 h-6 w-6 shrink-0 text-[#1f6f5c]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      <div>
                        <h4 className="text-[20px] font-bold text-[#131312] leading-snug">
                          Bigger tasks get extra checks
                        </h4>
                        <p className="mt-2 text-[17px] leading-relaxed text-[#4f4b46]">
                          Simple jobs are matched quickly. Higher-risk jobs go only to ID-verified volunteers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 2: When you meet */}
              <div className="py-12 sm:py-16 grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-12 items-start">
                <div className="md:col-span-4 lg:col-span-5 md:sticky md:top-24">
                  <span className="text-[15px] font-semibold tracking-wide text-[#8a847d]">
                    02
                  </span>
                  <h3 className="mt-1 font-heading text-[28px] font-bold text-[#131312] leading-tight">
                    When you meet
                  </h3>
                  <p className="mt-2 text-[17px] leading-relaxed text-[#4f4b46]">
                    Verifying real-world help with simple in-person checks.
                  </p>
                </div>

                <div className="md:col-span-8 lg:col-span-7 divide-y divide-[#ececea]">
                  {/* Item 1: Featured code item with phone mockup */}
                  <div className="py-6">
                    <div className="flex items-start gap-4">
                      <svg
                        className="mt-0.5 h-6 w-6 shrink-0 text-[#1f6f5c]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      <div className="flex-1">
                        <div className="flex flex-col gap-8 md:flex-row md:items-center">
                          <div className="flex-1 min-w-0 md:min-w-[280px]">
                            <h4
                              className="text-[20px] font-bold text-[#131312] leading-snug [text-wrap:balance]"
                              style={{ textWrap: 'balance' }}
                            >
                              A code that proves you met
                            </h4>
                            <p className="mt-2 text-[17px] leading-[1.6] text-[#4f4b46]">
                              Your helper enters a 4-digit code from your phone when they arrive and again when the job is done. No one can claim help that never happened.
                            </p>
                          </div>

                          {/* Phone mockup */}
                          <div className="self-start md:self-auto shrink-0">
                            <span className="sr-only">
                              Example of a 4-digit code screen showing 4820, confirmed.
                            </span>
                            <div
                              className="w-[236px] rounded-[24px] border-2 border-[#131312] bg-[#fafaf8] p-3 shadow-xs"
                              aria-hidden="true"
                            >
                              <div className="mx-auto mb-2 h-2 w-12 rounded-full bg-[#131312]/15" />
                              <div className="rounded-xl border border-[#ececea] bg-white p-3 text-center">
                                <div className="text-[12px] font-semibold uppercase tracking-wider text-[#1f6f5c]">
                                  4-Digit Code
                                </div>
                                <div className="mt-1 text-[12px] text-[#4f4b46]">
                                  In-person check
                                </div>
                                <div className="mt-2.5 flex justify-center gap-2 font-mono text-[20px] font-bold text-[#131312]">
                                  <span className="flex h-[44px] w-[40px] items-center justify-center rounded-md border border-[#ececea] bg-[#fafaf8]">
                                    4
                                  </span>
                                  <span className="flex h-[44px] w-[40px] items-center justify-center rounded-md border border-[#ececea] bg-[#fafaf8]">
                                    8
                                  </span>
                                  <span className="flex h-[44px] w-[40px] items-center justify-center rounded-md border border-[#ececea] bg-[#fafaf8]">
                                    2
                                  </span>
                                  <span className="flex h-[44px] w-[40px] items-center justify-center rounded-md border border-[#ececea] bg-[#fafaf8]">
                                    0
                                  </span>
                                </div>
                                <div className="mt-2.5 text-[12px] font-medium text-[#1f6f5c]">
                                  ✓ Confirmed
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="py-6">
                    <div className="flex items-start gap-4">
                      <svg
                        className="mt-0.5 h-6 w-6 shrink-0 text-[#1f6f5c]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <div>
                        <h4
                          className="text-[20px] font-bold text-[#131312] leading-snug [text-wrap:balance]"
                          style={{ textWrap: 'balance' }}
                        >
                          Secure one-to-one chat inside the app
                        </h4>
                        <p className="mt-2 text-[17px] leading-[1.6] text-[#4f4b46]">
                          Agree on details privately inside the app. Your phone number stays hidden.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="py-6">
                    <div className="flex items-start gap-4">
                      <svg
                        className="mt-0.5 h-6 w-6 shrink-0 text-[#1f6f5c]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                      <div>
                        <h4
                          className="text-[20px] font-bold text-[#131312] leading-snug [text-wrap:balance]"
                          style={{ textWrap: 'balance' }}
                        >
                          A trust score you can check
                        </h4>
                        <p className="mt-2 text-[17px] leading-[1.6] text-[#4f4b46]">
                          Calculated automatically from finished tasks, ratings, punctuality and community standing.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 3: If something goes wrong */}
              <div className="pt-12 sm:pt-16 grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-12 items-start">
                <div className="md:col-span-4 lg:col-span-5 md:sticky md:top-24">
                  <span className="text-[15px] font-semibold tracking-wide text-[#8a847d]">
                    03
                  </span>
                  <h3 className="mt-1 font-heading text-[28px] font-bold text-[#131312] leading-tight">
                    If something goes wrong
                  </h3>
                  <p className="mt-2 text-[17px] leading-relaxed text-[#4f4b46]">
                    Clear boundaries and direct support whenever you need it.
                  </p>
                </div>

                <div className="md:col-span-8 lg:col-span-7 divide-y divide-[#ececea]">
                  {/* Item 5 */}
                  <div className="pb-8 first:pt-0">
                    <div className="flex items-start gap-4">
                      <svg
                        className="mt-1 h-6 w-6 shrink-0 text-[#1f6f5c]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                        />
                      </svg>
                      <div>
                        <h4 className="text-[20px] font-bold text-[#131312] leading-snug">
                          Report or block in one tap
                        </h4>
                        <p className="mt-2 text-[17px] leading-relaxed text-[#4f4b46]">
                          From any task or chat. Blocked people can never see you or be matched with you again.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Item 6 */}
                  <div className="pt-8">
                    <div className="flex items-start gap-4">
                      <svg
                        className="mt-1 h-6 w-6 shrink-0 text-[#1f6f5c]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      <div>
                        <h4 className="text-[20px] font-bold text-[#131312] leading-snug">
                          Clear rules, fairly enforced
                        </h4>
                        <p className="mt-2 text-[17px] leading-relaxed text-[#4f4b46]">
                          Breaking the rules leads to a warning, a suspension or a permanent ban, and you always get the reason in writing.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Calm closing line */}
            <div className="mt-16 sm:mt-20 border-t border-[#ececea] pt-12 sm:pt-16 text-center text-[17px] text-[#4f4b46]">
              Questions about safety?{' '}
              <a
                href="mailto:safety@heypadosi.org"
                className="font-medium text-[#1f6f5c] underline underline-offset-4 transition hover:text-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 rounded"
              >
                Contact us at safety@heypadosi.org
              </a>
            </div>
          </div>
        </section>

        {/* Volunteer Value Proposition */}
        <section
          id="volunteers"
          className="border-t border-[#ececea] bg-white py-20 sm:py-24"
        >
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1f6f5c]">
                  For Volunteers
                </span>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#131312] sm:text-4xl">
                  Lend a hand when you&apos;re free.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-[#4f4b46]">
                  You don&apos;t need to commit hours or travel across the city.
                  Hey Padosi alerts you only when a neighbour within your
                  walking radius needs assistance that matches your skills.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e3efe9] text-[#1f6f5c]">
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <strong className="text-sm font-semibold text-[#131312]">
                        100% Volunteer-driven:
                      </strong>
                      <span className="text-sm text-[#4f4b46]">
                        {' '}
                        Pure mutual aid, free of commercial fees or service
                        markups.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e3efe9] text-[#1f6f5c]">
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <strong className="text-sm font-semibold text-[#131312]">
                        You control your time:
                      </strong>
                      <span className="text-sm text-[#4f4b46]">
                        {' '}
                        Toggle &quot;Available Now&quot; on when you have 15
                        minutes, or off when you&apos;re busy.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e3efe9] text-[#1f6f5c]">
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <strong className="text-sm font-semibold text-[#131312]">
                        Earn verified recognition:
                      </strong>
                      <span className="text-sm text-[#4f4b46]">
                        {' '}
                        Accumulate verified volunteering hours, skill ratings,
                        and community trust.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-2 rounded-full bg-[#1f6f5c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#185845]"
                  >
                    Start volunteering nearby →
                  </Link>
                </div>
              </div>

              {/* Visual Card Example */}
              <div className="rounded-3xl border border-[#ececea] bg-[#fafaf8] p-8 shadow-sm">
                <div className="text-xs font-semibold text-[#8a847d]">
                  Everyday Tasks on Hey Padosi
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-[#ececea] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1f6f5c]">
                        Gardening &amp; Plants
                      </span>
                      <span className="rounded-full bg-[#fafaf8] px-2 py-0.5 text-xs text-[#8a847d]">
                        ~15 mins
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-[#131312]">
                      Water balcony plants while family is traveling
                    </p>
                    <p className="mt-1 text-xs text-[#8a847d]">
                      0.4 km away • Low Risk
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#ececea] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1f6f5c]">
                        Tech Support
                      </span>
                      <span className="rounded-full bg-[#fafaf8] px-2 py-0.5 text-xs text-[#8a847d]">
                        ~20 mins
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-[#131312]">
                      Help elderly neighbour set up video call on tablet
                    </p>
                    <p className="mt-1 text-xs text-[#8a847d]">
                      0.2 km away • Low Risk
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#ececea] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1f6f5c]">
                        Moving &amp; Lifting
                      </span>
                      <span className="rounded-full bg-[#fafaf8] px-2 py-0.5 text-xs text-[#8a847d]">
                        ~10 mins
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-[#131312]">
                      Help carry two grocery boxes to 2nd floor
                    </p>
                    <p className="mt-1 text-xs text-[#8a847d]">
                      0.1 km away • Low Risk
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dual-Role & Community Model */}
        <section id="community" className="py-20 sm:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="rounded-3xl border border-[#ececea] bg-gradient-to-br from-white to-[#f3f7f5] p-8 sm:p-14">
              <div className="mx-auto max-w-2xl text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1f6f5c]">
                  Community Reciprocity
                </span>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#131312] sm:text-4xl">
                  One account. Both roles.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-[#4f4b46]">
                  Real neighbourhoods aren&apos;t divided into
                  &quot;buyers&quot; and &quot;workers&quot;. On Hey Padosi, you
                  can be a requester when you need help, and a volunteer when
                  you have time to give.
                </p>

                <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 text-left">
                  <div className="rounded-2xl border border-[#ececea] bg-white p-6 shadow-sm">
                    <div className="text-base font-bold text-[#131312]">
                      When you need a hand
                    </div>
                    <p className="mt-2 text-sm text-[#4f4b46]">
                      Post a task in seconds. Clear instructions, safe
                      categories, and reliable neighbours ready to help.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#ececea] bg-white p-6 shadow-sm">
                    <div className="text-base font-bold text-[#131312]">
                      When you have a few minutes
                    </div>
                    <p className="mt-2 text-sm text-[#4f4b46]">
                      Turn on availability. Accept only what fits your routine
                      and build verified goodwill in your area.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="border-t border-[#ececea] bg-[#1f6f5c] text-white py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to make your neighbourhood safer and closer?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-[#d2e3dc]">
              Join Hey Padosi today. Safe, verified micro-volunteering right at
              your doorstep.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="w-full rounded-full bg-white px-8 py-3.5 text-base font-semibold text-[#1f6f5c] shadow-sm transition hover:bg-[#fafaf8] focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
              >
                Create your free account
              </Link>
              <Link
                to="/login"
                className="w-full rounded-full border border-white/30 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#ececea] bg-white py-12 text-sm text-[#4f4b46]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
          <div className="flex items-center gap-2.5 font-bold tracking-tight text-[#131312]">
            <Logo size="md" />
          </div>

          <div className="text-center text-xs text-[#8a847d] sm:text-right">
            Hyperlocal micro-volunteering platform. Built with safety-first
            controls.
            <div className="mt-1">
              © {new Date().getFullYear()} Hey Padosi. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
