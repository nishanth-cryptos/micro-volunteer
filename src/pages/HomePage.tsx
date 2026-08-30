// Public landing page — shown to signed-out visitors.
// Governs: Phase 1 Product Refinement — Safety-first, hyperlocal micro-volunteering.

import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

export default function HomePage() {
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
        <section className="vc-screen-enter mx-auto max-w-5xl px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d2e3dc] bg-[#e3efe9]/60 px-3.5 py-1 text-xs font-semibold text-[#1f6f5c]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#1f6f5c]"
                aria-hidden="true"
              />
              Verified Hyperlocal Community Help
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#131312] sm:text-6xl">
              The safest way to help or get help from your neighbours.
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-[#4f4b46] sm:text-xl">
              Ask nearby neighbours for everyday micro-tasks — or volunteer your
              time and skills. Built with strict safety controls, verbal OTP
              handshakes, and verified identity.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                to="/signup"
                className="w-full rounded-full bg-[#1f6f5c] px-8 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 sm:w-auto"
              >
                Join your neighbourhood
              </Link>
              <a
                href="#how-it-works"
                className="w-full rounded-full border border-[#ececea] bg-white px-7 py-3.5 text-base font-semibold text-[#4f4b46] transition hover:border-[#d8d4cc] hover:bg-[#f3f1ec] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 sm:w-auto"
              >
                See how it works
              </a>
            </div>

            {/* Honest Trust Badges */}
            <div className="mt-12 grid grid-cols-1 gap-4 border-t border-[#ececea] pt-8 text-left sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e3efe9] text-[#1f6f5c]">
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#131312]">
                    Two-Step Verbal OTP
                  </h2>
                  <p className="text-xs text-[#8a847d]">
                    Tasks start and complete only with in-person code
                    verification.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e3efe9] text-[#1f6f5c]">
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#131312]">
                    Automated Risk Classification
                  </h2>
                  <p className="text-xs text-[#8a847d]">
                    Tasks are evaluated for safety; higher-risk tasks require ID
                    verification.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e3efe9] text-[#1f6f5c]">
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#131312]">
                    Hyperlocal Proximity Matching
                  </h2>
                  <p className="text-xs text-[#8a847d]">
                    Direct matching with active neighbours within walking or
                    short commute distance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="border-t border-[#ececea] bg-white py-20 sm:py-24"
        >
          <div className="mx-auto max-w-5xl px-6">
            <div className="max-w-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1f6f5c]">
                Clear, Simple Process
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#131312] sm:text-4xl">
                How Hey Padosi works
              </h2>
              <p className="mt-3 text-base text-[#4f4b46]">
                Designed for everyday neighbours — straightforward, transparent,
                and verified from start to finish.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Step 1 */}
              <div className="flex flex-col rounded-2xl border border-[#ececea] bg-[#fafaf8] p-7 transition hover:border-[#d8d4cc] hover:shadow-sm">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1f6f5c] text-sm font-bold text-white">
                  1
                </span>
                <h3 className="mt-6 text-xl font-bold text-[#131312]">
                  Post what you need
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4f4b46]">
                  Describe the task in a few words — whether it&apos;s watering
                  plants while away, helping move a heavy package, or setting up
                  home Wi-Fi. Choose a location and category.
                </p>
                <div className="mt-6 rounded-xl border border-[#ececea] bg-white p-3 text-xs text-[#8a847d]">
                  <strong className="text-[#131312]">Automatic check:</strong>{' '}
                  Low-risk tasks match immediately; higher-risk tasks are
                  flagged for ID-verified volunteers.
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col rounded-2xl border border-[#ececea] bg-[#fafaf8] p-7 transition hover:border-[#d8d4cc] hover:shadow-sm">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1f6f5c] text-sm font-bold text-white">
                  2
                </span>
                <h3 className="mt-6 text-xl font-bold text-[#131312]">
                  Matched nearby
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4f4b46]">
                  Active volunteers within your immediate neighbourhood receive
                  an offer based on proximity, matched skills, and availability.
                  Review their profile and trust score.
                </p>
                <div className="mt-6 rounded-xl border border-[#ececea] bg-white p-3 text-xs text-[#8a847d]">
                  <strong className="text-[#131312]">
                    Direct coordination:
                  </strong>{' '}
                  Built-in secure chat enables coordination with quick report
                  and block protections.
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col rounded-2xl border border-[#ececea] bg-[#fafaf8] p-7 transition hover:border-[#d8d4cc] hover:shadow-sm">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1f6f5c] text-sm font-bold text-white">
                  3
                </span>
                <h3 className="mt-6 text-xl font-bold text-[#131312]">
                  Complete with OTP
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4f4b46]">
                  When meeting in person, exchange verbal 4-digit passcodes to
                  start and finish the task. This ensures mutual agreement and
                  verified completion.
                </p>
                <div className="mt-6 rounded-xl border border-[#ececea] bg-white p-3 text-xs text-[#8a847d]">
                  <strong className="text-[#131312]">Community trust:</strong>{' '}
                  Verified completions award skill points and build permanent
                  trust ratings.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Safety & Trust Section */}
        <section id="safety" className="py-20 sm:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1f6f5c]">
                Safety-First Architecture
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#131312] sm:text-4xl">
                Real safety mechanisms, not marketing claims.
              </h2>
              <p className="mt-3 text-base text-[#4f4b46]">
                Community help requires real accountability. Here is how Hey
                Padosi protects both requesters and volunteers at every step.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Pillar 1 */}
              <div className="rounded-2xl border border-[#ececea] bg-white p-6 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3efe9] text-[#1f6f5c]">
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-bold text-[#131312]">
                  Real Identity &amp; Profile
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4f4b46]">
                  Every user provides a clear profile photo and name. Volunteers
                  can submit college, workplace, or residential IDs for
                  verification.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="rounded-2xl border border-[#ececea] bg-white p-6 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3efe9] text-[#1f6f5c]">
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
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-bold text-[#131312]">
                  Risk-Tiered Tasks
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4f4b46]">
                  Tasks are categorized into Low and Medium risk. Higher-risk
                  tasks require ID verification so sensitive assistance is
                  handled responsibly.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="rounded-2xl border border-[#ececea] bg-white p-6 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3efe9] text-[#1f6f5c]">
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
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-bold text-[#131312]">
                  In-Person Passcode Handshake
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4f4b46]">
                  A 4-digit code generated on the customer&apos;s phone must be
                  entered by the volunteer at arrival and upon completion,
                  preventing false confirmations.
                </p>
              </div>

              {/* Pillar 4 */}
              <div className="rounded-2xl border border-[#ececea] bg-white p-6 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3efe9] text-[#1f6f5c]">
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
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-bold text-[#131312]">
                  Quantified Trust Score
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4f4b46]">
                  Server-computed trust scores reflect verified task count,
                  requester ratings, punctuality, and community standing without
                  arbitrary metrics.
                </p>
              </div>

              {/* Pillar 5 */}
              <div className="rounded-2xl border border-[#ececea] bg-white p-6 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3efe9] text-[#1f6f5c]">
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
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-bold text-[#131312]">
                  Instant Report &amp; Block
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4f4b46]">
                  Users can block individuals or submit structured reports
                  directly from active tasks or chat. Blocked users can never
                  see or match with you again.
                </p>
              </div>

              {/* Pillar 6 */}
              <div className="rounded-2xl border border-[#ececea] bg-white p-6 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3efe9] text-[#1f6f5c]">
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
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-bold text-[#131312]">
                  Enforced Community Discipline
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4f4b46]">
                  Safety guidelines are enforced with warnings, temporary
                  suspensions, and permanent account bans with clear written
                  reasons.
                </p>
              </div>
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
