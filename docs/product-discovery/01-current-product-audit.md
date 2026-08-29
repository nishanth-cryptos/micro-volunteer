# 01 — Current Product Audit

> **Purpose:** Describe only what Hey Padosi currently is. No competitors, no proposals, no roadmap.

---

## 1. Product Definition

Hey Padosi is a verified hyperlocal micro-volunteering web application. Requesters post safe, low/medium-risk tasks; nearby available volunteers are matched by location, skills, trust score, and availability; completion is verified via app-generated Start/End OTP; points and skill points are awarded after completion.

**Brand name:** Hey Padosi ("Hey Neighbour")
**Platform:** Progressive Web App (React 19, Vite 8)
**Backend:** Firebase (Firestore, Auth, Cloud Functions v2, Cloud Storage, FCM)
**Region:** asia-south1 (Mumbai), India-focused

---

## 2. Current Target Users

| Segment | Description |
|---|---|
| **Requesters (Customers)** | Individuals who need help with small, safe, nearby tasks |
| **Volunteers** | Individuals willing to help neighbours with tasks |
| **Dual-role users** | Users who both request and volunteer |
| **Admins** | Platform moderators with access to the admin dashboard |

**Current geographic focus:** Hyperlocal — 2–5 km matching radius. Seed data is centred around Kalewadi, Pune, India.

---

## 3. Current Phase 1 Scope (12 Features)

| # | Feature | Status |
|---|---|---|
| 1 | Auth & signup (Phone OTP + Email, T&C consent) | ✅ Complete |
| 2 | Roles (volunteer, customer, or both) | ✅ Complete |
| 3 | Profile (name, photo required, optional ID, bio) | ✅ Complete |
| 4 | Volunteer availability toggle (ON/OFF) | ✅ Complete |
| 5 | Task posting (category, skills, location, duration, structured instructions) | ✅ Complete |
| 6 | Risk classification (Low/Medium only; High/Prohibited blocked) | ✅ Complete |
| 7 | H3-based nearby matching (res-9, 2–5 km) | ✅ Complete |
| 8 | Volunteer ranking (multi-factor scoring formula) | ✅ Complete |
| 9 | Notifications & accept/reject (offer dispatch, radius expansion) | ✅ Complete |
| 10 | In-app chat (post-acceptance, report/block aware) | ✅ Complete |
| 11 | Start/End OTP task verification (server-side, hash+salt+TTL) | ✅ Complete |
| 12 | Points, trust/safety, admin dashboard | ✅ Complete |

**Explicitly out of scope (per `projectbrief.md`):** Cafe vouchers, Aadhaar verification, insurance, masked calling, AI/LLM content review, deposits, advanced certificates, leaderboards, IP-ban-as-primary-control, any high-risk or prohibited task type.

---

## 4. Current User Roles

| Role | Access | Key Capabilities |
|---|---|---|
| **Customer** | Post tasks, view own tasks, chat, rate, report | Task creation, OTP verification, rating |
| **Volunteer** | Receive offers, accept/reject, chat, complete tasks | Availability toggle, offer inbox, OTP entry |
| **Dual-role** | Combined customer + volunteer capabilities | Both dashboards available |
| **Admin** | Admin dashboard, moderation | Reports queue, user lookup, task audit, activity log, warn/suspend/ban |

Role assignment occurs during onboarding (step 2). Admin role is set server-side via seed scripts.

---

## 5. Current User Journeys

### Customer Journey
1. Landing page → Signup (Phone OTP or Email)
2. T&C consent → Role selection → Profile (name, photo, bio) → Skills (if dual-role)
3. Customer Dashboard → "Post a Task" (category, skills, location, duration, instructions)
4. Task enters `searching` → Radar view shows volunteer blips
5. Volunteer accepts → Chat opens → Customer generates Start OTP → Verbal handoff
6. Task in progress → Customer generates End OTP → Verbal handoff → Task completed
7. Customer rates volunteer (1–5 stars) → Points awarded

### Volunteer Journey
1. Landing page → Signup → Onboarding (consent, role, profile, skills)
2. Volunteer Dashboard → Toggle availability ON (triggers geolocation + H3 cell)
3. Offer appears in inbox → Accept or Reject
4. Chat opens with customer → Navigate to meeting point
5. Receive Start OTP verbally → Enter in app → Task starts
6. Complete work → Receive End OTP verbally → Enter in app → Task completed
7. Points and skill points awarded, trust score updated

