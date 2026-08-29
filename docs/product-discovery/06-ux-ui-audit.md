# 06 — UX/UI Audit & Redesign Direction

> **Purpose:** Analyse how the current interface can become significantly better. Feature strategy is in Doc 05; this focuses on UX/UI specifically.

---

## 1. Visual Design Audit

### Colour Palette
- **Current:** `#fafaf8` background, `#1f6f5c` emerald accent, `#ececea` borders, `#131312` text, `#4f4b46` secondary text
- **Assessment:** ✅ Cohesive, warm, distinctive. The emerald green is memorable and maps to the "green/community" brand identity. Not generic.
- **Issue:** The palette lacks a secondary accent for warnings, errors, or information hierarchy beyond green. Error states may blend with the neutral palette.
- **Recommendation:** Add a subtle warm red for errors (`#d94540`), amber for warnings (`#e5a100`), and a soft blue for informational states (`#3b82f6`).

### Typography
- **Current:** System fonts via Tailwind defaults. No custom web font loaded.
- **Assessment:** ⚠️ Functional but generic. The product's visual identity ends where the typography begins. System fonts vary across devices.
- **Recommendation:** Add a single Google Font (Inter or Outfit) for headings. Keep system fonts for body text (performance). This single change would significantly elevate perceived quality.

### Spacing & Layout
- **Current:** Tailwind utility classes, `max-w-3xl` content containers, responsive padding
- **Assessment:** ✅ Generally good. The dashboards use gradient hero cards with generous spacing.
- **Issue:** Some views (admin dashboard, task detail) are dense with information. The monolithic dashboard components make it hard to achieve consistent spacing patterns.
- **Recommendation:** Extract shared spacing tokens into CSS custom properties for consistency.

### Cards & Containers
- **Current:** `rounded-2xl border border-[#ececea] bg-white` pattern used consistently
- **Assessment:** ✅ Clean card pattern. Consistent across customer and volunteer dashboards.
- **Issue:** Cards lack elevation/shadow hierarchy to distinguish interactive from static elements.
- **Recommendation:** Add subtle `shadow-sm` to interactive cards; keep flat for static information cards.

### Buttons
- **Current:** `rounded-full` pill buttons with emerald background and white text; secondary buttons with border
- **Assessment:** ✅ Distinctive pill shape is on-brand. Primary/secondary hierarchy is clear.
- **Issue:** Destructive actions (report, block, ban) don't have distinct visual treatment.
- **Recommendation:** Add a destructive button variant with red tones for safety-critical actions.

### Iconography
- **Current:** Inline SVGs (heart logo, check marks); `SkillIcon.tsx` with 25 custom skill SVGs
- **Assessment:** ✅ Skill icons are well-crafted. The heart logo in the header is distinctive.
- **Issue:** No consistent icon library for navigation, actions, or status indicators. Each component hand-codes its own SVGs.
- **Recommendation:** Adopt a lightweight icon set (Lucide React or Heroicons) for consistency. Keep the custom skill icons.

### Visual Consistency
- **Assessment:** ⚠️ Customer dashboard and volunteer dashboard have been independently themed. The customer view went through two design passes (Claude Design handoffs) while the volunteer view was rebuilt to match. Some inconsistency remains in how cards, headers, and navigation are styled between the two views.
- **Recommendation:** Extract shared design tokens and component patterns. The two dashboards should feel like the same app.

---

## 2. Information Architecture Audit

### Navigation
- **Current:** Bottom navigation pill (Dashboard / Profile tabs) on both dashboards. Top header with brand logo. React Router for page navigation.
- **Assessment:** ✅ Bottom nav is mobile-appropriate. Two-tab simplicity is correct for MVP.
- **Issues:**
  - No global navigation beyond the dashboard tabs
  - No back button or breadcrumbs on inner pages (task detail, create task)
  - Admin dashboard uses a separate tab system (4 tabs) that feels disconnected from the main app
  - `YourRoutesPage` exists but is accessible only by direct URL — no navigation link
