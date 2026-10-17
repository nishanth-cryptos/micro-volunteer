# Errors & Issues Log

> Append-only. Record known issues, gotchas, and resolved bugs.

---

### E-001 — Corridor Matching is a Stub

`scoring.ts:rankForCorridor()` accepts a set of corridor H3 cells but the filter is a passthrough (`return true`). The data model and types exist in `trail-service/types.ts` but the actual corridor-based task filtering is not implemented.

**Status**: Known limitation (Phase 1).

---

### E-002 — Availability Component Always 1.0

In `scoring.ts:score()`, the `availability` component is hardcoded to `1.0`. The matching formula assigns 0.15 weight to it, but no actual availability signal (e.g., time-of-day, recency of availability toggle) is factored in.

**Status**: Known limitation.

---

### E-003 — Large Dashboard Components

`CustomerDashboard.tsx` (~76 KB) and `VolunteerDashboard.tsx` (~103 KB) are monolithic files containing many embedded sub-views. These should eventually be decomposed into smaller components for maintainability, but they are functional as-is.

**Status**: Technical debt, not blocking.

---

### E-004 — Firebase Export Directories Accumulate

Multiple `firebase-export-*` directories exist in the project root from emulator sessions. These are not gitignored (though they should not be committed). Periodically clean up stale exports.

**Status**: Housekeeping.

---

### E-005 — No Push Notifications

The app has no FCM integration. When a volunteer receives an offer, they only see it if they have the app open. Same for chat messages, task status changes, etc. Notification delivery relies on the user polling (opening the app).

**Status**: Known limitation (Phase 1 out of scope).
