# 07 — Product Roadmap & Phase Plan

> **Purpose:** Turn research into a realistic staged plan. Detailed analysis is in Docs 01–06; this document focuses on decisions and execution.

**Context:** One primary developer using AI-assisted development. Phase 1 MVP is feature-complete (12/12 features, M0–M8). All code typechecks, lints, and builds clean. Runtime browser testing still pending for M7 (chat) and M8 (moderation).

---

## Phase 1 — Current MVP ✅ COMPLETE

**Status:** All 12 Phase 1 features implemented. Firestore rules compile. Functions build clean.

**What's verified:** Typecheck + lint + Vite build + Firestore rules compilation + emulator validation.

**What still needs runtime verification:**

- M7 chat lifecycle (accept → chat → start OTP → end OTP → read-only)
- M8 moderation (report → warn/suspend/ban → reassignment → purge)
- Chat reassignment (old conversation wipe + new volunteer gets fresh chat)

**No changes to Phase 1 scope.** All explicit out-of-scope items remain excluded.

---

## Phase 2 — Product Refinement (Pre-Beta)

**Objective:** Make the product ready for real users in a controlled environment.

**Timeline estimate:** 3–5 weeks

### Infrastructure (Week 1)

| Item                                                                                                                       | Gap Ref | Effort   |
| -------------------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| Upgrade to Firebase Blaze plan with budget alerts ($1/$5/$10)                                                              | G-02    | 1 day    |
| Enable Cloud Storage in Console (asia-south1)                                                                              | G-02    | 1 day    |
| Verify `firebase deploy --only storage,functions` succeeds                                                                 | G-02    | 1 day    |
| Enable real FCM push notifications (service worker, permission prompt, offer/status notifications)                         | G-01    | 3–4 days |
| Add Firebase Analytics event tracking (anonymised: signup, task_created, offer_accepted, task_completed, report_submitted) | G-07    | 2 days   |
| Password reset flow for email auth users                                                                                   | G-03    | 1 day    |

### UX Improvements (Weeks 2–3)

| Item                                                                       | UX Ref     | Effort   |
| -------------------------------------------------------------------------- | ---------- | -------- |
| Rich landing page (how-it-works, safety messaging, trust signals, CTA)     | G-04, UX-2 | 3–4 days |
| Custom web font (Inter or Outfit) for headings                             | UX-2       | 0.5 day  |
| Dual-role dashboard switching (tab/toggle)                                 | G-05, P1-2 | 2 days   |
| Trust badges on volunteer match cards (Newcomer/Reliable/Trusted)          | UX-1       | 1 day    |
| ID verification badge visible during matching                              | UX-1       | 0.5 day  |
| Back button on all inner pages                                             | UX-4       | 0.5 day  |
| Skeleton loading states (replace spinner with content-shaped placeholders) | UX-3       | 2 days   |
| Destructive button variant for report/block/ban actions                    | UX-5       | 0.5 day  |

### Feature Additions (Weeks 3–4)

| Item                                                            | Priority Ref | Effort   |
| --------------------------------------------------------------- | ------------ | -------- |
| Volunteer task browsing (nearby searching tasks, map/list view) | G-06, P1-3   | 3–4 days |
| Notification centre (persistent inbox, read/unread states)      | G-13, P1-4   | 2–3 days |
| Task creation preview before submission                         | UX-7         | 1 day    |
| Unread chat indicator on dashboard                              | UX-8         | 1 day    |

### Code Quality (Week 4–5)

| Item                                                                                | Effort |
| ----------------------------------------------------------------------------------- | ------ |
| Refactor `VolunteerDashboard.tsx` into smaller components                           | 2 days |
| Refactor `CustomerDashboard.tsx` into smaller components                            | 2 days |
| Extract shared design tokens (colours, spacing, shadows) into CSS custom properties | 1 day  |
| Semantic HTML cleanup in dashboards (headings, regions, landmarks)                  | 1 day  |
| Add `aria-live` regions for dynamic content                                         | 1 day  |

