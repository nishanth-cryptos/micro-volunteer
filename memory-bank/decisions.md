# Decisions Log (append-only)

> Each entry: date · decision · why · alternatives rejected.

## 2026-06-07 — Map: Leaflet + OpenStreetMap (not Google Maps)
- **Why:** No billing-enabled Google Maps key available. Kickoff Section 0 specifies Leaflet + OSM as the official fallback.
- **Rejected:** Google Maps JS API (billing required); Mapbox (also paid, would need ops review).
- **Plan:** wrap map calls behind a thin provider interface so swapping to Google Maps later is local.

## 2026-06-07 — Language: TypeScript strict everywhere (frontend + Cloud Functions)
- **Why:** Kickoff Section 0 default; the anti-hallucination rules demand verifiable signatures; TS catches a class of issues that bite this domain (server-authoritative invariants, OTP flow correctness).
- **Rejected:** JS Functions for faster iteration — incremental Functions debugging is rare relative to invariant safety.
- **Note:** strict suite includes `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` to catch silent bugs early.

## 2026-06-07 — Firebase project setup mode: step-by-step together
- **Why:** Nishanth opted to walk through Firebase Console enablement (Auth providers, Firestore, Storage, Functions, FCM, Hosting) together rather than assume an existing project.
- **Effect:** Scaffold uses placeholder env var names only; `.firebaserc` has `REPLACE_WITH_FIREBASE_PROJECT_ID`. Nothing connects until the console step is done.

## 2026-06-07 — Tailwind v4 with @tailwindcss/vite (no PostCSS config)
- **Why:** Tailwind v4 ships a first-class Vite plugin and a CSS-based config model. The legacy `tailwind.config.js` + PostCSS + autoprefixer setup is no longer needed.
- **Effect:** `src/index.css` is just `@import "tailwindcss";`. No `tailwind.config.js` or `postcss.config.js` checked in.
- **Watch:** if a v4-incompatible plugin appears later we may need to revisit.

## 2026-06-07 — ESLint pinned to 9.39.4 (NOT 10)
- **Why:** `eslint-plugin-react` 7.37.5 and `eslint-plugin-jsx-a11y` 6.10.2 declare peer `eslint <= 9`. ESLint 10 is too new for the plugin ecosystem in early 2026.
- **Rejected:** `--legacy-peer-deps` flag (hides real incompatibility); dropping jsx-a11y (governance treats accessibility as non-negotiable).
- **Re-evaluate:** when both plugins ship ESLint 10 peer support — bump together, log here.
- See `errors.md` for the install failure that triggered this.

## 2026-06-07 — TS project-reference pattern dropped for tsconfig.node.json
- **Why:** Composite projects cannot use `noEmit`. The reference added complexity for no benefit since `vite.config.ts` is processed by Vite itself.
- **Effect:** `tsconfig.json` includes only `src/`; `tsconfig.node.json` exists for editor awareness of `vite.config.ts` (standalone, non-referenced).

## 2026-06-07 — Firebase region: asia-south1 (Mumbai)
- **Why:** Phase 1 user base is India. asia-south1 minimizes Firestore + Storage latency. Firestore region is **permanent** for the project — cannot be changed without recreating.
- **Rejected:** asia-south2 (Delhi, no strong reason to prefer over Mumbai); us-central1 (default, but high India latency).
- **Effect:** Functions deployed in M1+ should set `region: 'asia-south1'` to colocate with Firestore.

## 2026-06-07 — Cloud Storage skipped in Console (now Blaze-only); use Storage emulator
- **What happened:** Step 5 Console flow showed "To use Storage, upgrade your project's pricing plan". Google moved Cloud Storage for Firebase to Blaze-only in a 2024+ policy change.
- **Decision:** do **not** upgrade to Blaze for Phase 1 dev. The Firebase Storage **emulator** runs locally, accepts identical SDK calls, persists to disk under `.firebase/`. Profile photos + ID images work normally in dev.
- **Implication:** Production deploy of any Storage-touching feature is blocked until Blaze upgrade. Add to pre-launch checklist.
- **Code impact:** none — `storage.rules` and `firebase.json` storage block stay as-is; emulator reads them.
- **Errors.md:** also logged there since this was a real Console blocker.

## 2026-06-07 — Spark plan + emulators for all of M1–M7 development
- **Why:** Nishanth not ready to attach billing to the Firebase project. Cloud Functions cannot be deployed on the free Spark plan.
- **Effect:** All Phase 1 dev runs against the Firebase emulator suite (`firebase emulators:start`). Frontend connects to emulators when `VITE_USE_EMULATORS=1` is set in `.env.local`. No production Functions deploy until Blaze upgrade.
- **Implications:**
  - Phone Auth uses the Auth emulator (test numbers, no real SMS, no cost).
  - FCM real device push deferred to a later "Blaze on / production smoke test" task.
  - Hosting can still be used on Spark (the SPA can be deployed).
- **Re-evaluate:** before any prod-facing demo, Nishanth upgrades to Blaze, we set budget alerts at $1/$5/$10, and we run a deploy smoke test of Functions.

