# Errors Log (append-only)

> Each entry: date · what broke · root cause · fix · how to avoid next time.

## 2026-06-07 — `npm install` ERESOLVE failure on ESLint 10

- **What broke:** Root `npm install` failed with ERESOLVE. `eslint-plugin-jsx-a11y@6.10.2` declares peer `eslint@"^3..^9"` — does not support ESLint 10.
- **Root cause:** ESLint 10 was released too recently in early 2026; major plugins haven't bumped peer dep ranges yet.
- **Also affected:** `eslint-plugin-react@7.37.5` caps at ESLint 9.
- **Fix:** downgraded `eslint` and added explicit `@eslint/js` at `9.39.4`. See decisions.md.
- **Avoid next time:** when pulling latest versions of a major linter or framework, also verify peer-dep ranges of _all_ plugins (`npm view <plugin> peerDependencies.<peer>`) before pinning.

## 2026-06-07 — TS error TS6310: Referenced project may not disable emit

- **What broke:** Initial `tsconfig.node.json` had `composite: true` AND `noEmit: true`. TS rejected the reference from `tsconfig.json`.
- **Root cause:** TS project references require referenced projects to actually emit (or at least allow it). Composite + noEmit is illegal.
- **Fix:** dropped the project reference; `tsconfig.node.json` is standalone (no composite, no reference from root tsconfig). Vite handles `vite.config.ts` typecheck on its own.
- **Avoid next time:** if a separate tsconfig is just for editor awareness of a config file, don't use `composite` / project references — keep it standalone.

## 2026-06-07 — Functions build TS5107: moduleResolution=node10 deprecated; TS5011: rootDir required

- **What broke:** Functions `tsc` build failed under TS 6 on the legacy `moduleResolution: "node"` + missing `rootDir`.
- **Root cause:** TS 6 surfaces `node` as deprecated `node10`; modern Cloud Functions builds use `node16` resolution. Without explicit `rootDir`, TS infers from sources and emits a structural warning.
- **Fix:** set `module: "node16"`, `moduleResolution: "node16"`, `rootDir: "src"`, `outDir: "lib"`.
- **Avoid next time:** when scaffolding new TS projects under TS 6+, set `module`, `moduleResolution`, `rootDir`, `outDir` explicitly — don't rely on defaults.

## 2026-06-07 — 9 moderate npm audit issues inside firebase-admin's transitive deps

- **What:** After installing h3-js in functions/, `npm audit` reports 9 moderate vulns in transitive deps of `firebase-admin` and `firebase-functions` — `uuid`, `gaxios`, `google-gax`, `teeny-request`, `retry-request`, `@google-cloud/firestore`, `@google-cloud/storage`.
- **Severity:** moderate; none in our code; all reachable only via firebase-admin call paths we don't touch directly. None are exploitable from the browser (Functions only).
- **Why not fix:** `npm audit fix --force` would downgrade `firebase-admin@13.10.0` to an older line incompatible with our pinned `firebase-functions@7.2.5`. Breaking change for no security gain — Google publishes the next firebase-admin minor with the fixes.
- **What we did:** logged here; nothing else. Re-check when bumping firebase-admin.

## 2026-06-07 — Scaling shortcut: rankNearbyVolunteers fetches all available volunteers in-memory

- **What:** The matching Cloud Function reads all users with `availableNow=true` (capped at 500) and post-filters by H3 distance / skill / risk in memory.
- **Why this shortcut:** Firestore's `where('field','in',[...])` caps at 30 values. A 2 km search radius at H3 resolution 9 covers ~125 cells — too many for a single `in` query. The clean fix is multi-resolution H3 indexing (store res-7 and res-9 cells, query by res-7 first) or a GeoFirestore-style geohash range query. That's a multi-day spike, not Phase 1 work.
- **Production risk:** with thousands of available volunteers in one city, the in-memory fetch + filter becomes the bottleneck. Add per-city sharding before scaling beyond a few hundred concurrent volunteers.

## 2026-06-07 — Auth-then-navigate race: first sign-in bounced back to /login, second worked

- **What broke:** In a private window, signing in via Email/Password (and Phone OTP) the _first_ attempt redirected back to `/login`. The _second_ submit on the same form worked.
- **Root cause:** The form's submit handler called `navigate('/app')` synchronously after `signInWithEmailAndPassword` resolved. The Firebase user is signed in by then, but `AuthProvider`'s `onAuthStateChanged` listener fires on the next microtask, so `AuthContext` still reports `signed-out` when `ProtectedRoute` on `/app` mounts → it bounces to `/login`.
- **Fix:** removed `navigate(...)` from `EmailAuthForm` and `PhoneAuthForm`. Added a page-level hook `useRedirectWhenSignedIn()` in `src/lib/use-redirect-when-signed-in.ts` used by `/login` and `/signup`. The hook watches `useAuthState()` and only navigates once the provider has caught up (no-doc / incomplete / ready), routing the user to the correct next step.
- **Avoid next time:** never derive navigation from a Firebase promise resolution while a separate context subscription is the source of truth for auth state. React to the context.

## 2026-06-07 — Functions emulator: dev Node 26 vs prod Node 22 mismatch (soft warning)