### Testing (Week 5)

| Item                                                                               | Effort |
| ---------------------------------------------------------------------------------- | ------ |
| Full runtime smoke test of all M0–M8 features in emulator                          | 2 days |
| Full runtime smoke test with Blaze deploy (real SMS, real Storage, real Functions) | 2 days |
| Real-device push notification verification                                         | 1 day  |
| E2E test expansion for critical paths (Playwright)                                 | 3 days |

### Exit Criteria for Phase 2

- [ ] Blaze plan active with budget alerts
- [ ] Cloud Storage and Functions deployed successfully
- [ ] Push notifications working on real devices
- [ ] Analytics events firing correctly
- [ ] Password reset verified
- [ ] Landing page live with safety messaging
- [ ] Dual-role switching works
- [ ] Trust badges visible during matching
- [ ] Volunteer task browsing functional
- [ ] All M0–M8 features runtime-verified
- [ ] Component refactor complete
- [ ] E2E tests passing for critical paths

---

## Phase 3 — Beta Optimisation

**Objective:** Onboard real users (campus or community pilot), learn from usage, and iterate.

**Timeline estimate:** 4–8 weeks

### Pre-Launch (Week 1)

| Item                                                                 | Effort            |
| -------------------------------------------------------------------- | ----------------- |
| Identify pilot community (campus or apartment complex)               | 1 week (parallel) |
| Create seed data for pilot community (real categories, local skills) | 1 day             |
| Review and update T&C text for legal accuracy                        | 1 day             |
| Review catalog categories and skills for pilot community relevance   | 1 day             |
| Prepare onboarding communication (how-to guides, FAQ)                | 2 days            |

### Launch & Observe (Weeks 2–4)

| Item                                                                  | Effort  |
| --------------------------------------------------------------------- | ------- |
| Onboard first 20–50 users in pilot community                          | Ongoing |
| Monitor analytics dashboards (signups, tasks, completions, drop-offs) | Ongoing |
| Monitor admin dashboard for reports and moderation needs              | Ongoing |
| Collect user feedback (informal + in-app)                             | Ongoing |

### Iterate Based on Feedback (Weeks 4–8)

Features to build ONLY if validated by real usage:

| Item                        | Priority Ref | Trigger                                            |
| --------------------------- | ------------ | -------------------------------------------------- |
| Chat image sharing          | P1-5         | Users report coordination difficulties             |
| Task editing pre-acceptance | P2-2         | Users frequently post incorrect tasks              |
| Email notification fallback | P2-1         | Users miss push notifications                      |
| Social login (Google/Apple) | P2-3         | Signup friction feedback                           |
| PWA install prompt          | P2-4         | Users ask "is there an app?"                       |
| Trail-based matching pilot  | EX-1         | Volunteers express interest in commute-based tasks |
| Completion summary screen   | UX-9         | Low post-task engagement                           |

### Exit Criteria for Phase 3

- [ ] 20+ active users in pilot community
- [ ] 10+ tasks completed end-to-end by real users
- [ ] Feedback collected and categorised
- [ ] Major UX issues identified and addressed
- [ ] Analytics show functional conversion funnel
- [ ] No critical safety incidents
- [ ] Moderation workload is manageable

---

## Phase 4 — Scale Preparation

**Objective:** Prepare infrastructure, operations, and safety for multi-community deployment.

**Timeline estimate:** 4–8 weeks

### Infrastructure

| Item                                                           | Effort    |
| -------------------------------------------------------------- | --------- |
| Matching scalability fix (multi-resolution H3 or GeoFirestore) | 1–2 weeks |
| Firestore cost monitoring and optimisation                     | 1 week    |
| Cloud Function cold-start optimisation                         | 1 week    |
| Rate limiting on all callables                                 | 2 days    |
| Abuse detection hardening (see `abuse-detector.ts`)            | 1 week    |

