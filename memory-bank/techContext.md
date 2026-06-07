# Tech Context

## Stack
| Layer | Choice | Version (pinned) |
|---|---|---|
| Build tool | Vite | 8.0.16 |
| Vite React plugin | @vitejs/plugin-react | 6.0.2 |
| Vite Tailwind plugin | @tailwindcss/vite | 4.3.0 |
| Framework | React | 19.2.7 |
| Language | TypeScript (strict) | 6.0.3 |
| Styling | Tailwind CSS v4 | 4.3.0 |
| Accessible primitives | @headlessui/react | 2.2.10 |
| BaaS | Firebase Web SDK | 12.14.0 |
| Cloud Functions runtime | firebase-functions v2 | 7.2.5 |
| Admin SDK | firebase-admin | 13.10.0 |
| Map UI | Leaflet + OpenStreetMap | TBD M3 |
| Geo indexing | h3-js | TBD M4 |
| Lint | ESLint flat config | 9.39.4 (NOT 10 — see errors.md) |
| Lint plugins | typescript-eslint, react-hooks, jsx-a11y, prettier | 8.60.1 / 7.1.1 / 6.10.2 / 10.1.8 |
| Format | Prettier | 3.8.3 |
| Hosting | Firebase Hosting | (CLI) firebase-tools 15.19.1 |

## Node toolchain
- Node v26.0.0
- npm 11.12.1
- Functions runtime declared in `functions/package.json` engines: **Node 22**

## Environment variables (NAMES ONLY — never commit values)
Frontend reads from `import.meta.env` (typed in `src/vite-env.d.ts`):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (optional)
- `VITE_USE_EMULATORS` — set to `1` in `.env.local` to point the frontend at the local emulator suite (Auth 9099 / Firestore 8080 / Functions 5001 / Storage 9199 / Hosting 5002 / UI 4000). Leave blank for production. Hosting uses 5002 not 5000 — macOS AirPlay Receiver squats on :5000.

Copy `.env.example` → `.env.local`, fill from Firebase Console.

## Plan tier
**Spark (free)** for all of Phase 1 dev. Cloud Functions deploy is gated on Blaze upgrade — deferred until pre-launch. Until then, Functions run only inside the emulator. See `decisions.md` 2026-06-07 entry "Spark plan + emulators".

## Commands
```bash
# Frontend
npm install                  # install root deps
npm run dev                  # Vite dev server
npm run build                # tsc --noEmit && vite build
npm run preview              # preview built bundle
npm run typecheck            # tsc --noEmit
npm run lint                 # eslint .
npm run format               # prettier --write .
npm run format:check         # prettier --check .

# Cloud Functions
npm --prefix functions install
npm --prefix functions run typecheck
npm --prefix functions run build
npm --prefix functions run serve   # build + emulators

# Firebase CLI (install once globally)
npm install -g firebase-tools@15.19.1
firebase login
firebase use <project-id>
firebase emulators:start
firebase deploy
```

## External services
- **Firebase Auth** — Phone (SMS) + Email Link/Password. SMS quota = real-money concern; use emulator in dev.
- **Cloud Firestore** — primary datastore.
- **Cloud Storage** — profile photos, ID images (locked-down rules; no public URLs).
- **Cloud Functions (2nd gen)** — server-authoritative logic (matching, OTPs, points, trust).
- **Firebase Cloud Messaging (FCM)** — push notifications for task offers.
- **Firebase Hosting** — static hosting for the SPA.

## Setup steps for fresh checkout
1. `npm install`
2. `npm --prefix functions install`
3. Copy `.env.example` → `.env.local`, fill from Firebase Console.
4. Update `.firebaserc` with real Firebase project ID.
5. `firebase login` then `firebase use <project-id>`.
6. `npm run dev` (frontend) + `firebase emulators:start` in another shell for backend.
