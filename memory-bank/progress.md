# Progress

## Current milestone
**Milestone 7 — In-app chat (Completed 2026-06-14).** Chat was deferred during the M8 push and has now been built and verified. All 12 Phase-1 features are now implemented (M0–M8). Coded, typechecked, linted, built; Firestore rules confirmed to compile in the emulator. **Not yet smoke-tested at runtime in a browser** (per CLAUDE.md anti-hallucination rule 5).

M7 features implemented:
- **Data model** (per systemPatterns.md): `chats/{chatId}` with `chatId === taskId`, `participants: [customerId, volunteerId]`, `lastMessageAt`/`lastMessagePreview`; `chats/{chatId}/messages/{id}` with `senderUid`, `text`, `system`, `sentAt`, optional `reportedBy`.
- **Backend (`functions/src/chat.ts`):** `ensureChatForTask` (idempotent create; wipes the prior conversation via `recursiveDelete` if the task was reassigned to a new volunteer) + `appendSystemMessage`. Wired into `acceptOffer` (open chat + "connected" message), `verifyStartOtp` ("Task started"), `verifyEndOtp` ("Task completed") — all best-effort, never unwinding the parent action. `reportUser` extended with optional `messageRef` (stored on the report + `arrayUnion`-marked onto the message's `reportedBy`).
- **Frontend:** `ChatPanel.tsx` (live messages, composer, system messages, per-message report, header report/block, block-aware + read-only states) wired into `TaskDetailPage` for accepted/in_progress (active) and completed (read-only history). `ReportBlockPanel` gained an `inline` variant for the chat header.
- **Rules:** participant-only chat + messages; messages immutable for clients (system + `reportedBy` are Admin-SDK-only); no new messages once either party blocks the other (`canPostMessage` probes both block-id orderings). **Index:** `chats (participants array-contains, lastMessageAt desc)`.

## Previous milestone
**Milestone 8 — Points, Trust, Safety & Admin Dashboard (Completed).** All requirements for M8 have been successfully coded, built, and verified.

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
    - `npm run seed:admin` → 2 admins (admin@example.org, admin2@example.org — both pass `admin123`, `isAdmin: true`, full volunteer-shape fields so they can also test the volunteer/customer flows). Located around test centre (13.0202, 77.6815).
    - `npm run seed:users` → 3 volunteer-only (vol@, vol1@, vol2@) + 3 customer-only (cus@, cus1@, cus2@) + 3 dual-role (both@, both1@, both2@) — all pass `pass123`. All clustered within ~350 m of test centre (13.0202, 77.6815) so they sit inside the default 2 km task search radius.
- **M7 In-app chat** (Completed 2026-06-14): see the Current milestone section above. One chat per accepted task (`chatId === taskId`), participant-only, immutable messages, system messages on accept/start/complete, per-message + user-level report, customer block, block-aware composer, read-only after completion. Server creates the chat on accept (`functions/src/chat.ts`); messages are client-direct writes guarded by rules.
- Verified at every step: frontend `typecheck` + `lint` + `vite build` clean; functions `build` clean; `firestore.rules` confirmed to compile via `firebase emulators:exec --only firestore`.

## In progress
- Nothing in active development. All Phase-1 milestones (M0–M8) are implemented. Remaining work is runtime smoke testing + pre-launch (Blaze) tasks below.

## Post-M8 follow-ups (continued)
- **Customer dashboard redesign (2026-06-14):** New `src/components/CustomerDashboard.tsx` ported from the Claude Design handoff bundle (`Volunteer Dashboard.html`, chat 2026-06-14). Two-screen layout (Tasks / Profile) with floating bottom-nav pill, green-accent gradient hero, Leaflet map showing the customer's `lastKnownLocation` only, ongoing-tasks list (`searching | accepted | in_progress`), and past-tasks segmented tabs (All / Completed / Accepted / Blocked). Wired into `AppHomePage` to render whenever `roles` includes `customer` (dual-role users get this view too; volunteer-only and admin paths unchanged). Scope choices (audience, map fidelity, profile fields, stats source) were confirmed with Nishanth before coding — see decisions.md 2026-06-14. Layout iterated to a desktop-grid (full-width map, Post-CTA + Ongoing tasks below in 2 cols); Rejected tab dropped per request. **Verified:** typecheck + lint + build clean. **Not verified at runtime.**

- **Customer-flow design pass 2 (2026-06-14):** Second handoff bundle (`KOXU9t0cI1y5-j5b1jQ_bg`) added: animation system in `src/index.css` (`vc-*` keyframes; respects `prefers-reduced-motion`); polish on `CustomerDashboard` (screen fade transitions, hover-lift task cards, animated Verified checkmark, scaled active nav); full visual re-theme of `CreateTaskPage` (sticky progress strip with shimmer, animated chips, time stepper, sticky bottom action bar — form fields + Firestore write logic untouched per scope Q&A); new `RadarSearching` component on `TaskDetailPage` for `status=='searching'` (pulsing rings + fade-in blips driven by real `offers` count, live `reached / km radius / mm:ss timer` — no rotating sweep, per design chat); re-themed `accepted/in_progress` hero (gradient card, animated checkmark, vol avatar + online dot, bouncing-dots chat hint); re-themed `CustomerOtpPanel` (flip-cell digit reveal, gradient action button). Underlying callables (`generateStartOtp`, `rankNearbyVolunteers`, `addDoc` to tasks) unchanged. **Verified:** typecheck + lint + build clean. **Not verified at runtime.**

## Post-M8 follow-ups
- **Blocked users visibility (2026-06-08):** `blockUser` callable now denormalises initiator (`blockedBy`) + `displayName`/`photoURL` snapshots for both sides onto `blocks/{id}`. New `BlockedUsersList` component on `/app` (customer block) renders the list of users this customer has blocked. Matching exclusion was already in place via `scoring.rankForTask` (mutual filter). Legacy block docs without `blockedBy` are skipped in the UI (can't attribute initiator).
- **Onboarding step 4 — Skills (2026-06-08):** Volunteer skill picker split out of step 3 (Profile) into its own step 4 at `/onboarding/skills`. Card-grid layout with per-skill SVG icons (new `SkillIcon` component, 25 cases matching `scripts/seed/catalog.json`). Stepper (`OnboardingProgress`) now renders 4 dots when `includeSkills` is set. `auth-context.classify` and `protected-route.currentStep` updated so a volunteer/dual-role user without skills stays `incomplete` and is routed to `/onboarding/skills`. Customer-only users skip step 4. Existing seeded users already have skills so they aren't bumped back into onboarding.
- **Admin dashboard restructure (2026-06-08):**
  - **Admin home** — `AppHomePage` short-circuits to a minimal `AdminHomeScreen` (welcome heading + "Go to Admin Dashboard" button + neutral alert when pending-report count > 0 → clicking it routes to /admin). All karma / stats / availability / blocked-users surfaces hidden from admins.
  - **AdminDashboard** — added 4th "Activity Log" tab; tab order is Pending Reports (default) → User Lookup → Task Audit Trail → Activity Log.
  - **Pending Reports** — collapsible cards (reporter role · reported name · reason · timestamp visible collapsed; details + task link + uniqueReporterCount + inline Warn/Suspend/Ban/Dismiss buttons revealed on expand). 4 inline action buttons open the moderation modal pre-set to that action. No raw UIDs anywhere.
  - **User Lookup** — admin display name resolved in moderation log entries (no raw `adminId` UID rendered). 10-character minimum on the reason textarea with inline "Please provide a meaningful reason" and disabled Apply button until met. Success/error banners auto-dismiss in 3 s.
  - **Task Audit Trail** — actor labelled by role (`Customer` / `Volunteer` / `Admin` / `System`) based on the task's customerId / acceptedVolunteerId; collapsible entries (collapsed: step number + transition name + timestamp; expanded: actor + JSON payload). Search placeholder simplified to "Enter Task ID".
  - **Activity Log (new)** — site-wide reverse-chronological feed of platform events. Event-type filter dropdown, 50 entries per page, "Load more" button, collapsible entries. Backed by new `activityLog` Firestore collection with admin-only read, server-only writes (Cloud Functions). Descriptions are denormalised at write time and never contain raw UIDs.
  - **Backend instrumentation** — new `functions/src/activity-log.ts` helper (`appendActivityLog`, `safeDisplayName`); new `log-user-registered.ts` Firestore onCreate trigger. `appendActivityLog` is called from `report-user`, `accept-offer`, `verify-start-otp`, `verify-end-otp`, `apply-moderation-action`, `block-user`, and `dispatch-offers` (on initial task creation only). Append is best-effort — a logging failure never unwinds the parent action.
  - **Rules + indexes** — firestore.rules `match /activityLog/{entryId}` with `allow read: if isAdmin(); allow write: if false;`. Composite index `(eventType ASC, createdAt DESC)` added to firestore.indexes.json.

- **Late-arrival matching coverage (2026-06-08):**
  - **A. `onVolunteerAvailable`** — Firestore onDocumentUpdated trigger on `users/{uid}`. When `availableNow` flips `false → true` (and the user is volunteer, not banned/suspended, has skills + lastKnownLocation), scans up to 50 `searching` tasks, runs `isEligible` per task, and writes a new offer doc for any task this volunteer doesn't already have an offer on. Mutual-block aware.
  - **B. `periodicRedispatchOffers`** — Scheduled function (`every 1 minutes`, region asia-south1). For each `searching` task older than 30s whose `lastRedispatchAt` is ≥ 60s ago: bumps `searchRadiusM` by 1000 m (cap 10 000 m), re-runs `rankForTask` with the expanded radius, writes up to 10 fresh offer docs for newly-eligible volunteers, and appends a `radius_expanded` audit event with `actorUid: 'system'`. `lastRedispatchAt` is stamped to throttle re-runs and acts as a do-not-revisit marker once the radius hits the ceiling.
  - **New field on `tasks/{taskId}`:** `lastRedispatchAt: Timestamp` (server-only, written by `periodicRedispatchOffers`). No firestore.rules change needed — `tasks` update is already server-only.
  - **Together** these close the original "snapshot the available pool at dispatch time and never revisit" hole that left late-online volunteers (or volunteers reactivated after a ban) without offers on still-searching tasks.

- **Ban lifecycle cleanup (2026-06-08):**
  - `bannedAt: Timestamp` set on the user doc when admin bans, cleared on dismiss. Anchors the 30-day purge clock.
  - **Revoke cleanup:** when admin dismisses a previously-banned user, every customer-side task they still have in flight (`searching` / `accepted` / `in_progress`) is `recursiveDelete`d (offers + events subcollections go with them). Completed / cancelled / expired tasks stay. Volunteer-side active tasks were already re-queued at ban time so they aren't re-touched here.
  - **30-day permanent purge:** new daily scheduled function `scheduledPurgeBannedUsers` (region asia-south1, schedule `every 24 hours`). For any user banned >30 days: deletes Firebase Auth account, removes Storage `/users/{uid}/photo` + `/users/{uid}/id-image`, and `recursiveDelete`s `users/{uid}` (incl. moderationLog, deviceTokens, notifications). Per-user failures are logged and skipped; next sweep retries.
  - **Preserved deliberately:** their tasks (incl. `/events` audit), reports filed by/against them, blocks, adminActions. The immutable-audit invariant from systemPatterns.md is intact. UI name resolvers already handle missing `users/{uid}` gracefully.

- **Reporting & blocking tightening (2026-06-08):**
  - Reporting window: only allowed while task is `accepted` / `in_progress`, or within 24h of `completedAt`. Enforced in both the UI (`TaskDetailPage`) and the `reportUser` Cloud Function.
  - Volunteer-side timing: volunteers can report the customer only once the Start OTP has been verified (status moved past `accepted`). Enforced server-side too.
  - Block button removed from volunteer-facing surface — `ReportBlockPanel` now takes `viewerRole` and renders Block only for `customer`. Block logic itself unchanged.
  - Duplicate reports: same reporter + same target + same task is rejected by `reportUser` with `failed-precondition` (HttpsError code `already-exists`); the modal swaps in a neutral grey message.
  - `uniqueReporterCount` is computed inside the report transaction and synced across all sibling reports for the same (reportedUid, taskId) pair. Surfaced as an amber chip in the admin pending-reports queue when > 1.

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
1. Live smoke test of M7 chat in the emulator suite: accept a task (chat opens with "connected" system message) → both parties exchange messages → verify Start OTP (start system message) → verify End OTP (complete system message) → completed chat goes read-only → per-message report marks the message + files a report → customer block disables the composer for both parties.
2. Live smoke test of M8 in the emulator suite (report → moderation → reassignment → completion); confirm reassignment wipes the old chat conversation.
3. Pre-launch: Blaze upgrade + real-device FCM smoke test + Storage Console enable.
