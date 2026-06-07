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
- `src/components/OnboardingProgress.tsx` — three-step numbered stepper used on `/signup`, `/onboarding/role`, and `/onboarding/profile`. Consent gate is unnumbered.
- `src/components/MyTasksList.tsx` — live customer-side list of own tasks via `onSnapshot(customerId == uid, orderBy createdAt desc)`. Rows show status badge, risk colour, and link to task detail.
- `src/lib/catalog.ts` — typed re-export of `scripts/seed/catalog.json`. Exposes `CATEGORIES`, `SKILLS`, `getCategory()`, `getSkillLabel()`, and `deriveRisk(categoryKey)`.
- `src/pages/CreateTaskPage.tsx` — customer creates a task. Structured chips for category + skills, numeric duration, four short textareas, map pin. Risk auto-derived from category. `addDoc` to `tasks/{auto-id}` with status='searching' and 24h expiry; navigates to `/tasks/{id}` on success.
- `src/pages/TaskDetailPage.tsx` — customer view of a task + ranked volunteers list via `httpsCallable('rankNearbyVolunteers')`. Shows task summary, skill chips, and per-candidate score breakdown chips (Dist / Skill / Trust / Past, plus a Reports penalty chip when present).
- `src/lib/geolocation.ts` — `getCurrentLocation()` Promise wrapper over `navigator.geolocation.getCurrentPosition`, plus a `GeolocationError` class with a `userMessage` mapped from the W3C error codes.
- `src/pages/HomePage.tsx` — public landing.
- `src/pages/LoginPage.tsx` — sign-in page composing Phone + Email forms; uses `useRedirectWhenSignedIn()`.
- `src/pages/SignupPage.tsx` — sign-up page composing Phone + Email forms; uses `useRedirectWhenSignedIn()`.
- `src/pages/onboarding/ConsentPage.tsx` — T&C capture; on accept writes `users/{uid}` with `consent` + base fields (`setDoc`).
- `src/pages/onboarding/RolePage.tsx` — role picker; on continue updates `users/{uid}.roles` (`updateDoc`).
- `src/pages/onboarding/ProfilePage.tsx` — name + photo (required) + bio + optional ID image. Uploads to Storage at `users/{uid}/photo` and `users/{uid}/id-image`, then updates user doc with displayName, photoURL (Storage path), bio, idImagePath.
- `src/pages/AppHomePage.tsx` — authenticated home. Availability ON/OFF switch for volunteers (writes `availableNow` + `availabilityUpdatedAt`). Sign-out button. Real dashboards in M3/M5.

## Scripts / seed
- `scripts/seed/catalog.json` — starter seed for `catalog/categories` and `catalog/skills`. Reviewed pre-launch; loaded into Firestore by an admin-only callable in M1. Replaced by the M8 admin UI for live edits.

## Cloud Functions
- `functions/package.json` — `firebase-functions@7.2.5`, `firebase-admin@13.10.0`, Node 22 runtime.
- `functions/tsconfig.json` — TS strict; `module: node16`, `moduleResolution: node16`, `rootDir: src`, `outDir: lib`.
- `functions/src/index.ts` — re-exports every concrete Cloud Function from its own file so the emulator + deploy pipeline can find them.
- `functions/src/rank-nearby-volunteers.ts` — HTTPS callable (region asia-south1) that scores nearby available volunteers for a given task using the locked formula. Customer-only; reads task, filters eligible volunteers, scores, returns top 20.

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