### Operations

| Item                                                                                    | Effort |
| --------------------------------------------------------------------------------------- | ------ |
| Automated moderation triggers (auto-escalation on report volume)                        | 1 week |
| Admin analytics dashboard (key metrics: DAU, tasks/day, completion rate, avg wait time) | 1 week |
| Error monitoring (Sentry or Firebase Crashlytics)                                       | 2 days |
| Automated backup for Firestore                                                          | 1 day  |

### Safety & Trust

| Item                                                      | Effort |
| --------------------------------------------------------- | ------ |
| Two-way rating (customers also get rated by volunteers)   | 1 week |
| Report outcome notifications (within privacy constraints) | 3 days |
| Safety messaging at key moments (pre-chat, pre-meeting)   | 2 days |
| Review trust score formula with real data                 | 1 week |

### Multi-Community

| Item                                     | Effort    |
| ---------------------------------------- | --------- |
| Community/neighbourhood grouping concept | 1–2 weeks |
| Catalog customisation per community      | 1 week    |
| Community-level analytics                | 1 week    |

### Exit Criteria for Phase 4

- [ ] Matching scales to 1000+ concurrent volunteers
- [ ] Rate limiting active on all callables
- [ ] Error monitoring in place
- [ ] Moderation partially automated
- [ ] Multi-community structure functional
- [ ] Cost trajectory understood and controlled

---

## Phase 5 — Production

**Objective:** Controlled production launch to multiple communities.

**Timeline estimate:** 2–4 weeks for launch preparation

### Pre-Production

| Item                                                             | Effort |
| ---------------------------------------------------------------- | ------ |
| Security audit (Firestore rules, Storage rules, callable inputs) | 1 week |
| Performance testing (load test matching, chat, offer dispatch)   | 1 week |
| Privacy compliance review (DPDP Act, data retention, consent)    | 1 week |
| Content review (all user-facing text, error messages, T&C)       | 3 days |
| Rollback plan and disaster recovery procedures                   | 2 days |

### Launch

| Item           | Description                             |
| -------------- | --------------------------------------- |
| Staged rollout | 1 community → 3 → 10                    |
| Monitoring     | Real-time dashboards + alert thresholds |
| Support        | Documented escalation process           |

### Exit Criteria for Phase 5

- [ ] Security audit passed
- [ ] Privacy compliance confirmed
- [ ] Performance tested at 10x current usage
- [ ] Staged rollout plan executed
- [ ] Monitoring and alerting operational
- [ ] Support process documented

---

## Parallelisable Work

The following can be done simultaneously:

```
Infrastructure (P0)  ─────────────────────────────────────►
UX improvements      ──────────────────────────►
Feature additions             ──────────────────────────►
Code quality                       ──────────────────►
Community pilot planning  ──────────────────────────────────────►
```

- Infrastructure work doesn't block UX work
- Component refactoring doesn't block feature additions
- Community pilot planning runs in parallel with all technical work

---

## Realistic Timeline Summary

| Phase                        | Duration  | Status                          |
| ---------------------------- | --------- | ------------------------------- |
| Phase 1 — MVP                | Complete  | ✅ Done                         |
| Phase 2 — Product Refinement | 3–5 weeks | **Next**                        |
| Phase 3 — Beta Optimisation  | 4–8 weeks | Starts after Phase 2            |
| Phase 4 — Scale Preparation  | 4–8 weeks | Overlaps with late Phase 3      |
| Phase 5 — Production         | 2–4 weeks | After Phase 4 exit criteria met |

**Total estimated timeline to controlled production:** 13–25 weeks (3–6 months) from today, accounting for one developer with AI assistance.

This is NOT a deadline. Speed matters less than getting the product right.

---

> **Note:** Feature decisions referenced in this roadmap are documented in Document 08 (Product Decision Register).
