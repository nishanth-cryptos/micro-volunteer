# Hey Padosi — Admin & Safety Console Refinement Spec

**Document Version:** 1.0.0  
**Phase:** Phase 1 Product Refinement  
**Scope:** Admin & Safety Experience Only  
**Target Quality Tier:** Production-Grade Safety & Moderation Console (9+/10)

---

## 1. Executive Summary

Hey Padosi is a safety-first hyperlocal platform. The Admin Console is the operational nerve center for safety triage, report resolution, user moderation, and auditability. This refinement transforms the Admin Console from an MVP interface into a serious, trustworthy, consequence-aware moderation environment adhering to the core principle:

> **LESS UI, BETTER DECISIONS.**

All enhancements are built on 100% verified, real data sources from Firestore and server-authoritative Cloud Functions (`applyModerationAction`). Zero fake metrics or unbacked functionality are exposed.

---

## 2. Architecture & Data-Source Mapping

| Admin Feature | Backend Data Source | Query / Callable Function | Authorization Rule | Implementation Status |
|---|---|---|---|---|
| **Overview: Safety Queue Count** | `reports` | `query(reports, where('status'=='pending'))` | `isAdmin()` in `firestore.rules` | **IMPLEMENTED** |
| **Overview: Completed Missions** | `tasks` | `query(tasks, where('status'=='completed'))` | `isSignedIn()` in `firestore.rules` | **IMPLEMENTED** |
| **Overview: Community Members** | `users` | `query(users)` | `isAdmin()` in `firestore.rules` | **IMPLEMENTED** |
| **Report Queue & Triage** | `reports`, `users`, `tasks` | `onSnapshot(query(reports, where('status'=='pending')))` | `isAdmin()` in `firestore.rules` | **IMPLEMENTED** |
| **Moderation Actions (Warn/Suspend/Ban/Dismiss)** | Cloud Functions | `applyModerationAction({ userId, action, reason, durationDays?, reportId? })` | Server-verified `isAdmin == true` | **IMPLEMENTED** |
| **User Safety Standing & History** | `users/{uid}`, `users/{uid}/moderationLog` | `getDoc(users/uid)` + `query(moderationLog)` | `isAdmin()` in `firestore.rules` | **IMPLEMENTED** |
| **Task Lifecycle & Audit Events** | `tasks/{taskId}/events` | `query(events, orderBy('at', 'asc'))` | `isAdmin()` in `firestore.rules` | **IMPLEMENTED** |
| **Platform Activity Stream** | `activityLog` | `query(activityLog, orderBy('createdAt', 'desc'), limit(50))` | `isAdmin()` in `firestore.rules` | **IMPLEMENTED** |
| **Observability / Infrastructure Health** | GCP Cloud Logging / Sentry | None in Firestore | GCP IAM | **DEFERRED** *(Zero fake dials rendered)* |

---

## 3. Problems Discovered vs Solutions Implemented

| # | UX Surface | Identified Problem | Solution Implemented |
|---|---|---|---|
| 1 | **Overview Triage** | Generic statistics dominated without answering *"Does anything need my attention right now?"*. | Action-first summary cards: Pending safety reports highlighted with active status badge (`"Review needed"` vs `"Queue clear ✓"`), 1-click navigation to queue. |
| 2 | **Branding & Visual Consistency** | Generic Tailwind grays did not match Hey Padosi's design tokens. | Branded design tokens (`#fafaf8`, `#ffffff`, `#ececea`, `#1f6f5c`, `#131312`, `#4f4b46`, Inter, Outfit) with information-dense, high-clarity moderation cards. |
| 3 | **Report Review Experience** | Confusing display without clear distinction of who reported whom and incident context. | Structured report cards with reporter role pill (`Customer · Name` / `Volunteer · Name`), reported party standing, reason tag, unique reporter count, and direct task link. |
| 4 | **Moderation Action Clarity** | Dangerous actions were easy to trigger without understanding operational consequences. | Consequence-clear modal: Mandatory reason (≥ 10 chars), duration selector with auto-calculated return timestamp, and explicit consequence callout box. |
| 5 | **Account Reinstatement** | Used basic browser `window.prompt()` for unbanning/unsuspending. | Styled React reinstatement modal requiring an administrative reason logged to permanent audit records. |
| 6 | **Task Audit Trail** | Rendered raw unparsed JSON blocks. | Formatted lifecycle timeline with numbered chronological steps, actor role badges (`Customer`, `Volunteer`, `Admin`, `System`), and clean metadata accordions. |
| 7 | **Activity Log Stream** | Lack of event categorization. | Category filter dropdown (`Task Created`, `Offer Accepted`, `Report Submitted`, `Moderation Action`, etc.) with paginated query loading. |
| 8 | **Empty & Loading States** | Blank or dashed boxes while loading. | Zero-CLS skeleton loaders and reassuring empty state cards. |

---

## 4. Verification & Validation Records

- **Typecheck:** Passed (`npm run typecheck` — 0 errors).
- **Linter:** Passed (`npm run lint` — 0 warnings/errors).
- **Production Build:** Passed (`npm run build` — compiled cleanly).
- **Backend Rules & Functions:** 100% untouched.

---

## 5. Summary of Files Modified

1. `src/pages/AdminDashboard.tsx`: Complete action-first redesign with consequence-clear moderation, structured safety lookup, humanized task audit trail, and activity stream filtering.
2. `docs/product-discovery/10-admin-experience-improvements.md`: Created comprehensive admin experience refinement documentation.