## 2026-06-07 — Firestore data model approved (all 6 open questions resolved)
- **H3 indexing resolution = 9** (~174 m hex edge, ring-2 ≈ 0.6 km, ring-10 ≈ 3 km). Good fit for 2–5 km matching. Rejected res 8 (too coarse for first-batch precision) and res 10 (more rings to cover 5 km, costlier).
- **Task auto-expiry = 24 h** after `createdAt`. Rejected 12 h (too tight for overnight) and 48 h (stale-task pollution). Implemented via `expireStaleTasks` scheduler every 15 min.
- **Start/End OTP storage = hash + salt + TTL** on the task doc. Plaintext returned once to customer via HTTPS callable; never persisted in plaintext; never returned to volunteer's client; cleared after verification. Rejected in-memory-only (horizontal scaling breakage) and KMS-encrypted plaintext (overkill for 4–6 digit codes). TTL ~10 min.
- **Skill match mode = OR with partial-credit.** Volunteer eligible if at least one skill intersects required; `skillMatch = matched / required`. Rejected AND (kills Phase 1 reach in a small pool) and a separate hybrid eligibility/boost split (added code with marginal benefit since OR + partial-credit already approximates it).
- **Catalog seeding = static seed in M0/M1 + admin UI in M8.** Seed at `scripts/seed/catalog.json`; deploy-time callable writes to `catalog/*`. Rejected "static only" (catalog must be admin-editable post-launch) and "admin UI from day one" (delays milestone order).
- **Customer rating = 1–5 stars + optional comment**, captured at end of `verifyEndOtp` flow. Aggregates into volunteer `trustScore` via Cloud Function. Comment not surfaced publicly in Phase 1. Rejected pure completions+reports model (loses a strong trust signal) and thumbs up/down (less nuance for trust math).

## 2026-06-07 — Functions tsconfig: module=node16, moduleResolution=node16
- **Why:** TS 6 deprecates the implicit `node` / `node10` setting. Functions package.json has no `"type": "module"`, so `node16` resolution emits CommonJS for Cloud Functions Node 22 runtime.
- **Rejected:** `nodenext` (more churn over time); `commonjs` resolution (deprecated path).

## 2026-06-08 — Trust score DB scaling, suspension check, and exactOptionalPropertyTypes
- **Decisions:**
  1. **Trust Score database representation**: Stored as an integer from `30` to `100` (`Math.round(clampedScore * 100)`), corresponding to underlying [0.3, 1.0] float logic. New users default to a floor of `30`.
  2. **Suspension/Moderation Active Checks**: Account active status is enforced globally via `checkActiveStatus` helper across all user-facing callable functions, preventing suspended/banned actions.
  3. **TypeScript `exactOptionalPropertyTypes` compatibility**: Forms and callable parameters build dynamically, omitting optional fields rather than passing them as `undefined`, complying with the strict project TS rules.


## 2026-06-08 — Block doc denormalisation for "Blocked users" UI
- **Decision:** `blocks/{id}` documents now carry `blockedBy` (initiator uid) plus `displayName`/`photoURL` snapshots for each side (`userANameSnapshot` / `userAPhotoSnapshot` / `userBNameSnapshot` / `userBPhotoSnapshot`). Written server-side in the `blockUser` callable at block-creation time.
- **Why:** Customers asked to see *which* volunteers they had blocked. The deny-by-default `users/{uid}` rule blocks the customer from reading the blocked party's profile directly, so we had to either loosen the user-doc rule (rejected — leaks PII far beyond this use case) or denormalise the displayable fields onto the block doc itself. Snapshot fields stay in sync with existing patterns (`customerName` on tasks, `taskTitle` on offer docs).
- **Effect:** Legacy block docs (none in prod yet) without `blockedBy` are silently skipped by the UI — we can't attribute initiator after the fact. If real blocks predate this change, a one-off backfill would be needed.

## 2026-06-08 — Ban revoke + 30-day permanent-purge policy
- **Decision:** On admin revoke of a banned user, delete only that user's in-flight customer-posted tasks (`searching`/`accepted`/`in_progress`). After 30 days of continuous ban, a daily scheduled function permanently deletes the Firebase Auth account, Storage profile/ID files, and Firestore `users/{uid}` doc + subcollections — but **not** their tasks, reports, blocks, or audit events.
- **Why:** Nishanth chose this scope explicitly when asked (2026-06-08). Preserves the "immutable audit trail" invariant in systemPatterns.md while still removing the user-identifiable PII (auth, photo, ID image, profile doc) after the cool-down window. Dangling UID refs on past tasks/reports/blocks are tolerated by UI fallbacks.
- **Rejected:** (a) Hard-deleting tasks + events along with the user — breaks audit and harms innocent counterparties on shared tasks. (b) Pure soft-delete flag — doesn't satisfy "delete from db and everywhere".
- **Effect:** Adds `bannedAt: Timestamp` on `users/{uid}` (set on ban, cleared on dismiss). Adds new scheduled function `scheduledPurgeBannedUsers` (daily, region asia-south1). `recursiveDelete` from firebase-admin walks the user's subcollections (moderationLog, deviceTokens, notifications) and any in-flight task's offers + events.


