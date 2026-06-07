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