- **What happened:** `functions: Your requested "node" version "22" doesn't match your global version "26". Using node@26 from host.`
- **Root cause:** `functions/package.json` declares `engines.node: "22"` (Cloud Functions prod runtime). Local machine has Node 26 globally.
- **Severity:** soft — emulator runs fine on host's Node 26 because 26 ≥ 22. Risk is using Node-26-only features that fail on prod's Node 22.
- **Mitigation:** functions code targets ES2022 (per `functions/tsconfig.json`) and avoids Node 23/24/25/26-only APIs. Pre-deploy: run `nvm use 22` + `npm --prefix functions run build` to typecheck against real Node 22 before any Blaze deploy.
- **Long-term fix:** install nvm + set `.nvmrc` to 22 inside `functions/` so the host can mirror prod. Not blocking M1.

## 2026-06-07 — Hosting emulator port 5000 conflict with macOS AirPlay Receiver

- **What broke:** `firebase emulators:start` reported `Error: Could not start Hosting Emulator, port taken.` for port 5000.
- **Root cause:** macOS (Monterey+) AirPlay Receiver listens on :5000 by default. Common conflict for any dev tool using 5000.
- **Fix:** changed `firebase.json` emulators.hosting.port from 5000 to 5002. (Also updated `techContext.md` port table.)
- **Alternative (not chosen):** disable AirPlay Receiver in System Settings > General > AirDrop & Handoff. Avoided because it changes system state for non-dev reasons.
- **Avoid next time:** when picking dev ports, skip 5000 / 7000 / both of which macOS Control Center features claim.

## 2026-06-07 — `firebase emulators:start` failed: JDK 17 too old; needs JDK 21+

- **What broke:** `firebase emulators:start` printed `Error: firebase-tools no longer supports Java version before 21. Please install a JDK at version 21 or above`.
- **Root cause:** firebase-tools 15.x (current) bumped minimum JDK requirement to 21. The widely-cited "JDK 11+" guidance is stale.
- **Fix:** `brew install openjdk@21` then add to PATH (see brew's post-install hint, uses `$(brew --prefix)/opt/openjdk@21/bin`). Verify `java -version` shows 21+.
- **Avoid next time:** when telling someone to install a JDK for a Firebase/JVM tool, check the tool's _current_ minimum in its release notes — don't repeat outdated docs.

## 2026-06-07 — Cloud Storage requires Blaze (Console blocker; emulator path keeps us moving)

- **What broke:** Firebase Console > Storage > Get started shows "To use Storage, upgrade your project's pricing plan". Spark cannot create a Storage bucket as of 2026.
- **Root cause:** Google policy change (2024+) — Cloud Storage for Firebase is now Blaze-only.
- **Fix:** skip Console Storage; use the Storage emulator for all dev. Production deploy of Storage-touching features blocked until Blaze upgrade — added to pre-launch checklist (see decisions.md).
- **Avoid next time:** when picking a BaaS plan in early planning, confirm which services are gated on the paid tier. Spark's "free" services list shrinks over time.

## 2026-06-07 — ESLint complained `vite.config.ts` not in project service

- **What broke:** `eslint .` with `recommendedTypeChecked` and `projectService: true` errored that `vite.config.ts` was not found by the project service.
- **Root cause:** `tsconfig.json` only includes `src`. Type-aware lint can't service files outside the project.
- **Fix:** split eslint.config.js into two blocks — type-aware lint only for `src/**`, plain lint (no type info) for root `.ts/.js` files.
- **Avoid next time:** scope `projectService` strictly to the files that are actually in the TS project's include glob.

## 2026-06-08 — Cloud Function awardPointsOnCompletion transaction order violation

- **What broke:** The Firestore trigger transaction in `awardPointsOnCompletion` failed with `Error: Firestore transactions require all reads to be executed before all writes`.
- **Root cause:** Inside the transaction block, the code updated the volunteer document (a write) and then attempted to fetch the customer document (a read).
- **Fix:** Moved the customer document read statement to the top of the transaction block, before the first write.
- **Avoid next time:** Always verify that every database read statement inside a Firestore transaction is executed before any write/update statements.

## 2026-06-08 — Firestore rules crash on missing user accountStatus / isAdmin

- **What broke:** Users were blocked from proceeding past the role/consent onboarding steps due to permission denials.
- **Root cause:** The `isSuspendedOrBanned` and `isAdmin` helpers evaluated paths like `get(path).data.accountStatus` and `get(path).data.isAdmin`. For newly created users, these optional fields were not defined, triggering a runtime "undefined property" evaluation error in rules, which fails open checks.
- **Fix:** Rewrote helper rules to safely verify that the field key exists in `data.keys()` before attempting to access/check its value. Also did this for `acceptedVolunteerId` in `/tasks/{taskId}/events` read rules.
- **Avoid next time:** Never access optional fields directly in Firestore security rules without verifying their presence in the document map using `'key' in get(path).data.keys()`.

## 2026-06-08 — Admin user lookup and task audit failing with permission denied

- **What broke:** Searching for a user or task in the Admin Dashboard failed, and the stats card didn't load.
- **Root cause:** Firestore security rules restricted read operations for `users/{userId}` to the owner only (`isOwner(userId)`), and `tasks/{taskId}` to the customer/volunteer only. The administrator (`isAdmin()`) had no read permissions, preventing them from fetching profiles or list-querying collections.
- **Fix:** Added `|| isAdmin()` to the read permission rules under `users/{userId}`, `tasks/{taskId}`, and `tasks/{taskId}/events/{eventId}` in `firestore.rules`.
- **Avoid next time:** When creating security rules for collections that need admin moderation or lookup screens, always ensure `isAdmin()` permissions are included in the read/list rule definitions.