## 2026-06-14 — Customer dashboard redesign from Claude Design handoff bundle
- **Decision:** Ported the design from `claude.ai/design` handoff (`Volunteer Dashboard.html`, chat 2026-06-14) into a new `CustomerDashboard` component rendered from `AppHomePage` for any user whose `roles` include `customer` (pure customer and dual-role). Volunteer-only and admin paths unchanged. Design preserves the green-accent palette, gradient hero, floating bottom-nav pill, and two-screen Tasks/Profile layout from the source HTML.
- **Scope choices locked with Nishanth before coding** (anti-hallucination rule 3):
  1. **Audience:** customer-only redesign — applies whenever `roles` includes `customer` (dual-role users also see this view; a switch-to-volunteer affordance is TBD).
  2. **Map fidelity:** real Leaflet/OSM map showing only the customer's `lastKnownLocation` pin. The design's R/M/K/P nearby-volunteer markers were not implemented — exposing volunteer locations to customers is a privacy concern not covered by current rules/spec.
  3. **Profile fields:** Phone + Email only. `homeAddress` and `emergencyContact` from the design were dropped — they're not in the user schema today and adding them would have been an out-of-scope data-model change with PII implications.
  4. **Stats:** Tasks posted (real count) + Completion % (derived from `completed / total` of this customer's tasks). The design's "Avg rating" was dropped — there's no customer-rating server-side. "On-time" was dropped — no source data.
- **Past-tasks tabs mapping:** All / Completed (`status == completed`) / Accepted (currently `accepted | in_progress`) / Rejected (`cancelled | expired` with no `acceptedVolunteerId`) / Blocked (count of `blocks` where `blockedBy == uid`).
- **Rejected:** (a) Rebuilding the volunteer view to the same shell — out of scope per Q&A; (b) faking the nearby-volunteer pins with anonymised dots — would need a server-side callable for jittered counts, non-trivial; (c) adding `homeAddress` + `emergencyContact` to the schema in this change — scope discipline (CLAUDE.md rule 7).
- **Verified:** typecheck + lint + vite build all clean. Runtime not yet verified in the browser.


## 2026-06-14 — M7 in-app chat architecture
- **Decision:** Chat messaging is **client-direct** (participants write `chats/{chatId}/messages` straight from the SDK, guarded by Firestore rules), while **chat lifecycle is server-authoritative**: the chat doc is created by `acceptOffer` (`functions/src/chat.ts:ensureChatForTask`) and all system messages (connect / started / completed) are written by Cloud Functions via the Admin SDK. `chatId === taskId`; participants are exactly `[customerId, acceptedVolunteerId]`.
- **Why:** Chat is coordination, not a trust/points/OTP concern, so per-message Cloud Function invocations (cost on Spark, latency) aren't warranted — the security-rules sketch in systemPatterns.md already specified "participant-only read/write; messages immutable after create." Server-side creation guarantees a single authoritative creator with correct participants and lets lifecycle system messages be trustworthy (`system: true` is rejected on client writes). The client still ensure-creates the chat if missing so legacy/seeded accepted tasks (created before M7) get a chat on first open.
- **Messages immutable for clients:** `allow update, delete: if false`. The `reportedBy` marker and system messages are written by the Admin SDK (which bypasses rules), preserving immutability for clients.
- **Block-aware:** no new messages once either party blocks the other. Rules `canPostMessage` probes both orderings of the deterministic block-id (`blocks/{min}_{max}`) since rules can't sort UIDs; the client mirrors this with a live subscription to the computed block doc and disables the composer.
- **Reassignment privacy:** if a task is reassigned to a new volunteer (e.g. mid-task ban), `ensureChatForTask` `recursiveDelete`s the prior conversation before re-keying the chat, so the new volunteer never inherits the previous pair's messages. Trade-off: chatId stays == taskId (per the approved data model) rather than embedding the volunteer id.
- **"Report message":** implemented by extending `reportUser` with an optional `messageRef` (validated to be `chats/{taskId}/messages/{id}`) rather than a new callable — reuses all existing report validation (shared-task, window, duplicate, uniqueReporterCount). The report doc carries `messageRef` and the message gets `reportedBy` arrayUnion'd. Report/block also remain available at the user level in the chat header (inline `ReportBlockPanel`) so a no-show with no messages can still be reported.
- **Rules document-access budget:** `canPostMessage` binds the chat doc with a single `let` get (plus 2 block `exists`) instead of calling a `chatParticipants` getter repeatedly, keeping the message-create evaluation comfortably under the per-request access ceiling alongside `isSuspendedOrBanned`.
- **Verified:** functions build clean; frontend typecheck + lint + vite build clean; `firestore.rules` compiles (`firebase emulators:exec --only firestore` exit 0). Runtime browser smoke test still pending.