- **Recommendations:**
  - Add a consistent back/close button on all inner pages
  - Consider a 3-tab bottom nav: Dashboard / Activity / Profile
  - Make trail routes accessible from profile or a settings sub-page

### Screen Hierarchy
- **Current:**
  ```
  Landing → Auth → Onboarding (4 steps) → Dashboard
                                           ├── Create Task
                                           ├── Task Detail
                                           ├── Your Routes
                                           └── Admin Dashboard
  ```
- **Assessment:** ✅ Simple and appropriate for MVP. The onboarding funnel is well-guarded.
- **Issue:** Flat hierarchy — no nesting beyond one level. Works for now but will strain as features grow.

### Discoverability
- **Issues:**
  - Volunteer task browsing doesn't exist (see Gap G-06)
  - Nearby tasks section on volunteer dashboard exists but is limited
  - No search or filter capabilities
  - Trail service features are hidden (no navigation to `/your-routes`)
  - Blocked users list is buried in the dashboard

### Cognitive Load
- **Assessment:** ⚠️ The monolithic dashboards pack too much information into single scrolling views. The volunteer dashboard contains: hero stats, skill points, availability toggle, departure prompt, offer inbox, nearby tasks, accepted tasks, blocked users, profile, and sign out.
- **Recommendation:** Consider progressive disclosure — show summary cards that expand on tap rather than rendering everything at once.

---

## 3. User Journey Audit

### Onboarding (Rating: ✅ Good)
- Progressive 4-step flow is well-designed
- Step guard prevents skipping ahead
- Skill selection card grid is visually appealing
- **Issue:** No progress persistence — if the user closes the browser mid-onboarding, they restart from the current step (though existing data is preserved in Firestore)
- **Issue:** The consent page text content should be reviewed for readability and legal accuracy

### Profile Creation (Rating: ✅ Good)
- Required photo upload is appropriate for a trust platform
- Optional ID image with clear explanation
- Bio field is optional, reducing friction
- **Issue:** No image cropping — users upload raw photos
- **Issue:** No preview of how their profile appears to others

### Becoming Available (Rating: ✅ Excellent)
- Prominent toggle with clear ON/OFF state
- Geolocation triggered on toggle (with permission prompt)
- Status text feedback
- **Issue:** No indication of what "available" means in practice (how far, what tasks)

### Posting a Task (Rating: ✅ Good)
- Structured form reduces ambiguity
- Progress strip gives completion feedback
- Map location picker works well
- Chip-based category and skill selection is intuitive
- **Issue:** No preview before submission
- **Issue:** Risk level is auto-derived but not explained to the customer
- **Issue:** No indication of volunteer availability near the chosen location

### Waiting for Volunteers (Rating: ✅ Excellent)
- Radar visualization is engaging and informative
- Live stats (volunteers reached, radius, timer) reduce anxiety
- Blip animation for arriving offers is satisfying
- **Issue:** No ETA guidance ("typical wait time for this category")
- **Issue:** No option to boost/expand radius manually

### Accepting an Offer (Rating: ✅ Good)
- Score breakdown chips (distance, skill, trust) are informative
- Accept/reject buttons are clear
- **Issue:** Volunteer profile information is limited (no trust badge visible on match card)
- **Issue:** No way to compare multiple offers side-by-side

### Chat (Rating: ✅ Good)
- Opens automatically after acceptance
- System messages provide context
- Report/block available in header
- Per-message reporting is well-implemented
- **Issue:** No unread message indicator on dashboard
- **Issue:** No typing indicator (acceptable omission)
- **Issue:** Text-only limits coordination usefulness

### Starting a Task (Rating: ✅ Good)
- OTP flip-cell reveal is engaging
- Clear explanation of verbal handoff process
- Timer countdown provides urgency
- **Issue:** No confirmation step before generating OTP

