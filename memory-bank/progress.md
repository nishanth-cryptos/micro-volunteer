# Progress

## Current milestone
**M1 — Auth & roles** (finishing). M0 ✅ DONE 2026-06-07; M1.1–M1.5 ✅; M1.6 smoke test in flight.

## Done
- Repo initialized (git, main branch, .gitignore)
- Vite 8 + React 19 + TS 6 strict scaffold
- Tailwind v4 wired via `@tailwindcss/vite` plugin
- ESLint 9 flat config + Prettier configured (`lint`, `format`, `typecheck`, `build`, `dev` scripts)
- Firebase client SDK installed; lazy initializer at `src/lib/firebase.ts`
- `.env.example` with NAMES ONLY (no values)
- `firebase.json` (hosting, firestore, storage, functions, emulators ports)
- `firestore.rules` — deny-by-default
- `storage.rules` — deny-by-default
- `firestore.indexes.json` — empty
- `.firebaserc` with placeholder project id
- `functions/` scaffold (TS strict, Node 22 runtime, builds clean)
- Memory bank (`memory-bank/` 7 files) + root `CLAUDE.md` + thin `CHECKPOINT.md`
- Verified: `tsc --noEmit` clean, `eslint .` clean, `vite build` clean (5.47 kB CSS = Tailwind working), `functions` build clean.

## In progress
- Nothing in active development. Awaiting Firebase Console step-through, then M1 kickoff.

## Firebase project (created 2026-06-07)
- **Name:** micro - volunteer
- **Project ID:** `micro---volunteer` (triple hyphen, in `.firebaserc`)
- **Project number:** 715988734310
- **Owner account:** nishanth.s2024a@vitstudent.ac.in
- **GCP parent org:** vit.ac.in (university — may impose IAM restrictions on billing/public access later)
- **Plan:** Spark (free); Blaze upgrade deferred per Spark+emulators decision
- **Region:** asia-south1 (set when Firestore is created in Step 4)
- **CLI:** firebase-tools 15.19.1, logged in 2026-06-07

## Console step progress
- **Step 1 (Create project):** done 2026-06-07.
- **Step 2 (Register web app):** done 2026-06-07. App ID `1:715988734310:web:27ed15be86946eb581b8a7`. `.env.local` populated (gitignored). Hosting site auto-linked (`micro---volunteer.web.app`), no charges. Analytics auto-attached with measurementId `G-5RK4E8HGBE` — unused in code.
- **`firebase use micro---volunteer`:** confirmed.
- **Step 3 (Enable Phone + Email/Password Auth):** done 2026-06-07. Both providers Enabled. Spark SMS quota 10/day noted (irrelevant — emulator only in dev).
- **Step 4 (Create Firestore in asia-south1):** done 2026-06-07. Standard edition, `(default)` DB ID, asia-south1, production-mode (deny-all) rules.
- **Step 5 (Enable Storage in Console):** SKIPPED — now Blaze-only. Using Storage emulator instead. See decisions.md + errors.md 2026-06-07 entries. Production Storage gated on Blaze upgrade pre-launch.
- **Step 6 (Init emulators locally):** done 2026-06-07. All emulators running (Auth 9099, Firestore 8080, Functions 5001, Hosting 5002, Storage 9199, Extensions 5001, UI 4000). JDK 21 installed and on PATH. AirPlay-port conflict resolved (hosting moved 5000→5002). Node version soft warning logged (dev 26 vs prod 22).

## Pre-launch / Blaze upgrade checklist
- [ ] Upgrade to Blaze plan with budget alerts at $1 / $5 / $10
- [ ] Enable Cloud Storage in Console (asia-south1, production-mode rules)
- [ ] Verify `firebase deploy --only storage` succeeds
- [ ] Verify `firebase deploy --only functions` succeeds
- [ ] Verify Phone Auth real SMS works (small test batch with real number)

## Known mocks / TODOs
- `App.tsx` is an M0 smoke-test landing page — will be replaced by the router shell in M1.
- `src/lib/firebase.ts` initializes app only; no Auth/Firestore/Storage helpers yet.
- `scripts/seed/catalog.json` is starter content — Nishanth to review categories/skills (especially region-specific languages) before M1 deploy.

## Decisions locked 2026-06-07 (see decisions.md)
- Data model approved (collections, doc shapes, indexes, denormalization, security-rules sketch).
- H3 resolution **9**.
- Task auto-expiry **24 h**, scheduler `expireStaleTasks` every 15 min.
- OTPs: hash + salt + TTL on task doc; plaintext returned once to customer only.
- Skill match: **OR** with partial-credit score.
- Catalog: **static seed now**, admin UI in M8.
- Customer rating: **1–5 stars + optional comment** post-completion.

## Next steps
1. Step through Firebase Console together (create project + enable services).
2. M1: Phone OTP + email auth, T&C consent, role selection, protected routes, catalog seed callable.
