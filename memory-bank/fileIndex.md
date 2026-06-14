# File Index

> One line per source file: path → purpose → key exports / responsibilities. Update whenever a file is added, moved, or significantly changed.

## Root config
- `package.json` — frontend dependencies (pinned exact), npm scripts (`dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `format:check`).
- `tsconfig.json` — TS strict suite for `src/`. Includes `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`.
- `tsconfig.node.json` — standalone editor-awareness config for `vite.config.ts` (not referenced from root tsconfig).
- `vite.config.ts` — React + Tailwind v4 plugins. No app logic.
- `eslint.config.js` — flat config; type-aware lint for `src/**`, plain lint for root configs; ignores `dist/`, `functions/lib/`, `.firebase/`.
- `.prettierrc.json` — single quotes, trailing comma all, 80 cols.
- `.prettierignore` — node_modules, dist, build, .firebase, functions/lib, package-lock.json.
- `.gitignore` — node_modules, dist, .env*, Firebase debug logs, editor/OS junk.
- `.env.example` — Firebase Web SDK env var NAMES (no values).
- `index.html` — Vite entry HTML. Mounts `#root` and `src/main.tsx`.
- `firebase.json` — Hosting (dist/), Firestore, Storage, Functions, Emulators (auth 9099 / firestore 8080 / functions 5001 / storage 9199 / hosting 5000 / UI 4000).
- `firestore.rules` — DENY-BY-DEFAULT. No collection grants until later milestones.
- `storage.rules` — DENY-BY-DEFAULT. ID images and photos to be owner-scoped later.
- `firestore.indexes.json` — empty `indexes` + `fieldOverrides`.
- `.firebaserc` — `default` project alias = `REPLACE_WITH_FIREBASE_PROJECT_ID` (set during Console step).

## Frontend src/
- `src/main.tsx` — React root mount. Wraps app in `<AuthProvider>` + `<RouterProvider>`. Throws if `#root` missing.
- `src/index.css` — single `@import "tailwindcss";` directive (Tailwind v4 model).
- `src/vite-env.d.ts` — typed `ImportMetaEnv` for the `VITE_FIREBASE_*` vars + `VITE_USE_EMULATORS`.
- `src/router.tsx` — `createBrowserRouter` route table. Public: `/`, `/login`, `/signup`. Protected: `/onboarding/consent`, `/onboarding/role` (allowIncomplete), `/app`.
- `src/lib/firebase.ts` — `getFirebaseApp()` + lazy `auth()`, `db()`, `storage()`, `functions()` accessors. Connects to emulators when `VITE_USE_EMULATORS=1`. Functions region: `asia-south1`.
- `src/lib/auth-context.tsx` — `<AuthProvider>` + `useAuthState()`. Discriminated union: `loading | signed-out | no-doc | incomplete | ready`. Subscribes to `users/{uid}` via `onSnapshot`.
- `src/lib/protected-route.tsx` — `<ProtectedRoute requires="consent" | "role" | "ready">`. Per-step guard; redirects users at any other step.
- `src/lib/use-redirect-when-signed-in.ts` — `useRedirectWhenSignedIn()` hook. Used by `/login` and `/signup` to forward authenticated users to the correct next step, after `AuthProvider` state has settled (avoids the auth-then-navigate race — see errors.md 2026-06-07).
- `src/lib/auth-errors.ts` — `readableAuthError(err)` maps Firebase error codes to short user-facing strings.
- `src/components/AuthMethodTabs.tsx` — accessible Phone / Email tab switcher (role=tablist).
- `src/components/PhoneAuthForm.tsx` — phone → OTP form. Uses `RecaptchaVerifier` invisible mode; auto-bypassed by Auth emulator in dev.
- `src/components/EmailAuthForm.tsx` — email + password (+ confirm on signup) form.
- `src/components/TaskLocationPicker.tsx` — Leaflet + OSM map with a draggable marker. Geolocation on mount (5 s timeout) → fallback to Mumbai. Computes H3 cell at resolution 9 (h3-js) and surfaces lat/lng/h3Cell to the parent.
- `src/components/OnboardingProgress.tsx` — numbered stepper used on `/signup`, `/onboarding/role`, `/onboarding/profile`, and `/onboarding/skills`. Default render is 3 steps (Account · Role · Profile); pass `includeSkills` to render the 4-step (volunteer) variant ending in "Skills". Consent gate is unnumbered.
- `src/components/MyTasksList.tsx` — live customer-side list of own tasks via `onSnapshot(customerId == uid, orderBy createdAt desc)`. Rows show status badge, risk colour, and link to task detail.
- `src/components/OfferInbox.tsx` — volunteer-side inbox shown on `/app`. Collection-group query on `offers` where `volunteerId == uid AND state == 'offered'`. Each row renders denormalised task info and `Accept` / `Reject` buttons calling the corresponding Cloud Functions.
- `src/components/ReportBlockPanel.tsx` — Report/Block reason submission form overlays. Accepts `viewerRole`; the Block button only renders for `customer` viewers. Shows a neutral "already reported" message when the `reportUser` callable rejects with `functions/already-exists`.
- `src/components/BlockedUsersList.tsx` — Customer-side read-only list of users they have blocked. Subscribes to `blocks` where current uid is `userA` or `userB`, filters to those with `blockedBy == uid`, renders name + photo from denormalised snapshots on the block doc. Shown on `/app` under the customer block.
- `src/components/KarmaBadge.tsx` — Lotus SVG symbol alongside point reward number with custom Tailwind CSS-only hover tooltip.
- `src/components/KarmaToast.tsx` — Screen-bottom overlay notification showing earned points on task completion with auto-fade and reduced motion respect.
- `src/components/CustomerDashboard.tsx` — Customer-facing redesign ported from Claude Design handoff bundle (2026-06-14). Two-screen layout (Tasks / Profile) with a floating bottom-nav pill. Tasks screen: greeting, read-only Leaflet/OSM map card pinned to `userDoc.lastKnownLocation` (no volunteer pins — privacy), post-task CTA, and an Ongoing tasks list filtered to `searching | accepted | in_progress`. Profile screen: gradient hero (Tasks posted + Completion %), Customer details (phone + email only; address + emergency contact deferred per scope Q&A), and Past tasks segmented tabs (All / Completed / Accepted / Rejected / Blocked) backed by the same task subscription + the customer's `blocks` count. Rendered from `AppHomePage` whenever `roles` includes `customer` (dual-role too). Volunteer-only and admin paths unchanged.
- `src/lib/catalog.ts` — typed re-export of `scripts/seed/catalog.json`. Exposes `CATEGORIES`, `SKILLS`, `getCategory()`, `getSkillLabel()`, and `deriveRisk(categoryKey)`.
- `src/pages/CreateTaskPage.tsx` — customer creates a task. Structured chips for category + skills, numeric duration, four short textareas, map pin. Risk auto-derived from category. `addDoc` to `tasks/{auto-id}` with status='searching' and 24h expiry; navigates to `/tasks/{id}` on success.
- `src/pages/TaskDetailPage.tsx` — customer view of a task + ranked volunteers list via `httpsCallable('rankNearbyVolunteers')`. Shows task summary, skill chips, and per-candidate score breakdown chips (Dist / Skill / Trust / Past, plus a Reports penalty chip when present).
- `src/pages/AdminDashboard.tsx` — Admin-only dashboard with global stats and four tabs (Pending Reports default → User Lookup → Task Audit Trail → Activity Log). Strict no-raw-UID policy throughout: reporter/reported/admin/actor identities all resolved to display names or role labels (Customer / Volunteer / System / Admin). Reports are collapsible cards (collapsed: reporter role · reported name · reason · timestamp; expanded: details + task link + unique reporter count + inline Warn/Suspend/Ban/Dismiss buttons that open the moderation modal pre-set to that action). 10-character minimum reason validation with inline error in both report and lookup moderation forms; success/error banners auto-dismiss after 3 s. Task audit entries are collapsible with role-labelled actor. Activity Log tab paginates `activityLog` (50 per page) with an event-type filter dropdown and "Load more".
- `src/lib/geolocation.ts` — `getCurrentLocation()` Promise wrapper over `navigator.geolocation.getCurrentPosition`, plus a `GeolocationError` class with a `userMessage` mapped from the W3C error codes.
- `src/pages/HomePage.tsx` — public landing.
- `src/pages/LoginPage.tsx` — sign-in page composing Phone + Email forms; uses `useRedirectWhenSignedIn()`.
- `src/pages/SignupPage.tsx` — sign-up page composing Phone + Email forms; uses `useRedirectWhenSignedIn()`.
- `src/pages/onboarding/ConsentPage.tsx` — T&C capture; on accept writes `users/{uid}` with `consent` + base fields (`setDoc`).
- `src/pages/onboarding/RolePage.tsx` — role picker; on continue updates `users/{uid}.roles` (`updateDoc`).
- `src/pages/onboarding/ProfilePage.tsx` — Step 3. Name + photo (required), optional bio (everyone), optional ID image. Uploads to Storage at `users/{uid}/photo` and `users/{uid}/id-image`, then updates user doc with displayName, photoURL, bio, idImagePath. Volunteers continue to step 4 (skills); customer-only users go straight to /app.
- `src/pages/onboarding/SkillsPage.tsx` — Step 4 (volunteers only). "What can you offer?" card grid sourced from `SKILLS` in `src/lib/catalog.ts`. Each card uses `SkillIcon`. Selecting up to 10 then Continue writes `users/{uid}.skills`; ProtectedRoute flips status to 'ready' and lands the user on /app.
- `src/components/SkillIcon.tsx` — Per-skill 64x64 SVG icon switch. One case per skill key in `scripts/seed/catalog.json` plus a generic fallback. Simple line + accent style, not the bespoke illustrated stickperson art from the Figma reference.
- `src/pages/AppHomePage.tsx` — authenticated home. Admins short-circuit to a minimal `AdminHomeScreen` (welcome heading, primary "Go to Admin Dashboard" button, neutral alert showing pending-report count if > 0, sign out). Volunteers/customers get the regular dashboard with availability toggle, karma, blocked-users list, etc. Sign-out button on both.

## Scripts / seed
- `scripts/seed/catalog.json` — starter seed for `catalog/categories` and `catalog/skills`. Reviewed pre-launch; loaded into Firestore by an admin-only callable in M1. Replaced by the M8 admin UI for live edits.
- `scripts/seed-admin.js` — root redirect wrapper that executes the Admin SDK seed script to create the local administrator.
- `scripts/seed-users.js` — root redirect wrapper that executes the Admin SDK seed script to create test volunteer + customer accounts.
- `functions/scripts/seed-admin.js` — Admin SDK seed: 2 admins (admin@example.org, admin2@example.org / `admin123`) with `isAdmin: true` + full volunteer-shape fields. Idempotent — re-syncs password + displayName on existing accounts.
- `functions/scripts/seed-users.js` — Admin SDK seed: 3 volunteer-only + 3 customer-only + 3 dual-role test users (all Kalewadi-centred, `pass123`). Same idempotent password resync as seed-admin.

## Cloud Functions
- `functions/package.json` — `firebase-functions@7.2.5`, `firebase-admin@13.10.0`, Node 22 runtime.
- `functions/tsconfig.json` — TS strict; `module: node16`, `moduleResolution: node16`, `rootDir: src`, `outDir: lib`.
- `functions/src/index.ts` — re-exports every concrete Cloud Function from its own file so the emulator + deploy pipeline can find them.
- `functions/src/scoring.ts` — shared matching/scoring code: `TaskDoc`, `UserDoc`, `isEligible`, `score`, `haversineM`, `rankForTask`. Both `rankNearbyVolunteers` (callable preview) and `dispatchOffers` (trigger) call into this.
- `functions/src/rank-nearby-volunteers.ts` — HTTPS callable (region asia-south1) wrapping `rankForTask`. Customer-only preview.
- `functions/src/dispatch-offers.ts` — Firestore onCreate trigger on `tasks/{taskId}`. Scores eligible volunteers and writes per-volunteer offer documents at `tasks/{taskId}/offers/{volunteerId}` with denormalised `taskTitle` / `taskCategory` / `taskRiskLevel` / `customerId` so the volunteer inbox renders without a parent-task fetch. Idempotent (skips if subcollection already has docs). Top batch capped at 10.
- `functions/src/accept-offer.ts` — HTTPS callable. Race-safe Firestore transaction flips `tasks/{id}.status` from 'searching' to 'accepted' and the corresponding offer to 'accepted'. Outside the transaction, marks sibling 'offered' offers as 'superseded'.
- `functions/src/reject-offer.ts` — HTTPS callable. Marks one offer 'rejected'.
- `functions/src/award-points-on-completion.ts` — Triggers on task completion to award points to volunteer and customer, log audit event, and run trust score recomputation.
- `functions/src/recompute-trust-score.ts` — Recalculates user trust score based on completed rated tasks, ID verification status, and report penalties. Clamped to `[30, 100]`.
- `functions/src/report-user.ts` — Reporting HTTPS callable. Enforces: reporter must be the customer or accepted volunteer of the task; task must be `accepted` / `in_progress` / `completed` (and if completed, within 24h of `completedAt`); volunteers can't report while status is `accepted` (Start OTP must be verified first); same reporter cannot file twice against the same target on the same task (`already-exists`). Computes `uniqueReporterCount` for the (reportedUid, taskId) pair inside a transaction and updates sibling docs so the count stays consistent.
- `functions/src/block-user.ts` — Mutual block creation HTTPS callable. Writes `blockedBy` (initiator uid) plus `userANameSnapshot` / `userAPhotoSnapshot` / `userBNameSnapshot` / `userBPhotoSnapshot` on the block doc so client-side "Blocked users" lists can render without a privileged read on the other party.
- `functions/src/apply-moderation-action.ts` — Admin-only action (warn/suspend/ban/unban) HTTPS callable. Sets `bannedAt` on ban and clears it on dismiss; on dismiss-from-banned, `recursiveDelete`s every in-flight task the user posted as customer (`searching` / `accepted` / `in_progress`) so nothing is left dangling. Completed/cancelled tasks and their audit events are preserved. Appends a `moderation_action` entry to `activityLog`.
- `functions/src/activity-log.ts` — Shared helper for the top-level `activityLog/{id}` site-wide audit feed surfaced in the admin dashboard. Exports `appendActivityLog(db, entry)` (event type, denormalised description string, userId, optional taskId) and `safeDisplayName(db, uid, fallback)` for looking up display names without crashing the parent function on a missing user doc. Descriptions are always built without raw UIDs — name substitution happens at write time.
- `functions/src/log-user-registered.ts` — Firestore `onDocumentCreated('users/{uid}')` trigger. Appends a `user_registered` activity-log entry the first time a user doc lands (typically right after T&C consent). Falls back to "A new user" when displayName hasn't been set yet.
- `functions/src/scheduled-purge-banned-users.ts` — Daily cron (`every 24 hours`, region `asia-south1`). For any `users/{uid}` with `accountStatus == 'banned'` and `bannedAt` older than 30 days: deletes the Firebase Auth account, removes Storage `/users/{uid}/photo` + `/users/{uid}/id-image`, and `recursiveDelete`s the user doc + subcollections (moderationLog, deviceTokens, notifications). Tasks, reports, blocks, adminActions are deliberately preserved — dangling UID refs are tolerated by UI fallbacks.
- `functions/src/on-volunteer-available.ts` — Firestore `onDocumentUpdated` trigger on `users/{uid}`. Fires when `availableNow` flips `false → true`. For every `searching` task the volunteer is eligible for (per `isEligible` in scoring.ts) and doesn't already have an offer doc on, writes one. Caps at 50 tasks per flip. Mutual-block aware. Plugs the "volunteer came online after the initial dispatch already ran" gap.
- `functions/src/periodic-redispatch-offers.ts` — Scheduled function (`every 1 minutes`, region `asia-south1`) implementing the `expandRadius` slot from systemPatterns.md. For each `searching` task older than 30s whose `lastRedispatchAt` is ≥ 60s ago: bumps `searchRadiusM` by 1000 m (cap 10 000 m), re-runs `rankForTask`, writes offer docs for up to 10 newly-eligible volunteers per cycle, and appends a `radius_expanded` audit event. Stamps `lastRedispatchAt` on the task doc to throttle re-runs.
- `functions/src/moderation-helper.ts` — Shared helpers for enforcing suspension/ban checks across all callable functions.

## Documentation
- `CHECKPOINT.md` — thin pointer to `memory-bank/`.
- `CLAUDE.md` — agent rules summary + pointer to `memory-bank/`.
- `memory-bank/projectbrief.md` — scope source of truth (12 features + out-of-scope).
- `memory-bank/techContext.md` — stack, versions, env vars, commands.
- `memory-bank/systemPatterns.md` — architecture, Firestore model (pending approval), security rules summary, Cloud Function inventory, PII inventory, matching formula, UI patterns.
- `memory-bank/decisions.md` — append-only decision log.
- `memory-bank/errors.md` — append-only error/issue log.
- `memory-bank/progress.md` — current milestone, done/in-progress/blocked, mocks.
- `memory-bank/fileIndex.md` — this file.
