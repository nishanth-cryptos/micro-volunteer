# 08 — Product Decision Register

> **Purpose:** Concise log of every major product recommendation from this discovery. Quick reference for "what have we actually decided?"

---

## Build Decisions

| # | Decision | Reason | Evidence | Impact | Confidence | Revisit When |
|---|---|---|---|---|---|---|
| D-01 | **Build: Blaze upgrade + production infrastructure** | App doesn't function without Cloud Storage, Functions, and real FCM | Gap G-01, G-02 | Critical — blocks all production use | Very High | N/A |
| D-02 | **Build: Real push notifications (FCM)** | Offer dispatch is useless if volunteers don't receive notifications | Gap G-01; all competitors have push | Critical — core marketplace mechanic | Very High | N/A |
| D-03 | **Build: Password reset flow** | Email users can be permanently locked out of accounts | Gap G-03; Firebase provides `sendPasswordResetEmail` | High — user retention | Very High | N/A |
| D-04 | **Build: Product analytics (Firebase Analytics)** | Can't measure user behaviour, conversion, or retention; can't iterate data-driven | Gap G-07; Firebase GA already configured but unused | High — enables data-driven iteration | Very High | N/A |
| D-05 | **Build: Rich landing page** | Current landing gives visitors zero reason to sign up; no trust, no explanation | Gap G-04; 55-line `HomePage.tsx` | High — conversion funnel | High | After seeing signup conversion data |
| D-06 | **Build: Dual-role dashboard switching** | HP's unique dual-role model is unusable without it; dual-role users default to customer view | Gap G-05; code review confirmed no toggle | High — unlocks differentiating feature | Very High | N/A |
| D-07 | **Build: Volunteer task browsing** | Volunteers feel passive; can only wait for dispatched offers; no agency | Gap G-06; competitor pattern | High — volunteer engagement | High | After measuring volunteer retention |
| D-08 | **Build: Trust badges on match cards** | Customers can't see volunteer trust level during matching; trust information is hidden | UX-1; trust UX audit | High — safer matching decisions | Very High | N/A |
| D-09 | **Build: Notification centre** | No persistent notification/offer history | Gap G-13; all competitors have this | Medium — quality of life | High | N/A |
| D-10 | **Build: Skeleton loading states** | Generic spinner doesn't communicate what's loading | UX-3 | Medium — perceived performance | High | N/A |
| D-11 | **Build: Back navigation on inner pages** | Users get disoriented on task detail and create task pages | UX-4 | Medium — navigation | Very High | N/A |
| D-12 | **Build: Component refactor (dashboards)** | 82KB VolunteerDashboard + 66KB CustomerDashboard are unmaintainable | Code review | Medium — developer velocity | Very High | N/A |

---

## Defer Decisions

| # | Decision | Reason | Revisit When |
|---|---|---|---|
| D-20 | **Defer: Chat image sharing** | Text chat is sufficient for MVP coordination; image sharing adds Storage complexity + content moderation needs | Users report coordination difficulties in beta |
| D-21 | **Defer: Email notification fallback** | Push notifications should be tried first; email adds external service dependency | Push notification miss rate is high in beta analytics |
| D-22 | **Defer: Social login (Google/Apple)** | Phone + email are sufficient; social login adds OAuth complexity | Signup conversion data shows friction |
| D-23 | **Defer: PWA install prompt** | Useful but not blocking; can be added without architectural changes | Users ask "is there an app?" in beta |
| D-24 | **Defer: Task editing post-creation** | Users can cancel and recreate; editing adds Firestore update rules complexity | Frequent error reports in beta |
| D-25 | **Defer: Matching scalability fix** | Current 500-volunteer cap is fine for beta; fix is needed before scale but not before beta | Approaching 200+ concurrent volunteers in a single area |
| D-26 | **Defer: Two-way rating** | Customer-only rating is sufficient for trust score; two-way adds complexity | Beta feedback from volunteers requesting customer ratings |
| D-27 | **Defer: Trail-based commute matching** | Code exists but is unvalidated; requires opt-in pilot before investment | Phase 3 beta pilot if volunteers express interest |

---

## Explore Decisions

| # | Decision | Reason | Validation Method |
|---|---|---|---|
| D-30 | **Explore: Campus community launch** | Dense, bounded communities solve cold-start; students are ideal early adopters | Single campus pilot in Phase 3 |
| D-31 | **Explore: Volunteer credential portability** | Trust scores + verified tasks could be portable credentials for resumes and CSR | Institutional partner conversations |
| D-32 | **Explore: Institutional partnerships** | Apartment societies, NGOs, and CSR teams could use HP as volunteer management | Demand validation with 2–3 institutions |
| D-33 | **Explore: Community/neighbourhood grouping** | Multi-community structure needed before scale; model TBD | Phase 4 architecture decision |

---

## Reject Decisions

| # | Decision | Reason | Confidence | Revisit Condition |
|---|---|---|---|---|
| D-40 | **Reject: Gamification / leaderboards** | Reduces volunteering to competition; toxic dynamics risk; explicitly out of Phase 1 scope | High | Never — philosophical misalignment |
| D-41 | **Reject: Social feed / activity stream** | Not a social network; adds moderation burden; dilutes task-focused UX | High | If community engagement drops below sustainable levels |
| D-42 | **Reject: Payment system** | Volunteer model is THE differentiator; payments shift positioning to "cheap TaskRabbit" | Very High | Only if the volunteer model proves unsustainable |
| D-43 | **Reject: AI/LLM content review** | Explicitly out of scope; no scale to justify cost | High | If moderation workload becomes unmanageable at 1000+ reports/month |
| D-44 | **Reject: Video chat / voice calls** | Excessive engineering cost; text chat sufficient | High | Never in Phase 1–3 |
| D-45 | **Reject: Cafe voucher rewards** | Out of scope; requires merchant partnerships and payment rails | High | If institutional sponsor wants to fund |
| D-46 | **Reject: Aadhaar verification** | Regulatory complexity; privacy concerns; API access restrictions | Very High | Only if government mandates for platforms of this type |
| D-47 | **Reject: Insurance / deposits** | Regulatory burden; no revenue to fund; out of scope | High | If task risk incidents increase |
| D-48 | **Reject: Advanced certificates** | No institutional backing to make certificates meaningful | Medium | If university/NGO partner requests verifiable credentials |
| D-49 | **Reject: Per-task monetization** | Kills volunteer motivation; antithetical to community model | Very High | Never |
| D-50 | **Reject: Dark mode** | Low priority; cosmetic | Low | When there's nothing more important to work on |

---

## Strategic Direction Decisions

| # | Decision | Reason |
|---|---|---|
| D-60 | **Hey Padosi is NOT "TaskRabbit but free"** | The differentiator is safety-first + verified identity + community trust + dual-role, not price |
| D-61 | **Launch with one dense community, not broadly** | Cold-start is the #1 risk; density > reach | 
| D-62 | **Safety-first is the brand, not just a feature** | Every UX decision should reinforce that this is the safest way to help or get help from neighbours |
| D-63 | **Keep the volunteer model** | The free, volunteer-driven model creates a fundamentally different value proposition from paid marketplaces |
| D-64 | **Don't chase feature parity with competitors** | HP doesn't need payments, insurance, or facial recognition to be valuable; it needs to be the safest neighbourhood help platform |
| D-65 | **Campus is the optimal launch segment** | Dense, bounded, tech-savvy, institutional trust layer, high mutual-help demand |
| D-66 | **Don't monetise before product-market fit** | Adding fees before proving value would kill adoption |
