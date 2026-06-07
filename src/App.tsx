// Root application component — M0 placeholder.
// Governs: memory-bank/projectbrief.md (Phase 1 MVP scope).
// Responsibilities: render a minimal landing shell so M0 scaffold has a verifiable
// runtime smoke test. Will be replaced by router + role-aware shells in M1.

export default function App() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-4xl font-semibold tracking-tight">
          Volunteer Connector
        </h1>
        <p className="mt-4 text-lg text-neutral-600">
          M0 foundation. Real features land starting M1.
        </p>
      </div>
    </main>
  );
}