### Admin Journey
1. Login → Admin Home → Navigate to Admin Dashboard
2. Review pending reports → Warn / Suspend / Ban / Dismiss
3. User lookup → View moderation log → Apply actions
4. Task audit trail → Review event history
5. Activity log → Monitor platform events

---

## 6. Current Feature Inventory

### Authentication
- Firebase Phone OTP (SMS) + Email/Password
- Auth emulator for development (test numbers, no real SMS)
- `useRedirectWhenSignedIn` hook to prevent auth-then-navigate race

### Onboarding (4-step progressive)
- Step 1: T&C consent capture (version + timestamp)
- Step 2: Role selection (volunteer / customer / both)
- Step 3: Profile (display name, photo required, bio, optional ID image)
- Step 4: Skills selection (volunteer/dual-role only; card grid with SVG icons)

### Task Creation
- Category selection (chip-based)
- Required skills (multi-select, max 5)
- Duration (stepper with presets: 15/30/60/120 min)
- Location (Leaflet/OSM map with draggable pin, geolocation, H3 cell computation)
- Structured instructions (meeting point, what to bring, preference, safety note)
- Risk auto-derived from category
- Scheduled tasks support (`scheduledFor` field, `activateScheduledTasks` function)

### Matching Engine
- `rankNearbyVolunteers` HTTPS callable
- Scoring formula: Distance 30% + Skill 25% + Trust 20% + Availability 15% + Past Completion 10% − Report Penalty
- H3 resolution 9 (~174m hex edge), ring-based radius expansion
- Block-aware: mutual blocks excluded from matching
- `dispatchOffers` trigger writes offer docs with denormalised task info
- `onVolunteerAvailable` trigger catches late-arriving volunteers
- `periodicRedispatchOffers` scheduler expands radius every 60s (cap 10km)

### Offer System
- Offer docs at `tasks/{taskId}/offers/{volunteerId}`
- States: offered → accepted / rejected / expired / superseded
- Race-safe transaction for acceptance
- Volunteer inbox via collection-group query
- Top batch capped at 10 offers per dispatch cycle

### Chat
- One chat per accepted task (`chatId === taskId`)
- Participant-only, immutable messages for clients
- System messages on accept/start/complete (server-side)
- Per-message report with `messageRef`
- Block-aware composer (disabled when blocked)
- Read-only after task completion
- Reassignment wipes prior conversation

### Task Verification (OTP)
- Start OTP: customer generates → verbal handoff → volunteer enters
- End OTP: same flow for completion
- Server-side: SHA-256(code+salt), TTL ~10 min, plaintext returned once to customer only
- Never logged, never returned to volunteer client

### Points & Trust
- Volunteer: 10 base + 1/15min duration bonus (cap 18 total)
- Volunteer skill points: +1 per required skill
- Customer: 2 points on task completion
- Trust score: 0.35×tasks + 0.30×rating + 0.15×hours + 0.10×idVerified − penalty
- Clamped [30, 100], badges: Newcomer (<60), Reliable (60–84), Trusted (≥85)

### Safety & Moderation
- Report system: safety, no_show, inappropriate, fraud, other
- Reporting window: accepted/in_progress/completed (within 24h)
- Duplicate report prevention (same reporter+target+task)
- `uniqueReporterCount` for multi-reporter visibility
- Block system: mutual blocks with denormalised name/photo snapshots
- Unblock callable
- Moderation actions: warn / suspend / ban / unban
- Ban lifecycle: `bannedAt` → 30-day purge (daily scheduler deletes Auth, Storage, user doc)
- Mid-task suspension: task flips to `searching`, OTPs cleared, reassignment notice
- Account freeze system with acknowledgment flow
- Full-screen banned/suspended interceptor in ProtectedRoute

### Admin Dashboard
- 4 tabs: Pending Reports → User Lookup → Task Audit Trail → Activity Log
- No raw UIDs anywhere (names resolved to display names, roles)
- Collapsible report cards with inline action buttons
- 10-character minimum reason validation
- Success/error banners with auto-dismiss
- Activity log: 50 per page, event-type filter, "Load more"

### Trail Service (Experimental)
- Commute trail mining: stay-point detection, trip segmentation, route clustering
- Corridor-based task matching along volunteer routes
- Departure detection with prompt modal
- Privacy-controlled: consent-based, 45-day retention
- Data stored in `user_trails/{userId}` (Firestore)

---

## 7. Current Task Lifecycle

