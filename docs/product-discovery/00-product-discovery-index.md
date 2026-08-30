# 00 — Product Discovery Index

> **Hey Padosi — Product Discovery Summary**
> Completed: 2026-08-29
> Status: Phase 1 Complete → Product Discovery → UX/Product Refinement → Beta → Production

---

## 1. Current Product Status

Hey Padosi is a **feature-complete Phase 1 MVP** — a verified hyperlocal micro-volunteering web app where requesters post safe tasks and nearby volunteers are matched by location, skills, trust, and availability. All 12 Phase 1 features (auth, roles, profiles, availability, task posting, risk classification, H3 matching, volunteer ranking, offer dispatch, chat, OTP verification, points/trust/safety/admin) are implemented, typechecked, linted, and built. Runtime browser testing remains pending for chat and moderation flows. **Not production-ready** (requires Blaze upgrade for Storage, Functions, and FCM).

---

## 2. Key Competitive Finding

**No platform occupies Hey Padosi's exact position.** TaskRabbit has the task lifecycle but is paid-only and US-focused. Urban Company has the trust model but is professional-services-only. Nextdoor has the neighbourhood network but no structured task system. VolunteerMatch has the volunteer matching but no real-time dispatch, safety verification, or trust scoring. **The intersection of safety-first + verified identity + volunteer micro-tasks + hyperlocal matching is genuinely unoccupied.**

---

## 3. Top 5 Strengths

| #   | Strength                                                                                                                    | Ref           |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | **Comprehensive safety architecture** (risk classification, OTP verification, immutable audit trail, deny-by-default rules) | S1, Doc 01 §8 |
| 2   | **Server-authoritative trust model** (5-component score, server-only writes, transparent formula)                           | S3, Doc 01 §9 |
| 3   | **Unique dual-role model** (user is both requester and volunteer)                                                           | S2, Doc 01 §4 |
| 4   | **Innovative trail-based matching** (commute corridor task suggestions — no competitor has this)                            | S5, Doc 01 §6 |
| 5   | **Structured task creation** (4-field instructions, chip-based categories, auto-derived risk)                               | S6, Doc 01 §6 |

---

## 4. Top 5 Weaknesses

| #   | Weakness                                                                               | Ref           |
| --- | -------------------------------------------------------------------------------------- | ------------- |
| 1   | **No production infrastructure** (Storage, Functions, FCM all emulator-only)           | W1–W2, Doc 04 |
| 2   | **Minimal landing page** (no value proposition, no trust signals, no social proof)     | W4, G-04      |
| 3   | **Dual-role model is inaccessible** (no switching between customer/volunteer views)    | W6, G-05      |
| 4   | **Volunteers are passive** (no task browsing; entirely dependent on dispatched offers) | W5, G-06      |
| 5   | **No analytics** (can't measure what you can't see)                                    | W8, G-07      |

---

## 5. Top 5 Market Opportunities

| #   | Opportunity                                                                                                   | Ref      |
| --- | ------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Campus/apartment community launch** — dense communities solve cold-start                                    | O1, EX-2 |
| 2   | **India's gap in verified peer-to-peer volunteer tasks** — no Indian platform combines this                   | O2       |
| 3   | **Skill development narrative** — volunteering as resume-building for students                                | O3       |
| 4   | **Volunteer credential portability** — trust scores as portable proof of service                              | O9, EX-3 |
| 5   | **Safety-first brand in a trust-deficit market** — India's informal service sector lacks trust infrastructure | O7       |

---

## 6. Top 5 Product Gaps

| #   | Gap                                          | Priority            |
| --- | -------------------------------------------- | ------------------- |
| 1   | No push notifications (FCM emulator-only)    | **Critical** — G-01 |
| 2   | No production Cloud Storage (Blaze required) | **Critical** — G-02 |
| 3   | Password reset missing for email auth users  | **Critical** — G-03 |
| 4   | Landing page lacks substance                 | **High** — G-04     |
| 5   | Dual-role switching not implemented          | **High** — G-05     |

---

## 7. Top Recommended Features (Phase 2)

| Feature                                   | Priority | Effort   |
| ----------------------------------------- | -------- | -------- |
| Blaze upgrade + production infrastructure | P0       | 3 days   |
| Real FCM push notifications               | P0       | 3–4 days |
| Password reset flow                       | P0       | 1 day    |
| Product analytics foundation              | P0       | 2 days   |
| Rich landing page                         | P1       | 3–4 days |
| Dual-role dashboard switching             | P1       | 2 days   |
| Volunteer task browsing                   | P1       | 3–4 days |
| Trust badges on match cards               | P1 (UX)  | 1 day    |

