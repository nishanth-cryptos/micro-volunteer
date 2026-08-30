# System Patterns

## Architecture (high level)

```
Browser (React 19 + Vite + Tailwind)
   │
   ├── Firebase Auth (Phone OTP + Email)
   ├── Firestore (reads via SDK, scoped by security rules)
   ├── Cloud Storage (reads via SDK, scoped by storage rules)
   └── Cloud Functions (HTTPS callable + Firestore triggers)
            │
            ├── Matching ranker (callable)
            ├── Task Start/End OTP generate + verify (callable)
            ├── Points & trust score updates (Firestore triggers)
            ├── FCM offer dispatch (Firestore triggers)
            └── Audit trail writer (Firestore triggers)
```

## Server-authoritative invariant

The browser is NEVER trusted for:

- Trust score updates
- Points / skill points awards
- Task Start/End OTP generation
- Task Start/End OTP verification
- Matching ranking
- Risk-level assignment
- Report adjudication (warning / suspend / ban)

Each lives in Cloud Functions; Firestore rules enforce that clients cannot write the relevant fields directly.

## Firestore data model

**STATUS: APPROVED 2026-06-07.** All six open questions resolved (see decisions.md, entries dated 2026-06-07).

### Collection inventory

| Path                                    | Purpose                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `users/{uid}`                           | Identity, roles, skills, trust, points, availability, consent                       |
| `users/{uid}/deviceTokens/{tokenId}`    | FCM device tokens (write-protected)                                                 |
| `users/{uid}/notifications/{id}`        | Per-user notification log                                                           |
| `tasks/{taskId}`                        | Posted tasks (lifecycle root)                                                       |
| `tasks/{taskId}/offers/{volunteerId}`   | Per-volunteer offer state for this task                                             |
| `tasks/{taskId}/events/{eventId}`       | **Immutable audit trail** (append-only)                                             |
| `chats/{chatId}`                        | One chat per accepted task (chatId = taskId)                                        |
| `chats/{chatId}/messages/{msgId}`       | Chat messages                                                                       |
| `reports/{reportId}`                    | User/message reports                                                                |
| `adminActions/{actionId}`               | Audit trail for admin warn/suspend/ban                                              |
| `activityLog/{entryId}`                 | Site-wide reverse-chronological event feed (admin read; Cloud Function writes only) |
| `catalog/categories` / `catalog/skills` | Curated category & skill catalogs (admin-managed, public-readable)                  |

### Document shapes (field types abbreviated)

**`users/{uid}`** — owner-scoped writes; trust/points/idVerified/banned write-locked for clients (Cloud Functions only).

```
displayName: string
photoURL: string                       // Storage path, not public URL
bio?: string
phoneNumber: string                    // mirrored from Auth for queries
email?: string                         // mirrored from Auth
roles: ('volunteer'|'customer'|'admin')[]
skills: string[]                       // keys into catalog/skills
lastKnownLocation?: {
  lat: number, lng: number,
  h3Cell: string,                      // h3-js index at RESOLUTION 9 (~174m edge)
  updatedAt: Timestamp
}
availableNow: boolean
availabilityUpdatedAt: Timestamp
idImagePath?: string                   // Storage path; never a public URL
idVerified: boolean                    // server-only writes
trustScore: number                     // 0-100; server-only writes
verifiedTaskCount: number              // server-only writes
verifiedHours: number                  // server-only writes
points: number                         // server-only writes
skillPoints: { [skillKey: string]: number }   // server-only writes
openReportsCount: number               // server-only writes
warningsCount: number                  // server-only writes
suspendedUntil?: Timestamp             // server-only writes
banned: boolean                        // server-only writes
consent: { tcVersion: string, acceptedAt: Timestamp }
createdAt: Timestamp
lastSeenAt: Timestamp
```

**`tasks/{taskId}`** — customer creates; status/lifecycle/OTPs server-only.

