// Public landing page — shown to signed-out visitors.
// Governs: memory-bank/projectbrief.md (Apple-style restraint, content-first).

import { Link } from 'react-router-dom';

export default function HomePage() {
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

      <div className="vc-screen-enter mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <h1 className="text-4xl font-bold tracking-tight text-[#131312] sm:text-5xl">
          Hey Padosi
        </h1>
        <p className="mt-4 max-w-xl text-lg text-[#4f4b46]">
          Help a neighbour with a small task. Or post one when you need a hand.
          Hyperlocal, verified, safe.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/signup"
            className="rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2"
          >
            Get started
          </Link>
          <Link
            to="/login"
            className="rounded-full border border-[#ececea] bg-white px-6 py-3.5 text-sm font-semibold text-[#4f4b46] transition hover:bg-[#f3f1ec] hover:border-[#d8d4cc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </main>
  );
}