---

## 8. Top UX Priorities

| #   | Priority                                            | Doc Ref         |
| --- | --------------------------------------------------- | --------------- |
| 1   | Trust badges visible during volunteer matching      | UX-1, Doc 06 §8 |
| 2   | Custom web font for headings (Inter or Outfit)      | UX-2, Doc 06 §1 |
| 3   | Skeleton loading states                             | UX-3, Doc 06 §4 |
| 4   | Back navigation on inner pages                      | UX-4, Doc 06 §2 |
| 5   | Dashboard component refactoring for maintainability | Doc 06 §2       |

---

## 9. Recommended Next Phase

**Phase 2: Product Refinement (3–5 weeks)**

Priority order:

1. Infrastructure: Blaze + Storage + FCM + Analytics + Password Reset
2. UX: Landing page + Dual-role switch + Trust badges + Skeleton loading + Back nav + Font
3. Features: Volunteer browsing + Notification centre
4. Code: Dashboard refactoring + Design tokens + Accessibility

See [07-product-roadmap.md](./07-product-roadmap.md) for the detailed plan.

---

## 10. Major Features Deliberately Rejected/Deferred

### Rejected (Do Not Build)

- Payment system — volunteer model is the differentiator
- Gamification/leaderboards — reduces volunteering to competition
- Social feed — not a social network; adds moderation burden
- AI/LLM content review — no scale to justify cost
- Aadhaar verification — regulatory complexity
- Cafe voucher rewards — requires merchant partnerships

### Deferred (Build Later If Validated)

- Chat image sharing — wait for coordination complaints
- Email notifications — try push first
- Social login — measure signup friction first
- Trail-based commute matching — needs opt-in pilot
- Two-way rating — single-direction sufficient for trust score
- Matching scalability fix — current cap is fine for beta

---

## 11. Recommended Roadmap

```
Phase 1 — MVP                          ✅ COMPLETE
Phase 2 — Product Refinement           3–5 weeks    ← START HERE
Phase 3 — Beta Optimisation            4–8 weeks
Phase 4 — Scale Preparation            4–8 weeks
Phase 5 — Controlled Production        2–4 weeks
                                       ─────────
Total to controlled production:        13–25 weeks (3–6 months)
```

---

## 12. Overall Strategic Conclusion

**Hey Padosi has a genuine differentiation opportunity that no current competitor addresses: safety-first, verified, volunteer-driven, hyperlocal micro-task matching.**

The platform should NOT become "TaskRabbit but free" or "Nextdoor with tasks." Its unique value is the intersection of:

- **Safety-first task controls** (risk classification, OTP verification, immutable audit)
- **Quantified community trust** (transparent trust scores, skill tracking, verified identity)
- **Volunteer + requester dual-role** (community reciprocity, not provider-consumer hierarchy)
- **Hyperlocal density** (neighbourhood-level matching, not city-wide)

The **most important non-technical decision** is choosing the right launch community. A single dense community (college campus or apartment complex) that achieves 50+ active users and 20+ completed tasks will prove more than any feature investment.

The **most important technical decisions** for Phase 2 are infrastructure (Blaze, FCM, analytics) and trust UX (making safety visible to users during the matching decision).

**Speed matters less than getting the product right.** The goal is a meaningfully better, strategically stronger product — not a quick launch.

---

## Document Suite

| #                                          | Document                     | Purpose                               |
| ------------------------------------------ | ---------------------------- | ------------------------------------- |
| [01](./01-current-product-audit.md)        | Current Product Audit        | What Hey Padosi currently is          |
| [02](./02-competitive-landscape.md)        | Competitive Landscape        | External market analysis              |
| [03](./03-feature-comparison-matrix.xlsx)  | Feature Comparison Matrix    | Side-by-side capability comparison    |
| [04](./04-swot-gap-analysis.md)            | SWOT & Gap Analysis          | Strengths, weaknesses, gaps           |
| [05](./05-product-opportunity-strategy.md) | Product Opportunity Strategy | What to build, defer, explore, reject |
| [06](./06-ux-ui-audit.md)                  | UX/UI Audit                  | Interface improvements                |
| [07](./07-product-roadmap.md)              | Product Roadmap              | Phased execution plan                 |
| [08](./08-product-decisions.md)            | Product Decision Register    | Decision log                          |
