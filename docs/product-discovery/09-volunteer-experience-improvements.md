# Hey Padosi — Volunteer Experience Refinements & Quality Spec

**Document Version:** 1.0.0  
**Phase:** Phase 1 Product Refinement  
**Scope:** Volunteer Experience Only  
**Target Quality Tier:** Production-Grade Hyperlocal Volunteer Journey (9+/10)

---

## 1. Executive Summary

Hey Padosi relies on voluntary neighbourhood participation. This refinement elevates the volunteer experience from functional MVP to a polished, calm, trustworthy, and actionable journey following the core principle:

> **LESS UI, BETTER HIERARCHY.**

All enhancements were achieved without modifying backend logic, Firestore schemas, Cloud Functions, matching algorithms, or security rules.

---

## 2. Problems Discovered vs Solutions Implemented

| # | UX Surface | Identified Problem | Solution Implemented |
|---|---|---|---|
| 1 | **Dashboard Hierarchy** | Stats hero card overpowered active missions and pending task offers. | Restructured hierarchy: Active tasks / urgent action at the very top, followed by pending offers, availability control, and secondary impact stats. |
| 2 | **Availability Control** | Vague toggle without clear reassurance on visibility or privacy. | Clear states: *"Available · Receiving nearby requests"* with *"🔒 Your exact location is never shared with requesters."* vs *"Offline · You won’t receive new requests"*. |
| 3 | **Offer Cards** | Exposed raw algorithmic scoring math (`Match score: 1.45`). | Removed all internal formula math; replaced with actionable human decision chips: `📍 0.8 km away`, `⏱️ ~30 mins`, `★ Matches your skill`, `🛡️ Verified ID Required`. |
| 4 | **Offer Action Clarity** | Accept and Decline buttons lacked clear commitment and loading states. | Clear, committed primary green `"Accept & Help"` button with busy state and subtle `"Decline"` button. |
| 5 | **Active Mission Cards** | Accepted and in-progress tasks lacked clear next physical actions. | Added plain-language guidance: `accepted` (*"Coordinate arrival in chat · Ask for Start Code on arrival"* + `"Open Chat & Details →"`), `in_progress` (*"Task underway · Ask for Completion Code when done"* + `"Enter Completion Code →"`). |
| 6 | **Volunteer OTP Verification** | Input had generic unstyled borders and wrong validation copy (`"Enter the 6-digit code..."`). | Corrected to **4-digit codes**, added high-contrast styled digit cells, and distinct Start vs Completion instructions. |
| 7 | **Impact & Trust Presentation** | Numbers were presented without context or explanation. | Highlighted `"Verified Neighbour"` badge, verified task count, active skills, and plain-language Trust Score context. |
| 8 | **Loading & Empty States** | Flashed blank/dashed boxes while connecting to Firestore. | Added zero-CLS skeleton loaders and warm empty state cards with reassuring guidance. |

---

## 3. Before → After Microcopy Reference

| Context | Before (MVP / Technical) | After (Refined 9+/10) |
|---|---|---|
| **Availability (ON)** | `Available right now` | `Available · Receiving nearby requests` + `🔒 Exact location is never shared` |
| **Availability (OFF)** | `Available right now (unchecked)` | `Offline · You won’t receive new requests` + `Turn on availability when you’re ready to help neighbours.` |
| **Offer Match Score** | `Match score: 1.45` | `📍 0.8 km away · ⏱️ ~30 mins · ★ Matches your skill · 🛡️ Verified ID Required` |
| **Offer Action** | `Accept` | `Accept & Help` |
| **Active Task (Accepted)** | `Accepted · Medium priority` | `Task Accepted` + `Coordinate arrival in chat. When you arrive, ask for Start Code.` |
| **Active Task (In Progress)**| `In progress · Medium priority`| `Task In Progress` + `Task is underway. When finished, ask for Completion Code.` |
| **OTP Entry Prompt** | `Enter the 6-digit code the customer showed you.` | `Enter Start / Completion Verification Code` + `Ask the customer for their 4-digit code.` |
| **Task Completed Reward** | `Task completed` | `Task verified & completed ✓` + `+12 pts Neighbourhood Karma awarded` |

---

## 4. Verification & Validation Records

- **Typecheck:** Passed (`npm run typecheck` — 0 errors).
- **Linter:** Passed (`npm run lint` — 0 errors/warnings).
- **Production Build:** Passed (`npm run build` — clean production build).
- **Backend Rules & Functions:** 100% untouched.

---

## 5. Summary of Files Modified

1. `src/components/VolunteerDashboard.tsx`: Complete hierarchy reorganization, humanized offer decision chips, availability privacy reassurance, and branded skeleton loading states.
2. `src/components/VolunteerOtpPanel.tsx`: Fixed 4-digit code handling, styled mono input cells, and friendly error recovery.
3. `src/pages/TaskDetailPage.tsx`: Synchronized 4-phase lifecycle tracker for volunteers with privacy reassurance and completed Karma reward summary.
