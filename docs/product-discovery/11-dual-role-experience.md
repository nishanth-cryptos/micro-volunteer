# Hey Padosi — Dual-Role (Customer + Volunteer) Experience Refinement Spec

**Document Version:** 1.0.0  
**Phase:** Phase 1 Product Refinement  
**Scope:** Dual-Role Experience (Customer + Volunteer)  
**Target Quality Tier:** Unified Account & Seamless Role Switching (9+/10)

---

## 1. Executive Summary

Hey Padosi is designed to foster neighbourhood solidarity where members can naturally ask for assistance when needed and volunteer their time and skills when available. Previously, dual-role users (who selected `"Both — Ask & Help"` during onboarding) were permanently locked into the Customer Dashboard due to a hardcoded role precedence check in `AppHomePage.tsx`.

This refinement unifies the dual-role experience under one cohesive Hey Padosi account, providing:
1. **Instant, Zero-Reload Role Switching:** Seamless toggling between **"Need Help" (Customer)** and **"Help Others" (Volunteer)**.
2. **Persistent Active Choice:** Role preference saved in `localStorage` keyed by UID, surviving page refreshes and direct navigations.
3. **Cross-Role Awareness:** Non-intrusive, real-time indicators alerting users of active tasks, pending offers, or broadcast availability in their opposite role.
4. **Availability Safety:** Switching from Volunteer to Customer mode does not silently disable volunteer availability; instead, users are kept aware of their live volunteer status.
5. **Zero UI Noise for Single-Role Users:** Single-role accounts (Customer-only or Volunteer-only) experience zero visual clutter—the switcher and cross-role banners render `null`.

---

## 2. Architecture & Data-Source Mapping

| Feature | Data Source | Query / State | Authorization Rule | Status |
|---|---|---|---|---|
| **Active Role Selection & Persistence** | `userDoc.roles` + `localStorage` (`hey_padosi_active_role_${uid}`) | `useActiveRole(uid, userDoc)` | Owner session | **IMPLEMENTED** |
| **Role Switcher Control** | `userDoc.roles` (`['volunteer', 'customer']`) | `RoleSwitcher.tsx` in Header | Rendered only when `isDualRole === true` | **IMPLEMENTED** |
| **Cross-Role Awareness (Volunteer Activity)** | `tasks` collection | `query(tasks, where('acceptedVolunteerId'=='uid'), where('status' in ['accepted', 'in_progress']))` | `isSignedIn()` in `firestore.rules` | **IMPLEMENTED** |
| **Cross-Role Awareness (Customer Requests)** | `tasks` collection | `query(tasks, where('customerId'=='uid'), where('status' in ['searching', 'accepted', 'in_progress']))` | `isSignedIn()` in `firestore.rules` | **IMPLEMENTED** |
| **Availability Preservation** | `userDoc.availableNow` | Unmutated during role switch; live status reminder chip | `isOwner(uid)` in `firestore.rules` | **IMPLEMENTED** |
| **Route Security & Navigation** | `userDoc.roles` in `ProtectedRoute` | `router.tsx`, `CreateTaskPage.tsx` | Server-authoritative | **IMPLEMENTED** |

---

## 3. Problems Discovered vs Solutions Implemented

| # | UX Surface | Identified Problem | Solution Implemented |
|---|---|---|---|
| 1 | **Role Precedence Bug** | `AppHomePage.tsx` hardcoded `if (userDoc.roles.includes('customer')) return <CustomerDashboard>` locking dual-role users out of the Volunteer experience. | Implemented `useActiveRole` hook that checks `localStorage` and routes dynamically to the active dashboard. |
| 2 | **Role Switching Mechanism** | No UI existed to toggle roles without signing out. | Created `<RoleSwitcher />` segmented pill in the top header (`[ 🛒 Need Help ] [ 🤝 Help Others ]`) with smooth in-memory switching. |
| 3 | **Activity Blindspots** | Dual-role users in Customer mode had no awareness of ongoing volunteer tasks or live availability. | Created `<CrossRoleBanner />` subscribing in real time to opposite-role active tasks (`"🤝 You have 1 active mission as Volunteer · Switch to Help Others →"`). |
| 4 | **Volunteer Availability Safety** | Risk of unexpected background state changes when switching views. | Switching roles preserves `userDoc.availableNow` completely and displays a gentle reminder badge (`"🟢 Available to receive volunteer requests"`). |
| 5 | **Single-Role Clutter** | Risk of adding unnecessary switches for single-role users. | Guarded with `if (!isDualRole) return null;` so Customer-only and Volunteer-only users see a clean single-purpose dashboard. |

---

## 4. Verification & Validation Records

- **Typecheck:** Passed (`npm run typecheck` — 0 errors).
- **Linter:** Passed (`npm run lint` — 0 warnings/errors).
- **Production Build:** Passed (`npm run build` — clean bundle).
- **Zero Backend / Security Rule Modifications:** 100% untouched.

---

## 5. Summary of Files Created & Modified

1. `src/lib/use-active-role.ts` [NEW]: Hook managing dual-role state, fallback logic, and `localStorage` synchronization.
2. `src/components/RoleSwitcher.tsx` [NEW]: Accessible segmented control component for switching roles.
3. `src/components/CrossRoleBanner.tsx` [NEW]: Real-time cross-role activity awareness banner.
4. `src/pages/AppHomePage.tsx`: Integrated `useActiveRole` to dynamically render Customer vs Volunteer dashboards.
5. `src/components/CustomerDashboard.tsx`: Integrated `RoleSwitcher` in `TopBar` and `CrossRoleBanner` below header.
6. `src/components/VolunteerDashboard.tsx`: Integrated `RoleSwitcher` in `TopBar` and `CrossRoleBanner` below header.