```
customerId: string
title: string
category: string                       // catalog key
requiredSkills: string[]               // catalog keys
description: {                         // structured, minimal free text
  meetingPoint: string,
  whatToBring: string,
  preference?: string,
  safetyNote?: string
}
location: {
  lat: number, lng: number,
  h3Cell: string,                      // h3-js at RESOLUTION 9; computed client-side, validated server-side
  h3Ring2?: string[]                   // optional precomputed ring for cheap fan-out (server-set)
}
riskLevel: 'low' | 'medium'            // server validates; 'medium' requires volunteer.idVerified
estimatedMinutes: number
status: 'searching' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'expired'
searchRadiusM: number                  // grows over time
acceptedVolunteerId?: string
acceptedAt?: Timestamp
startedAt?: Timestamp
completedAt?: Timestamp
startOtpHash?: string                  // SHA-256(code+salt); server-only; TTL ~10 min after offer; cleared after verification
startOtpSalt?: string                  // per-task random salt; server-only
startOtpExpiresAt?: Timestamp
endOtpHash?: string                    // server-only
endOtpSalt?: string                    // server-only
endOtpExpiresAt?: Timestamp
customerRating?: 1 | 2 | 3 | 4 | 5     // post-completion; server-only writes (via callable that authenticates customer)
customerRatingComment?: string         // optional; not displayed publicly in Phase 1
customerRatedAt?: Timestamp
createdAt: Timestamp
expiresAt: Timestamp                   // createdAt + 24h; status flips to 'expired' if still 'searching' at this time
```

**`tasks/{taskId}/offers/{volunteerId}`** — written only by Cloud Functions; volunteer can update `state` to 'accepted' | 'rejected' via callable, never direct.

```
volunteerId: string
state: 'offered' | 'accepted' | 'rejected' | 'expired' | 'superseded'
score: number                          // ranking score at time of offer
offeredAt: Timestamp
respondedAt?: Timestamp
```

**`tasks/{taskId}/events/{eventId}`** — IMMUTABLE. Server-only writes.

```
type: 'created' | 'offered_batch' | 'accepted' | 'rejected' | 'started' | 'completed' | 'cancelled' | 'reported' | 'radius_expanded'
actorUid: string
payload: object                        // type-specific
at: Timestamp
```

**`chats/{chatId}`** (chatId = taskId; created on acceptance):

```
taskId: string
participants: string[]                 // [customerId, volunteerId]
createdAt: Timestamp
lastMessageAt: Timestamp
lastMessagePreview: string             // for inbox listing
blockedBy?: string[]                   // if either party blocks
```

**`chats/{chatId}/messages/{msgId}`** — created by participants only; immutable after create (no edit/delete).

```
senderUid: string
text: string
sentAt: Timestamp
system: boolean                        // true for "Task started" etc.
reportedBy?: string[]                  // appended on report
```

**`reports/{reportId}`**:

```
reporterUid: string
reportedUid: string
taskId?: string
messageRef?: string                    // chats/{chatId}/messages/{msgId}
reason: 'safety' | 'no_show' | 'inappropriate' | 'fraud' | 'other'
details: string
createdAt: Timestamp
status: 'pending' | 'actioned' | 'dismissed'
adminUid?: string
actionedAt?: Timestamp
adminNote?: string
```

**`activityLog/{entryId}`** — append-only site-wide event feed; written exclusively by Cloud Functions, read only by admins:

```
eventType: 'user_registered' | 'task_created' | 'task_accepted'
         | 'task_started' | 'task_completed' | 'report_submitted'
         | 'moderation_action' | 'user_blocked'
description: string                    // human-readable; denormalised at write
                                       // time — NEVER contains raw UIDs
userId: string                         // primary actor for the event
taskId?: string                        // present when the event is task-scoped
createdAt: Timestamp
```

**`adminActions/{actionId}`** — server-only:

```
adminUid: string
targetUid: string
action: 'warn' | 'suspend' | 'ban' | 'unban'
reason: string
relatedReportId?: string
createdAt: Timestamp
expiresAt?: Timestamp
```

### Composite indexes required (initial)

| Collection / group          | Index                                                               |
| --------------------------- | ------------------------------------------------------------------- |
| `tasks`                     | `(status ASC, location.h3Cell ASC, createdAt DESC)` — nearby search |
| `tasks`                     | `(customerId ASC, status ASC, createdAt DESC)` — "my tasks"         |
| `offers` (collection group) | `(volunteerId ASC, state ASC, offeredAt DESC)` — "my offers"        |
| `chats`                     | `(participants array-contains, lastMessageAt DESC)` — inbox         |
| `reports`                   | `(status ASC, createdAt DESC)` — admin queue                        |
| `activityLog`               | `(eventType ASC, createdAt DESC)` — filtered admin activity feed    |

### Subcollection vs root choices

