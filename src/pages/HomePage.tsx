// Public landing page — shown to signed-out visitors.
// Governs: memory-bank/projectbrief.md (Apple-style restraint, content-first).

import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Volunteer Connector
        </h1>
        <p className="mt-4 max-w-xl text-lg text-neutral-600">
          Help a neighbour with a small task. Or post one when you need a hand.
          Hyperlocal, verified, safe.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/signup"
            className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Get started
          </Link>
          <Link
            to="/login"
            className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </main>
  );
}