```
Created → searching → [offers dispatched]
                     → accepted → [chat opens, Start OTP available]
                                → in_progress → [End OTP available]
                                              → completed → [points awarded, rating]
                     → expired (24h timeout, scheduler)
                     → cancelled (customer cancels)
```

**Status transitions** are server-authoritative (Cloud Functions only). Clients cannot write `status` directly.

---

## 8. Current Safety Model

| Layer | Implementation |
|---|---|
| **Task risk classification** | Low (open), Medium (requires ID verification), High/Prohibited (blocked at creation) |
| **Identity** | Phone OTP + optional ID image; `idVerified` flag is server-only |
| **OTP verification** | Hash+salt+TTL for task start/end; prevents false completion claims |
| **Reporting** | 5 canonical reasons, 24h post-completion window, unique reporter count |
| **Blocking** | Mutual block; excludes from matching, disables chat |
| **Moderation** | Admin warn → suspend → ban pipeline; mid-task reassignment |
| **Account enforcement** | Full-screen interceptors; suspended/banned users blocked from all actions |
| **Data purge** | 30-day post-ban purge of Auth, Storage, user doc |
| **Audit trail** | Immutable `tasks/{id}/events` + site-wide `activityLog` |
| **PII protection** | No logging of phone/email/OTPs/tokens/coordinates |

---

## 9. Current Trust Model

- Trust score: server-computed, normalised formula with saturation caps
- Components: verified tasks (35%), average rating (30%), verified hours (15%), ID verification (10%)
- Penalty: accumulated from moderation actions (warn +0.15, suspend +0.25)
- Floor: 30 (newcomers not penalised unfairly)
- Ceiling: ~90 (maxed-out volunteer)
- Badges displayed: Newcomer / Reliable / Trusted (Emerald chip)
- Score influences matching rank (20% weight)
- Score recomputed on: task completion, rating, moderation action

---

## 10. Current Matching Model

- **Geo-indexing:** H3 resolution 9 (~174m hex edges), ring-based expansion
- **Initial radius:** ~2 km, expanding to 10 km max
- **Scoring:** 5-factor weighted formula with report penalty deduction
- **Dispatch:** Top 10 candidates per batch, radius expansion every 60s
- **Late arrivals:** `onVolunteerAvailable` trigger catches volunteers who come online after initial dispatch
- **Block-aware:** Mutual blocks excluded from both directions
- **Known limitation:** Fetches all available volunteers in-memory (capped at 500), post-filters. Production risk with thousands of concurrent volunteers.

---

## 11. Current Communication Model

- **Pre-acceptance:** No direct communication (by design — safety)
- **Post-acceptance:** In-app chat, participant-only
- **Message rules:** Text only, 1000 char max, immutable, no edit/delete
- **System messages:** Auto-generated on accept/start/complete
- **Reporting:** Per-message and per-user reporting available in chat
- **Blocking:** Disables composer for both parties
- **Post-completion:** Read-only chat history
- **No:** Voice calls, video, file sharing, image sharing, typing indicators, read receipts

---

## 12. Current Admin/Moderation Model

- Admin users are seeded via scripts (`isAdmin: true`)
- No self-service admin creation
- Admin dashboard: `/admin` route with `requiresAdmin` guard
- Moderation pipeline: Report → Review → Action (warn/suspend/ban/dismiss)
- All admin actions are audited in `adminActions` collection
- Activity log provides site-wide event visibility
- Mid-task suspension triggers automatic reassignment
- No tiered admin roles (single admin level)

---

## 13. Current Technical Architecture (Product Level)

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, TypeScript 6 (strict), Tailwind CSS v4 |
| **UI primitives** | Headless UI for accessible components |
| **Maps** | Leaflet + OpenStreetMap |
| **Geo-indexing** | h3-js (resolution 9) |
| **Auth** | Firebase Phone Auth + Email/Password |
| **Database** | Cloud Firestore (asia-south1) |
| **Storage** | Cloud Storage (emulator only; Blaze upgrade needed) |
| **Server logic** | Cloud Functions v2 (firebase-functions 7.2.5, Node 22) |
| **Push notifications** | FCM (deferred — emulator only) |
| **Hosting** | Firebase Hosting |
| **Plan** | Spark (free); Blaze upgrade required for production |

**Server-authoritative invariant:** Trust scores, points, OTPs, matching, risk levels, and moderation are all computed in Cloud Functions. Firestore rules enforce that clients cannot write these fields.

---

## 14. Current UI/UX Structure

