# Progress

## Current milestone
**Milestone 8 — Points, Trust, Safety & Admin Dashboard (Completed).** All requirements for M8 have been successfully coded, built, and verified. Note: Milestone 7 (Chat) is deferred.

M8 features implemented:
- **Backend (Cloud Functions):**
  - `awardPointsOnCompletion`: Triggers on task completion to award points (10 base + duration bonus) to volunteer and customer (2 points). Appends an audit trail event and updates verifiedTaskCount / verifiedHours.
  - `recomputeTrustScore`: Triggered on user review/rating submission or reports. Recalculates user trust score based on completed rated tasks, ID verification status, and report penalties. Clamped to `[30, 100]`.
  - `verifyEndOtp`: Refactored to delegate reputation updates to `awardPointsOnCompletion`.
  - `submitCustomerRating`: Triggers trust score recompute on review completion.
  - `reportUser` / `blockUser` / `applyModerationAction`: Server-authoritative moderators and callables.
- **Frontend (React UI):**
  - `/admin` Admin Dashboard: Stats panels, Pending Reports Queue (Warn / Suspend / Ban / Dismiss), User Lookup & Mod Logs, Task Audit Trail.
  - Modals & Forms: Report/Block overlays on Task Details.
  - Verification & Interceptor: Full-screen block for suspended/banned users with moderation details.
  - Volunteer Stats Panel: Renders Trust Score (with Newcomer/Reliable/Trusted badges), points, completions, and skill points mapping on `/app`.
  - Exclude suspended/banned volunteers from matching eligibility lists and search counts.
  - Mid-task suspension handling: Automatically reset tasks to searching state, clear assigned volunteer parameters, trigger matching re-runs, display reassignment notices to customers, and redirect volunteers back to the homepage with a warning toast.

## Done
- **M0 Foundation** — Vite 8 + React 19 + TS 6 strict, Tailwind v4, ESLint 9 flat + Prettier, Firebase client SDK + lazy initializer, deny-by-default firestore + storage rules, `functions/` scaffold (TS strict, Node 22). Memory bank + CLAUDE.md.
- **M1 Auth & roles** — Firebase Phone OTP + Email/Password, T&C consent capture, role selection, protected routes with onboarding step machine (`src/lib/protected-route.tsx`), `useRedirectWhenSignedIn` hook to dodge the auth-then-navigate race.
- **M2 Profile & availability** — display name + required photo + bio + optional ID image, prominent availability ON/OFF toggle for volunteers, geolocation + H3 res-9 cell write on toggle-ON.
- **M3 Task posting & risk** — map pin (Leaflet/OSM) + structured form (category, skills, duration, 4 short textareas), risk auto-derived from category, client `addDoc` with server-validated shape via firestore rules.
- **M4 Matching engine** — `rankNearbyVolunteers` callable + shared `scoring.ts` (distance/skill/trust/availability/past − reportPenalty), customer-side TaskDetail with ranked candidate list and score breakdown chips.
- **M5 Notifications & lifecycle** — `dispatchOffers` trigger writes per-volunteer offer docs on task create AND on transitions back to `searching` (reassignment), volunteer `OfferInbox` + `AcceptedTasksList`, `acceptOffer` / `rejectOffer` callables (race-safe transaction).
- **M6 OTP proof of work** — `generateStartOtp` / `verifyStartOtp` / `generateEndOtp` / `verifyEndOtp` callables (hash+salt+TTL, plaintext returned only to customer once), `submitCustomerRating`, append-only `tasks/{id}/events` audit trail via `writeAuditEvent`, `expireStaleTasks` scheduler.
- **M8 Points, trust, safety & admin** (M7 chat deferred):
  - `awardPointsOnCompletion` trigger awards volunteer points (10 base + 1/15min, cap 18) + customer points (2, only if customer also has volunteer role) + skill points + audit event on status flip to `completed`.
  - `recomputeTrustScore` with normalised formula (see systemPatterns.md). Fires from `awardPointsOnCompletion`, `submitCustomerRating`, and post-moderation.
  - `reportUser` / `blockUser` / `applyModerationAction` callables with `checkActiveStatus` helper enforced across all user-facing callables.
  - Admin Dashboard at `/admin` (`requiresAdmin` route guard): stats panels, pending-reports queue, user lookup with moderation log, task audit timeline.
  - `ReportBlockPanel` overlays on TaskDetail (canonical taxonomy: safety / no_show / inappropriate / fraud / other).
  - Global ban/suspend interceptor in `ProtectedRoute` — full-screen Banned/Suspended screens for affected users.
  - Mid-task suspension/ban: assigned task flips back to `searching`, OTP material cleared, audit event `reassigned` written, `dispatchOffers` re-fires; customers see a reassignment notice, volunteers are redirected to `/app` with a toast.
  - Block-aware matching: `scoring.rankForTask` filters out mutually-blocked users from both directions.
  - Seed scripts (Kalewadi-centred fixtures; both scripts re-sync passwords on existing accounts so credentials stay valid across runs):
    - `npm run seed:admin` → 2 admins (admin@example.org, admin2@example.org — both pass `admin123`, `isAdmin: true`, full volunteer-shape fields so they can also test the volunteer/customer flows).
    - `npm run seed:users` → 3 volunteer-only (vol@, vol1@, vol2@) + 3 customer-only (cus@, cus1@, cus2@) + 3 dual-role (both@, both1@, both2@) — all pass `pass123`.
- Verified at every step: frontend `typecheck` + `lint` + `vite build` clean; functions `build` clean.

## In progress
- Nothing in active development. M7 (in-app chat) is the next milestone.

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
- `scripts/seed/catalog.json` is starter content — Nishanth to review categories/skills (especially region-specific languages) before launch.
- FCM real device push deferred (Spark plan + emulator-only dev). No real notifications until Blaze upgrade.
- Storage uses the emulator only; production Storage gated on Blaze upgrade.

## Decisions locked 2026-06-07 (see decisions.md)
- Data model approved (collections, doc shapes, indexes, denormalization, security-rules sketch).
- H3 resolution **9**.
- Task auto-expiry **24 h**, scheduler `expireStaleTasks` every 15 min.
- OTPs: hash + salt + TTL on task doc; plaintext returned once to customer only.
- Skill match: **OR** with partial-credit score.
- Catalog: **static seed now**, admin UI in M8.
- Customer rating: **1–5 stars + optional comment** post-completion.

## Next steps
1. Live smoke test of M8 in the emulator suite (report → moderation → reassignment → completion).
2. M7: in-app chat (opens on acceptance, report message, block user).
3. Pre-launch: Blaze upgrade + real-device FCM smoke test + Storage Console enable.