- **offers under tasks** — fan-out is per-task; offers don't outlive their task. Collection-group query gives volunteers their offers across all tasks.
- **events under tasks** — audit is per-task; no cross-task analytics in Phase 1.
- **messages under chats** — standard pattern.
- **reports as root** — admin queue is global; cross-task queries (e.g., reports on one user).
- **chats as root with chatId = taskId** — natural 1:1 with accepted task, but inbox needs root collection for `array-contains` participants query.

### Denormalization decisions

- Phone/email mirrored from Auth onto `users/{uid}` — supports admin lookups without joining; safe because users/{uid} reads are owner+admin scoped.
- `lastMessagePreview` on `chats/{chatId}` — avoids reading the latest message just to render inbox rows.
- Task `acceptedVolunteerId` denormalized — supports "who took my task" queries without scanning offers.
- `skillPoints` map on `users/{uid}` — avoids a per-skill subcollection; map size bounded by catalog/skills.

### Security-rules sketch (to be implemented in later milestones)

- **users/{uid}** — own user reads/limited writes; `displayName`, `photoURL`, `trustScore`, `verifiedTaskCount` readable by other authed users when a task ties them together; server-only writes on trust/points/idVerified/banned/suspendedUntil.
- **tasks** — customer creates with validators (riskLevel in {low,medium}, structured fields present); reads scoped (customer always; volunteer only on accepted/offered); all status/lifecycle/OTP writes server-only.
- **offers** — reads by volunteer (their own offers via collection-group query) and customer (their task's offers); writes server-only.
- **events** — read by participants + admin; writes server-only; no update/delete.
- **chats / messages** — participant-only read/write; messages immutable after create.
- **reports** — create by authed users; read by admins + reporter; updates server-only.
- **adminActions / catalog** — read by participants where appropriate; write admin-only.

### Resolved open questions (decisions logged 2026-06-07)

1. **H3 resolution: 9** (~174 m edge). Used for both `users.lastKnownLocation.h3Cell` and `tasks.location.h3Cell`.
2. **Task expiry: 24 h** after `createdAt`. Scheduler `expireStaleTasks` flips status to `expired` every 15 minutes for tasks still in `searching`.
3. **OTP storage: hash + salt + TTL.** Cloud Function generates a 4–6 digit code; stores `SHA-256(code + salt)` and a per-task salt on the task doc; plaintext is returned **once** to the customer in the HTTPS callable response (never written to Firestore in plaintext, never returned to the volunteer's client). TTL ~10 minutes; cleared after successful verification.
4. **Catalog seeding: static seed in M0/M1 + admin UI in M8.** Seed file at `scripts/seed/catalog.json` is the source of truth pre-launch; a Cloud Function callable (admin-only) writes it to `catalog/categories` and `catalog/skills` on first deploy. Full admin CRUD UI lands in M8.
5. **Skill match: OR with partial-credit score** (see Matching section above for the exact formula).
6. **Customer rating: 1–5 stars + optional comment** at end of `verifyEndOtp` flow. Stored on `tasks/{id}.customerRating` (+ `customerRatingComment` + `customerRatedAt`). Aggregated into volunteer `trustScore` by Cloud Function. Comment is **not surfaced publicly** in Phase 1.

## Firestore Security Rules summary

- **M0 (current):** deny-by-default for every collection.
- Future rules grant access role-scoped (volunteer / customer / admin) and owner-scoped.
- No `allow read, write: if true` — ever.
- Sensitive fields (trust score, points, hashed OTPs, status transitions) are write-protected for clients; only Cloud Functions write them via the Admin SDK.

## Cloud Functions inventory (planned, by milestone)

| Milestone | Function               | Trigger                                   | Purpose                                                                    |
| --------- | ---------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| M4        | `rankNearbyVolunteers` | HTTPS callable                            | Score volunteers for a task                                                |
| M5        | `dispatchOffers`       | Firestore onCreate(task)                  | First-batch FCM push                                                       |
| M5        | `expandRadius`         | Scheduler / Firestore                     | Expand if no acceptance in 60–90s                                          |
| M6        | `generateStartOtp`     | HTTPS callable (customer)                 | Returns code to customer only                                              |
| M6        | `verifyStartOtp`       | HTTPS callable (volunteer)                | Marks In Progress                                                          |
| M6        | `generateEndOtp`       | HTTPS callable (volunteer marks complete) | Returns code to customer only                                              |
| M6        | `verifyEndOtp`         | HTTPS callable (volunteer)                | Marks Completed, awards points                                             |
| M6        | `submitCustomerRating` | HTTPS callable (customer)                 | Writes 1–5 rating + comment after Completed; triggers trust recompute      |
| M6        | `expireStaleTasks`     | Scheduler (every 15 min)                  | Flips status to 'expired' for tasks past `expiresAt` (24h after createdAt) |
| M6        | `writeAuditEvent`      | Firestore onWrite(task)                   | Append-only audit trail                                                    |
| M8        | `submitReport`         | HTTPS callable                            | Files a report; runs trust adjustment                                      |
| M8        | `adminAction`          | HTTPS callable (admin-only)               | Warning / suspend / ban                                                    |

## PII inventory

| Field                           | Source                                             | Storage                                           | Why collected              | Retention                                              |
| ------------------------------- | -------------------------------------------------- | ------------------------------------------------- | -------------------------- | ------------------------------------------------------ |
| Phone number                    | signup                                             | users/{uid}                                       | Auth + safety contact      | Until account deletion                                 |
| Email                           | signup                                             | users/{uid}                                       | Auth + comms               | Until account deletion                                 |
| Display name                    | profile                                            | users/{uid}                                       | Identity in app            | Until account deletion                                 |
| Profile photo URL               | profile                                            | Storage + users/{uid}                             | Identity in app (required) | Until account deletion                                 |
| ID image URL                    | profile (optional, required for Medium-risk tasks) | Storage (locked-down) + users/{uid}.idVerified    | Trust gate                 | Until account deletion                                 |
| Bio                             | profile                                            | users/{uid}                                       | Trust signal               | Until account deletion                                 |
| Location pin                    | task posting                                       | tasks/{id}.location                               | Matching                   | Until task purged (TBD policy)                         |
| Volunteer availability state    | toggle                                             | users/{uid}.availableNow                          | Matching                   | Live state                                             |
| Chat messages                   | post-acceptance                                    | chats/{id}/messages                               | Coordination               | Until task purged                                      |
| Customer rating + comment       | M6 (post-completion)                               | tasks/{id}.customerRating + customerRatingComment | Trust score signal         | Permanent; comment is not surfaced publicly in Phase 1 |
| Report content                  | M8                                                 | reports/{id}                                      | Safety adjudication        | Permanent (audit)                                      |
| T&C consent timestamp + version | signup                                             | users/{uid}.consent                               | Legal evidence             | Permanent                                              |

**Logging rules:** never log phone, email, OTPs, auth tokens, or precise coordinates.

## Trust Score Thresholds & Badges

- **Trusted**: `trustScore >= 85` (Emerald status chip/badge)
- **Reliable**: `60 <= trustScore < 85` (Amber status chip/badge)
- **Newcomer**: `trustScore < 60` (Neutral status chip/badge; defaults to 30 for new users)

## Trust Score Recompute Formula

The trust score is calculated server-side inside Cloud Functions. Each
positive component is normalised to `[0, 1]` _before_ its weight is applied,
so raw activity counts can't dominate the formula:

```
rawScore = 0.35 * min(1, verifiedTaskCount / 20)    // TASK_SATURATION = 20
         + 0.30 * scaledAvgRating
         + 0.15 * min(1, verifiedHours / 40)         // HOURS_SATURATION = 40
         + 0.10 * (idVerified ? 1 : 0)
         - reportPenalty                             // accumulated by adminAction (+0.15 warn, +0.25 suspend)

clampedScore = max(0.3, min(1.0, rawScore))
trustScore   = round(clampedScore * 100)             // stored 30..100 on user doc
```

- `scaledAvgRating`: average of ratings from this volunteer's completed tasks (1–5) divided by 5.0. If no tasks have been rated yet, defaults to `1.0` so newcomers aren't penalised on the rating component.
- Sum of positive weights = 0.90, so a maxed-out volunteer pegs at `trustScore = 90` (the `Trusted` threshold is 85). Saturation caps live in `recompute-trust-score.ts` as `TASK_SATURATION` / `HOURS_SATURATION`.
- `reportPenalty` is accumulated on the user doc by `applyModerationAction` (warn = +0.15, suspend = +0.25). Ban does not add penalty because the account is already blocked from matching.

## Points & Skill Points Awarding

On task completion, volunteers and customers receive:

- **Volunteer Points**: `10` base points + duration bonus (`+1` point per 15 minutes of estimated task duration, capped at `8` bonus points. Maximum `18` points total).
- **Volunteer Skill Points**: `+1` skill point for each required skill from the task, stored in `userDoc.skillPoints[skillKey]`.
- **Customer Points**: `2` points awarded on successful completion/verification of their task.

## Matching score formula

```
score(volunteer, task) =
    0.30 * distanceScore(volunteer.location, task.location)
  + 0.25 * skillMatch(volunteer.skills, task.requiredSkills)
  + 0.20 * trustScore(volunteer)
  + 0.15 * availabilityScore(volunteer.availableNow, recency)
  + 0.10 * pastCompletionScore(volunteer.verifiedTaskCount)
  − reportPenalty(volunteer.openReports, volunteer.warnings)
```

- **Skill match mode: OR.** Volunteer is eligible if at least one of their skills intersects `task.requiredSkills`. Partial-credit score:
  `skillMatch = |intersection(volunteer.skills, task.requiredSkills)| / |task.requiredSkills|` (range 0..1).
  Eligibility floor: candidates with 0 intersection are excluded from offer batches, but for reach we may include a small fraction (TBD) when the offer pool is otherwise empty.
- New volunteers (low verifiedTaskCount) must still be reachable: `pastCompletionScore` floors at a small positive value rather than 0.
- Tuning constants live in Cloud Function config, not the client.

## Dual-Role Experience Pattern

Users holding both `customer` and `volunteer` roles have a unified account with fluid, client-side role switching:

- **Active Role State (`use-active-role.ts`)**: Pure state hook resolving role preference from `localStorage` (`hey_padosi_active_role_${uid}`), falling back to user's first assigned role.
- **Header Switcher (`RoleSwitcher.tsx`)**: Segmented control rendered in the top bar for dual-role users (`[ 🛒 Need Help ] [ 🤝 Help Others ]`). Returns `null` for single-role users.
- **Cross-Role Awareness (`CrossRoleBanner.tsx`)**: Real-time Firestore listener alerting users on active tasks or broadcast requests in their opposite role without toggling `availableNow`.

## Trust & Safety UX Pattern

- **Standardized Badge Hierarchy**:
  - `🛡️ ID Verified` (`bg-emerald-50 text-emerald-800 border-emerald-200`): Displayed strictly when `userDoc.idVerified === true`.
  - `✓ Verified Neighbour` (`bg-[#e3efe9] text-[#1f6f5c] border-[#1f6f5c]/20`): Displayed when `userDoc.verifiedTaskCount > 0`.
  - `★ Skill Matched` (`bg-[#e8effb] text-[#1f4baa] border-[#1f4baa]/20`): Displayed when volunteer skills match task requirements.
- **Humanized Trust Score Tiers**:
  - `90–100`: Exceptional Community Trust
  - `70–89`: High Community Trust
  - `40–69`: Building Trust
  - `< 40`: Community Member
- **Accessible Trust Explainer (`HowTrustWorksModal`)**: Explains the 3 pillars (6-digit physical OTP handshake, mutual neighbour feedback, platform ID verification for sensitive tasks).
- **Consequence-Aware Blocking & Reporting**: Clear explanation of mutual matching exclusion and confidential safety team review prior to submission.
- **Account Moderation Banners**: Transparent in-app standing notices for warned (`accountStatus === 'warned'`) or suspended (`accountStatus === 'suspended'`) accounts.

## UI / UX patterns

- **Visual language:** Apple-style restraint — neutral palette (`#fafaf8`, `#ffffff`, `#ececea`, `#1f6f5c`, `#131312`, `#4f4b46`), generous whitespace, Inter + Outfit typography, purposeful motion only. WCAG 2.1 AA throughout.
- **Map screens (task post, nearby view):** full-bleed map with draggable pin + "use my location"; details surface in a bottom sheet.
- **Task lifecycle states:** Searching → Accepted → In Progress → Completed (ride-hail mental model).
- **Instructions/preferences inputs:** chips + toggles for category, skill, "what to bring"; minimal free text.
- **Chat:** opens after acceptance; report/block in the header; system messages on status transitions.
- **Availability toggle:** prominent, unmistakable ON/OFF.
