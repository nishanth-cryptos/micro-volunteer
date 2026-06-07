# CLAUDE.md

> Read this file and `memory-bank/` **before doing anything** in this repo.

## Project
Volunteer Connector — a hyperlocal micro-volunteering web app, Phase 1 MVP.

Source of truth for scope: `memory-bank/projectbrief.md`.

## Rules of engagement (binding)

### Anti-hallucination
1. Never invent APIs, function signatures, env vars, or config keys. Verify with installed types or official docs.
2. Pin exact versions in `package.json`. Don't silently up/downgrade.
3. If a requirement is ambiguous, **ask one clear question** before implementing.
4. State uncertainty explicitly.
5. No fake "done." Typecheck + lint + (where practical) runtime check before claiming success. If not runtime-tested, say "not yet verified at runtime."
6. Mark mock data as `// MOCK — replace before prod` and track in `memory-bank/progress.md`.
7. Scope discipline — touch only files relevant to the current task.
8. Cite the source (doc URL or installed type file path) when using a non-obvious API.

### Governance (security, privacy, safety)
- Data minimization; document every PII field in `systemPatterns.md` PII inventory.
- Never log phone, email, OTPs, auth tokens, or precise coordinates.
- Server-authoritative model: trust scores, points, OTP gen/verify, matching rank live in Cloud Functions only.
- Firestore + Storage rules deny-by-default; every grant role-scoped + owner-scoped. No `if true`.
- Two OTP systems are distinct: **Auth OTP** (Firebase SMS) vs **Task Start/End OTP** (app-generated, server-only, never sent to volunteer's device, never logged).
- Block high-risk and prohibited tasks at creation.
- Capture explicit T&C consent with timestamp + version.
- WCAG 2.1 AA accessibility is a requirement, not polish.

## Working agreement (every session)
1. Read the entire `memory-bank/` first.
2. Confirm the current milestone and state your plan in 2–4 lines before coding.
3. Ask if anything is ambiguous.
4. Small, verifiable steps. Typecheck + lint before "done."
5. Update `progress.md`, `fileIndex.md`, `decisions.md`, `errors.md` as you go.
6. End each session with: what changed · what's verified vs unverified · what's next.

## File-header rule
Every new source file starts with a short comment block: purpose · key responsibilities · which `memory-bank/` entry governs it. Keep `fileIndex.md` in sync.

## Memory bank contents
| File | Purpose |
|---|---|
| `memory-bank/projectbrief.md` | Scope source of truth (the 12 features + out-of-scope list) |
| `memory-bank/techContext.md` | Stack, versions, env vars, run/build/lint commands |
| `memory-bank/systemPatterns.md` | Architecture, Firestore model, security-rules summary, Cloud Function inventory, PII inventory, matching formula, UI patterns |
| `memory-bank/decisions.md` | Append-only decision log |
| `memory-bank/errors.md` | Append-only error/issue log |
| `memory-bank/progress.md` | Current milestone, done/in-progress/blocked, mocks |
| `memory-bank/fileIndex.md` | One line per source file → purpose → key exports |

## Commands

### Frontend
```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run lint
npm run format
npm run format:check
```

### Cloud Functions
```bash
npm --prefix functions install
npm --prefix functions run typecheck
npm --prefix functions run build
npm --prefix functions run serve   # emulators
```

### Firebase emulators (all services)
```bash
npm run emulators          # persistent — imports + exports ./emulator-data
firebase emulators:start   # one-shot — wipes Auth/Firestore on Ctrl+C
# Auth :9099 · Firestore :8080 · Functions :5001 · Storage :9199 · Hosting :5002 · UI :4000
```

## Milestones (build order)
M0 Foundation → M1 Auth & roles → M2 Profile & availability → M3 Task posting & risk → M4 Matching engine → M5 Notifications & lifecycle → M6 OTP proof of work → M7 Chat → M8 Points & trust/safety/admin.

Finish + verify each before starting the next.