### Completing a Task (Rating: ✅ Good)
- Same OTP flow for consistency
- Points displayed on completion
- Rating prompt appears naturally
- **Issue:** No summary of what happened (duration, skill points earned)

### Rating (Rating: ✅ Acceptable)
- 1–5 star rating with optional comment
- **Issue:** No guidance on what each star level means
- **Issue:** No two-way rating (customer doesn't get rated)

### Reporting (Rating: ✅ Good)
- 5 canonical reasons with detail text field
- Reason bottom sheet is well-designed
- Already-reported state handled gracefully
- **Issue:** No feedback on report outcome (user never learns what happened)
- **Issue:** Reporting window (24h post-completion) not clearly communicated

### Blocked/Suspended States (Rating: ✅ Excellent)
- Full-screen interceptors are unmistakable
- Clear moderation reason displayed
- Account freeze acknowledgment flow is thoughtful
- Sign-out available even when blocked

---

## 4. UX States Audit

| State | Customer View | Volunteer View | Assessment |
|---|---|---|---|
| **Loading** | Full-screen spinner | Full-screen spinner | ⚠️ Generic; no skeleton loading |
| **Empty (no tasks)** | "Post your first task" prompt | "No offers right now" message | ✅ Handled |
| **Empty (no offers)** | N/A | "No offers for you right now" | ✅ Handled |
| **Error (generic)** | Toast or inline error | Toast or inline error | ⚠️ Some errors are not user-friendly |
| **Error (database)** | `DatabaseErrorScreen` | `DatabaseErrorScreen` | ✅ Dedicated error screen |
| **Success** | Karma toast, green feedback | Karma toast | ✅ Animated feedback |
| **Offline** | No handling | No handling | ❌ Missing |
| **Permission denied** | Generic error | Generic error | ⚠️ No specific message |
| **No matches (expanded)** | Radar keeps searching | N/A | ⚠️ No timeout guidance |
| **Expired task** | Status badge visible | Removed from inbox | ✅ Handled |
| **Reassignment** | Notice banner | Redirect + toast | ✅ Handled |
| **Blocked user** | Chat disabled | Chat disabled | ✅ Handled |
| **Suspended** | Full-screen with reason | Full-screen with reason | ✅ Excellent |
| **Banned** | Full-screen with reason | Full-screen with reason | ✅ Excellent |

---

## 5. Responsive/Mobile UX Audit

- **Layout:** Mobile-first with responsive breakpoints. `max-w-3xl` container works on both phone and desktop.
- **Dashboard:** The gradient hero + cards layout scales well. Bottom nav pill is mobile-appropriate.
- **Map:** Full-bleed map on task creation works on mobile. Touch-drag for pin repositioning works.
- **Forms:** Task creation form is scrollable and functional on mobile.
- **Tables:** Admin dashboard tables may require horizontal scrolling on mobile — not ideal but acceptable for admin-only views.
- **Assessment:** ✅ Good overall. The design was built mobile-first and works well on phones.
- **Issue:** Desktop layout underutilises space — same narrow content on a wide screen. Consider a sidebar navigation for desktop.

---

## 6. Accessibility Audit (WCAG 2.1 AA Principles)

### Perceivable
- ✅ `prefers-reduced-motion` is respected for all `vc-*` animations
- ⚠️ No `aria-live` regions for dynamic content updates (offer count changes, chat messages)
- ⚠️ Map interactions may not be keyboard-accessible
- ⚠️ No skip navigation link

### Operable
- ✅ Headless UI used for accessible tab/disclosure primitives
- ✅ `focus-visible` ring styles on all buttons
- ⚠️ Keyboard navigation through the dashboard may skip sections
- ⚠️ OTP input is likely not optimised for screen readers

### Understandable
- ✅ Error messages are provided on form validation
- ⚠️ Trust score, risk level, and matching formula are not explained to users
- ⚠️ Some action consequences are unclear (what happens when I block someone?)

### Robust
- ✅ ESLint jsx-a11y plugin enforces basic accessibility rules
- ✅ Semantic HTML used in most places
- ⚠️ Some `div` soup in dashboard components could use more semantic elements

---

## 7. Motion & Animation Audit

### Current Animation System
- `vc-screen-enter`: 0.32s fade-up for screen transitions
- `vc-fade-in/up`: 0.4s content reveals
- `vc-shimmer`: Progress bar shimmer effect
- `vc-check-pop`: Bouncy checkmark on verification
- `vc-radar-ping/halo`: Searching visualization
- `vc-blip-in`: Volunteer blip appearance
- `vc-cell-flip`: OTP digit reveal
- `vc-dot-bounce`: Chat typing indicator dots

### Assessment
- ✅ **Purposeful motion** — every animation communicates status or provides feedback
- ✅ **Performance** — all animations use CSS transforms and opacity (GPU-accelerated)
- ✅ **Accessibility** — all disabled under `prefers-reduced-motion: reduce`
- ✅ **Duration** — all ≤ 0.55s (fast, not distracting)
- **Verdict:** The animation system is one of the product's UX strengths. Do not add more animations without clear purpose.

---

## 8. Trust UX Audit

| Trust Signal | Current Implementation | Assessment |
|---|---|---|
| **Who is this person?** | Name + photo on match cards, chat header | ⚠️ Minimal — no bio, no trust badge on match |
| **How trustworthy are they?** | Trust score badges in volunteer stats panel | ⚠️ Not visible to customers during matching |
| **Are they verified?** | `idVerified` flag exists but no visible badge on volunteer cards | ❌ Verification is invisible to requesters |
| **Is this task safe?** | Risk level auto-derived; shown as badge | ⚠️ Not explained to users |
| **What's the task status?** | Live status with visual indicators | ✅ Excellent |
| **What happens next?** | System messages in chat; OTP flow guidance | ✅ Good |
| **Can I get help?** | Report/block available | ⚠️ No "how to report" guidance; no help centre |

### Trust UX Priorities
1. **Show trust badges on match cards** — customers should see Newcomer/Reliable/Trusted before accepting
2. **Show ID verification status** — "ID Verified" badge visible during matching
3. **Explain risk levels** — tooltip or info text explaining what Low/Medium means
4. **Add safety messaging** — brief safety tips at key moments (pre-chat, pre-meeting)
5. **Report outcome feedback** — tell reporters what happened with their report (within privacy limits)

---

## 9. UX Priorities (Highest Impact)

| # | Priority | Type | Impact | Effort |
|---|---|---|---|---|
| UX-1 | **Trust badges on volunteer match cards** | Trust UX | High — customers make safer decisions | Low |
| UX-2 | **Custom web font for headings** | Visual design | Medium — significantly elevates perceived quality | Very low |
| UX-3 | **Skeleton loading states** | UX states | Medium — reduces perceived latency | Low |
| UX-4 | **Back button on all inner pages** | Navigation | Medium — reduces user disorientation | Very low |
| UX-5 | **Destructive action button variant** | Visual design | Medium — safety-critical actions need visual weight | Very low |
| UX-6 | **Dashboard section progressive disclosure** | Information architecture | High — reduces cognitive overload | Medium |
| UX-7 | **Task creation preview** | User journey | Medium — reduces errors and buyer's regret | Low |
| UX-8 | **Unread chat indicator** | User journey | Medium — users know when they have messages | Low |
| UX-9 | **Completion summary screen** | User journey | Low — satisfying closure for the task lifecycle | Low |
| UX-10 | **Semantic HTML cleanup in dashboards** | Accessibility | Medium — screen reader experience | Medium |

---

> **Note:** These UX improvements are incorporated into the roadmap in Document 07 alongside feature work.
