# Project Brief — Hey Padosi (Volunteer Connector)

## Vision

Hyperlocal micro-volunteering web app connecting neighbours who need help with nearby volunteers who can give it. Phase 1 MVP.

## Product Name

**Hey Padosi** (brand name on landing page, index.html `<title>`, logo, and meta tags).
Package name: `volunteer-connector`.

## Core Features (12)

1. **Phone + Email authentication** — Firebase Auth with SMS OTP and email/password flows; dual-method support via `AuthMethodTabs` component.
2. **Onboarding flow** — four-step guided setup: T&C consent (with version + timestamp), role selection (customer / volunteer / both), profile (name + photo + optional ID image), skills selection (volunteers only).
3. **Role system** — `customer`, `volunteer`, and `admin` roles. Dual-role users can switch via `RoleSwitcher` (persisted in localStorage). Admin is a separate `isAdmin` boolean flag.
4. **Task catalog** — 7 categories (errands, tutoring, tech-help, digital-help, mobility-assist, conversation-companionship, community-delivery) and 25 skills from `scripts/seed/catalog.json`. Risk levels: `low` and `medium`; high/prohibited rejected at creation.
5. **Task posting** — customer creates a task with title, category, required skills, location (Leaflet map picker with H3 cell), description fields (meetingPoint, whatToBring, optional preference/safetyNote), estimated minutes (5–480), search radius (500–10,000 m), and expected wait tier (fast/normal/flexible). Supports scheduled tasks with `scheduledFor` timestamp.
6. **Matching engine** — server-authoritative scoring formula: `0.30*distance + 0.25*skill + 0.20*trust + 0.15*availability + 0.10*pastCompletion - reportPenalty`. H3 grid distance, haversine distance filtering, skill overlap, trust score, verified task count, and open report penalty. Block-aware (mutual blocks excluded). Initial dispatch (top 10), periodic re-dispatch with radius expansion, and volunteer-comes-online matching.
7. **Task lifecycle** — statuses: `scheduled → searching → accepted → in_progress → completed` (also: `cancelled`, `deleted`, `expired`). Volunteer cancel after accept, customer delete before in_progress.
8. **OTP proof of work** — two distinct OTP systems:
   - **Auth OTP**: Firebase SMS for phone sign-in.
   - **Task Start/End OTP**: server-generated 4-digit codes, SHA-256 hashed with random salt, 10-minute TTL. Start OTP: customer generates, reads aloud to volunteer. End OTP: customer generates, volunteer enters to confirm completion. Plaintext returned ONCE to customer; never stored in Firestore; never sent to volunteer's client; never logged.
9. **In-app chat** — per-task chat (`chats/{taskId}`) with participant-only access, system messages for lifecycle events, mutual-block enforcement, message reporting. 1000-char message limit. Chat created on acceptance.
10. **Points & karma** — volunteer earns base 10 pts + duration bonus (1 pt per 15 min, max +8). Dual-role customers earn 2 pts per completed task. Skill-specific point tracking. Karma badge and toast components.
11. **Trust & safety** — trust score (0–100, floor 30), moderation actions (warn/suspend/ban/dismiss), abuse detection (3 violations in 7 days triggers freeze, then 3-day suspension), account states (active/warned/suspended/banned/frozen), frozen account acknowledgement flow. Admin report queue. Block/unblock users. 24-hour post-completion reporting window. Scheduled purge of banned users (30-day retention). Activity log (admin-only).
12. **Post-completion suggestions** — `suggestNextTasks` callable suggests up to 2 nearby open tasks to volunteers after completing a task, using proxy location from completed task.

## Out of Scope (Phase 1)

- Push notifications / FCM
- Payment / tipping
- In-app voice/video calls
- Background location tracking for volunteers
- Multi-language UI (i18n)
- Native mobile apps (iOS/Android)
- Social login (Google/Facebook)
- Public volunteer leaderboards
- Gamification beyond basic points
- Advanced analytics dashboard
- Task scheduling recurring patterns (only one-shot scheduled tasks supported)
- Corridor matching for trail-based tasks (data model exists; matching logic is a passthrough stub)

## Target Region

India (asia-south1 GCP region; `+91` phone format referenced in auth error messages).
