# Tech Context

## Stack

| Layer              | Technology                         | Version    |
| ------------------ | ---------------------------------- | ---------- |
| Runtime            | Node.js                            | 22         |
| Language           | TypeScript                         | 6.0.3      |
| Frontend framework | React                              | 19.2.7     |
| Router             | react-router-dom                   | 7.17.0     |
| Build tool         | Vite                               | 8.0.16     |
| Vite React plugin  | @vitejs/plugin-react               | 6.0.2      |
| CSS framework      | Tailwind CSS v4 (via @tailwindcss/vite) | 4.3.0  |
| UI components      | @headlessui/react                  | 2.2.10     |
| Maps               | Leaflet + react-leaflet            | 1.9.4 / 5.0.0 |
| Geospatial index   | h3-js                              | 4.4.0      |
| Backend            | Firebase (Auth, Firestore, Storage, Functions, Hosting) | 12.14.0 (client SDK) |
| Cloud Functions    | firebase-functions v2              | 7.2.5      |
| Admin SDK          | firebase-admin                     | 13.10.0    |
| App Check          | Firebase App Check (ReCaptcha Enterprise) | via firebase SDK |
| Linter             | ESLint 9 (flat config)             | 9.39.4     |
| Formatter          | Prettier                           | 3.8.3      |
| A11y lint          | eslint-plugin-jsx-a11y             | 6.10.2     |
| E2E testing        | Playwright                         | ^1.62.1    |
| Rules testing      | @firebase/rules-unit-testing       | ^5.0.2     |

## Fonts

- **Body**: Inter (400, 500, 600, 700) — loaded from Google Fonts
- **Headings**: Outfit (500, 600, 700, 800) — loaded from Google Fonts

## Color Palette

- Background: `#fafaf8`
- Text: `#131312`
- Primary green: `#1f6f5c` (buttons, accents)
- Primary green hover: `#185845`
- Neutral tones via Tailwind `neutral-*`
- Error accents: red/amber Tailwind palettes

## Firebase Project

- Project ID: `micro---volunteer`
- Functions region: `asia-south1`

## Environment Variables

All prefixed `VITE_` for Vite client injection.

| Variable                             | Required | Description                                    |
| ------------------------------------ | -------- | ---------------------------------------------- |
| `VITE_FIREBASE_API_KEY`              | ✅       | Firebase Web SDK API key                       |
| `VITE_FIREBASE_AUTH_DOMAIN`          | ✅       | Firebase Auth domain                           |
| `VITE_FIREBASE_PROJECT_ID`           | ✅       | Firebase project ID                            |
| `VITE_FIREBASE_STORAGE_BUCKET`       | ✅       | Firebase Storage bucket                        |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`  | ✅       | Firebase messaging sender ID                   |
| `VITE_FIREBASE_APP_ID`              | ✅       | Firebase app ID                                |
| `VITE_FIREBASE_MEASUREMENT_ID`       | ❌       | GA measurement ID (optional)                   |
| `VITE_USE_EMULATORS`                | ❌       | Set to `"1"` to connect to local emulators     |
| `VITE_FIREBASE_APPCHECK_SITE_KEY`   | ❌       | ReCaptcha Enterprise site key for App Check    |

Copy `.env.example` → `.env.local` and fill values from Firebase Console. Never commit `.env.local`.

## Commands

### Frontend

```bash
npm install
npm run dev          # Vite dev server (:5173)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run format       # prettier --write .
npm run format:check # prettier --check .
```

### Cloud Functions

```bash
npm --prefix functions install
npm --prefix functions run typecheck   # tsc --noEmit
npm --prefix functions run build       # tsc
npm --prefix functions run test        # build && node --test (sequential)
```

### Firebase Emulators

```bash
npm run emulators           # persistent — imports + exports data
npm run dev:all             # runs functions build:watch + emulators + vite dev simultaneously
npm run start               # alias for dev:all (node scripts/dev-all.js)
```

Emulator ports: Auth `:9099` · Firestore `:8080` · Functions `:5001` · Storage `:9199` · Hosting `:5002` · UI `:4000`.

### Seeding

```bash
npm run seed:all      # seeds admin + users into emulators
npm run seed:admin    # seeds admin user only
npm run seed:users    # seeds test users only
```

### E2E Tests

```bash
npx playwright test   # runs e2e/ specs against localhost:5173 + emulators
```

## TypeScript Configuration

- Frontend: `tsconfig.json` — ES2022, strict, noEmit, jsx react-jsx, bundler module resolution.
- Functions: `functions/tsconfig.json` — ES2022, strict, node16 module, outDir `lib/`.
- Both enforce: `strictNullChecks`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.

## ESLint Configuration

Flat config (`eslint.config.js`): type-aware lint for `src/**/*.{ts,tsx}` with react-hooks + jsx-a11y plugins; non-type-aware for root config files. Prettier integration via `eslint-config-prettier`.