### Design System
- **Palette:** `#fafaf8` background, `#1f6f5c` emerald green accent, `#ececea` borders, `#131312` text
- **Typography:** System fonts (no custom web fonts loaded)
- **Animation system:** `vc-*` prefix keyframes (fade-up, shimmer, radar-ping, check-pop, etc.)
- **Reduced motion:** All animations respect `prefers-reduced-motion: reduce`
- **Layout:** Mobile-first, responsive (max-w-3xl content areas)

### Navigation
- Public: Landing (`/`), Login (`/login`), Signup (`/signup`)
- Onboarding: Consent → Role → Profile → Skills (progressive, step-guarded)
- Authenticated: App Home (`/app`), Create Task (`/create-task`), Task Detail (`/tasks/:id`)
- Admin: Dashboard (`/admin`)
- Bottom navigation pill: Dashboard / Profile tabs (customer & volunteer dashboards)
- Your Routes page (`/your-routes`) for trail management

### Key UI Components
- **Customer Dashboard:** Two-screen (Tasks/Profile), gradient hero, Leaflet map, ongoing tasks, past tasks tabs
- **Volunteer Dashboard:** Hero with karma/trust/completions, availability toggle, offer inbox, nearby requests, accepted tasks, blocked users list
- **Create Task:** Sticky progress strip, animated chips, time stepper, map picker, sticky bottom action bar
- **Task Detail:** Radar searching view (pulsing rings, volunteer blips), accepted hero with avatar, OTP panels, chat panel
- **Radar Searching:** Concentric grid, ping rings, blip count from real offers, live stats (reached/radius/timer)
- **OTP Panels:** Flip-cell digit reveal, gradient action buttons, countdown timer

---

## 15. Current Strengths (Observable)

1. **Comprehensive safety model:** Risk classification, OTP verification, reporting/blocking, moderation pipeline, audit trail, and data purge create multiple safety layers
2. **Server-authoritative architecture:** Trust scores, points, OTPs, and matching are all computed server-side; clients cannot manipulate critical fields
3. **Deny-by-default security rules:** Every Firestore and Storage rule starts from denial; grants are role+owner scoped
4. **Thoughtful matching formula:** Multi-factor scoring with block awareness, late-arrival coverage, and periodic radius expansion
5. **Structured task creation:** Minimal free text, category+skill chips, structured instructions reduce ambiguity
6. **Immutable audit trail:** All task lifecycle events are append-only and server-written
7. **Progressive onboarding:** Step machine prevents users from reaching the app in an incomplete state
8. **Accessibility awareness:** ESLint jsx-a11y plugin, WCAG 2.1 AA as stated requirement, reduced motion support
9. **Polished animations:** Purpose-driven motion system with accessibility-aware reduced motion
10. **Trail Service innovation:** Commute-based task matching is a genuinely novel feature concept

---

## 16. Current Limitations (Observable)

1. **No real push notifications:** FCM is emulator-only; no real-device push until Blaze upgrade
2. **No real Storage:** Cloud Storage is emulator-only; profile photos won't work in production without Blaze
3. **Matching scalability:** All available volunteers fetched in-memory (capped 500); bottleneck at scale
4. **No email notifications:** No fallback when users aren't actively in the app
5. **No task discovery for volunteers beyond offers:** Volunteers rely entirely on dispatched offers; no browse/search
6. **Single-page landing:** Minimal landing page with no feature explanation, social proof, or onboarding guidance
7. **No PWA/offline support:** No service worker, no offline capability, no "Add to Home Screen" prompt
8. **No image sharing in chat:** Text-only messages limit coordination
9. **No task cancellation UX for customers:** `cancel-accepted-task` callable exists but UI path unclear
10. **No user profile viewing by other users:** Volunteers can't see customer profiles and vice versa (security choice, but limits trust signals)
11. **No notification center/inbox:** No persistent notification history in the UI
12. **No analytics or metrics:** No product analytics, user behaviour tracking, or conversion measurement
13. **Large component files:** `CustomerDashboard.tsx` (66KB), `VolunteerDashboard.tsx` (82KB), `AdminDashboard.tsx` (61KB) suggest monolithic components
14. **No password reset flow:** Email auth users have no visible password recovery path
15. **No task editing after creation:** Tasks cannot be modified once posted
16. **No scheduled task UI clarity:** `ScheduleTaskBottomSheet` exists but integration unclear
17. **No real-time "volunteer is on the way" status:** Customer has no location-based ETA
18. **Dual-role users see only customer dashboard:** No role-switching UI; dual-role users default to customer view
