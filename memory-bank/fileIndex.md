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
- `src/main.tsx` — React root mount. Imports `./index.css` (Tailwind entry). Throws if `#root` missing.
- `src/App.tsx` — M0 landing-page smoke test. Replaced by router shell in M1.
- `src/index.css` — single `@import "tailwindcss";` directive (Tailwind v4 model).
- `src/vite-env.d.ts` — typed `ImportMetaEnv` for the `VITE_FIREBASE_*` vars.
- `src/lib/firebase.ts` — `getFirebaseApp()` lazy initializer. Reads env vars, throws clear error if missing. Does NOT export Auth/Firestore/Storage helpers (those land in M1+).

## Scripts / seed
- `scripts/seed/catalog.json` — starter seed for `catalog/categories` and `catalog/skills`. Reviewed pre-launch; loaded into Firestore by an admin-only callable in M1. Replaced by the M8 admin UI for live edits.

## Cloud Functions
- `functions/package.json` — `firebase-functions@7.2.5`, `firebase-admin@13.10.0`, Node 22 runtime.
- `functions/tsconfig.json` — TS strict; `module: node16`, `moduleResolution: node16`, `rootDir: src`, `outDir: lib`.
- `functions/src/index.ts` — empty export. Concrete functions added M4–M8 per `systemPatterns.md` inventory.

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
