# 05 — Product Opportunity & Feature Strategy

> **Purpose:** Determine what Hey Padosi could build next. Every recommendation has a reason.

---

## Scoring Methodology

Each opportunity is scored on 7 dimensions (1–5 scale):

| Dimension               | 1 (Low)                     | 5 (High)                                    |
| ----------------------- | --------------------------- | ------------------------------------------- |
| **User Value**          | Nice to have                | Blocks core user journey                    |
| **Differentiation**     | Commoditised feature        | Unique to Hey Padosi                        |
| **Business Value**      | No business impact          | Revenue/growth enabler                      |
| **Safety/Trust Impact** | No safety relevance         | Core safety mechanism                       |
| **Strategic Fit**       | Misaligned with positioning | Reinforces safety-first/hyperlocal identity |
| **Complexity**          | Simple (1–2 days)           | Major effort (4+ weeks)                     |
| **Dependency Risk**     | Self-contained              | Requires external services/billing          |

**Priority = (User + Differentiation + Business + Safety + Strategic) − Complexity − Dependency**

Scores are decision-support heuristics, not precise measurements.

---

## P0 — Essential Before Wider Beta

These must be addressed before real users are onboarded.

### P0-1: Enable Production Infrastructure (Blaze Upgrade)

| Dimension           | Score                                                     |
| ------------------- | --------------------------------------------------------- |
| **Problem**         | Storage, Functions, and FCM don't work without Blaze plan |
| **User Value**      | 5 — App literally doesn't function                        |
| **Differentiation** | 1 — Infrastructure, not feature                           |
| **Business Value**  | 5 — Can't launch without it                               |
| **Safety/Trust**    | 3 — ID images need real storage                           |
| **Strategic Fit**   | 5 — Required                                              |
| **Complexity**      | 2 — Plan upgrade + deploy verification                    |
| **Dependency**      | 3 — Requires billing setup                                |
| **Priority**        | **P0**                                                    |
| **Addresses Gap**   | G-01, G-02                                                |

**Target user:** All users
**Risks:** Cost growth without budget alerts. Set $1/$5/$10 alerts.
**Dependencies:** Firebase billing account

---

### P0-2: Push Notifications (Real FCM)

| Dimension           | Score                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Problem**         | Volunteers don't know about offers unless they're actively in the app |
| **User Value**      | 5 — Offer dispatch is useless without notification                    |
| **Differentiation** | 1 — Table stakes                                                      |
| **Business Value**  | 5 — Core marketplace mechanic                                         |
| **Safety/Trust**    | 2 — Safety notifications need this too                                |
| **Strategic Fit**   | 5 — Required for matching to work                                     |
| **Complexity**      | 3 — FCM integration, service worker, permission prompt                |
| **Dependency**      | 3 — Requires Blaze plan                                               |
| **Priority**        | **P0**                                                                |
| **Addresses Gap**   | G-01                                                                  |

**Target user:** Volunteers (primarily), customers (status updates)
**Risks:** Notification fatigue if poorly managed; iOS PWA limitations

---

### P0-3: Password Reset Flow

| Dimension           | Score                                            |
| ------------------- | ------------------------------------------------ |
| **Problem**         | Email auth users have no way to recover accounts |
| **User Value**      | 4 — Account lockout is unacceptable              |
| **Differentiation** | 1 — Universal feature                            |
| **Business Value**  | 4 — User retention                               |
| **Safety/Trust**    | 2                                                |
| **Strategic Fit**   | 3                                                |
| **Complexity**      | 1 — Firebase provides `sendPasswordResetEmail`   |
| **Dependency**      | 1                                                |
| **Priority**        | **P0**                                           |
| **Addresses Gap**   | G-03                                             |

**Target user:** Email auth users
**Risks:** None significant

---

### P0-4: Product Analytics Foundation

| Dimension           | Score                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Problem**         | No data on user behaviour, conversion funnels, or retention |
| **User Value**      | 1 — Invisible to users                                      |
| **Differentiation** | 1                                                           |
| **Business Value**  | 5 — Can't improve what you can't measure                    |
| **Safety/Trust**    | 1                                                           |
| **Strategic Fit**   | 4 — Data-driven iteration                                   |
| **Complexity**      | 2 — Firebase Analytics or lightweight alternative           |
| **Dependency**      | 2 — Firebase GA already configured but unused               |
| **Priority**        | **P0**                                                      |
| **Addresses Gap**   | G-07                                                        |

**Target user:** Product developer
**Risks:** Privacy: must not track PII. Use anonymised event tracking only.

---

## P1 — High-Value Next Iteration

### P1-1: Rich Landing Page

| Dimension           | Score                                             |
| ------------------- | ------------------------------------------------- |
| **Problem**         | New visitors have no reason to sign up            |
| **User Value**      | 4 — First impression determines signup            |
| **Differentiation** | 2                                                 |
| **Business Value**  | 5 — Conversion funnel starts here                 |
| **Safety/Trust**    | 3 — Landing should communicate safety positioning |
| **Strategic Fit**   | 5 — Brand identity                                |
| **Complexity**      | 2 — Design + static content, no backend           |
| **Dependency**      | 1                                                 |
| **Priority**        | **P1**                                            |
| **Addresses Gap**   | G-04                                              |

**What to include:** Safety-first messaging, how-it-works flow, trust signals (OTP verification, trust scores, audit trail), social proof (when available), feature highlights, screenshots, clear CTA.
**What NOT to include:** Over-designed marketing site. Keep it honest and informative.

---

### P1-2: Dual-Role Dashboard Switching

| Dimension           | Score                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Problem**         | Dual-role users see only customer view; volunteer features are inaccessible |
| **User Value**      | 4 — Blocks a core feature                                                   |
| **Differentiation** | 4 — HP's unique dual-role model is unusable without this                    |
| **Business Value**  | 4 — Increases active volunteer supply                                       |
| **Safety/Trust**    | 1                                                                           |
| **Strategic Fit**   | 5 — The dual-role model is a differentiator                                 |
| **Complexity**      | 2 — Tab/toggle in dashboard                                                 |
| **Dependency**      | 1                                                                           |
| **Priority**        | **P1**                                                                      |
| **Addresses Gap**   | G-05                                                                        |

**Target user:** Dual-role users
**Risks:** None significant

---

### P1-3: Volunteer Task Browsing

| Dimension           | Score                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Problem**         | Volunteers feel passive; can only wait for dispatched offers |
| **User Value**      | 4 — Engagement driver                                        |
| **Differentiation** | 2                                                            |
| **Business Value**  | 4 — More task completions                                    |
| **Safety/Trust**    | 1                                                            |
| **Strategic Fit**   | 3                                                            |
| **Complexity**      | 3 — Firestore query + new UI section + security rules        |
| **Dependency**      | 1                                                            |
| **Priority**        | **P1**                                                       |
| **Addresses Gap**   | G-06                                                         |

**Target user:** Volunteers
**Risks:** Location privacy — must show task location, not customer's home. Limit to category + meeting point area.

---

### P1-4: Notification Centre / Inbox

| Dimension           | Score                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Problem**         | No persistent history of past notifications, offers, or events |
| **User Value**      | 3 — Quality of life                                            |
| **Differentiation** | 1                                                              |
| **Business Value**  | 3 — Reduces confusion                                          |
| **Safety/Trust**    | 1                                                              |
| **Strategic Fit**   | 3                                                              |
| **Complexity**      | 2 — `users/{uid}/notifications` already in schema              |
| **Dependency**      | 1                                                              |
| **Priority**        | **P1**                                                         |
| **Addresses Gap**   | G-13                                                           |

**Target user:** All users

---

### P1-5: Chat Image Sharing

| Dimension           | Score                                                         |
| ------------------- | ------------------------------------------------------------- |
| **Problem**         | Participants can't share location photos or reference images  |
| **User Value**      | 3 — Useful for coordination                                   |
| **Differentiation** | 1                                                             |
| **Business Value**  | 2                                                             |
| **Safety/Trust**    | 2 — Need content moderation consideration                     |
| **Strategic Fit**   | 2                                                             |
| **Complexity**      | 3 — Storage uploads + message schema extension + rules update |
| **Dependency**      | 2 — Requires production Storage                               |
| **Priority**        | **P1**                                                        |
| **Addresses Gap**   | G-11                                                          |

**Target user:** Chat participants
**Risks:** Inappropriate content; would need server-side image screening eventually

---

## P2 — Valuable But Non-Essential

### P2-1: Email Notification Fallback

| Dimension           | Score                                                    |
| ------------------- | -------------------------------------------------------- |
| **Problem**         | Users miss offers/updates when not in app and push fails |
| **User Value**      | 3                                                        |
| **Differentiation** | 1                                                        |
| **Business Value**  | 3                                                        |
| **Complexity**      | 3 — Email service integration (SendGrid/Mailgun)         |
| **Dependency**      | 3 — External email provider                              |
| **Priority**        | **P2**                                                   |
| **Addresses Gap**   | G-10                                                     |

---

### P2-2: Task Editing (Pre-Acceptance)

| Dimension           | Score                                          |
| ------------------- | ---------------------------------------------- |
| **Problem**         | Customers can't fix task details after posting |
| **User Value**      | 3                                              |
| **Differentiation** | 1                                              |
| **Business Value**  | 2                                              |
| **Complexity**      | 2 — Update rules + UI                          |
| **Priority**        | **P2**                                         |
| **Addresses Gap**   | G-12                                           |

---

### P2-3: Social Login (Google/Apple)

| Dimension           | Score               |
| ------------------- | ------------------- |
| **Problem**         | Minor auth friction |
| **User Value**      | 2                   |
| **Differentiation** | 1                   |
| **Business Value**  | 2                   |
| **Complexity**      | 2                   |
| **Priority**        | **P2**              |
| **Addresses Gap**   | G-15                |

---

### P2-4: PWA / Install Prompt

| Dimension           | Score                                          |
| ------------------- | ---------------------------------------------- |
| **Problem**         | No native app experience for returning users   |
| **User Value**      | 3                                              |
| **Differentiation** | 2 — Most competitors are native apps           |
| **Business Value**  | 4 — Retention driver                           |
| **Complexity**      | 2 — Service worker + manifest + install banner |
| **Priority**        | **P2**                                         |
| **Addresses Gap**   | G-16                                           |

---

### P2-5: Matching Scalability Fix

| Dimension           | Score                                             |
| ------------------- | ------------------------------------------------- |
| **Problem**         | In-memory volunteer fetch won't scale beyond ~500 |
| **User Value**      | 1 (only matters at scale)                         |
| **Differentiation** | 1                                                 |
| **Business Value**  | 3                                                 |
| **Complexity**      | 4 — Multi-resolution H3 indexing or GeoFirestore  |
| **Priority**        | **P2** (not blocking beta, but blocking scale)    |
| **Addresses Gap**   | G-09                                              |

---

## EXPLORE — Requires Validation

### EX-1: Trail-Based Commute Matching

**Status:** Frontend code exists but not validated with real users.
**Opportunity:** If volunteers accept tasks along their commute, this is a genuinely unique matching dimension.
**Validation needed:** Do volunteers actually have predictable commute patterns? Are they willing to share location data? Does the detour calculation work in practice?
**Recommendation:** Run a limited opt-in pilot with early beta users before investing further.

---

### EX-2: Campus Community Deployment Model

**Opportunity:** College campuses are dense, bounded communities with high mutual-help demand (library returns, cafeteria pickup, lab supply runs). Students are tech-savvy, trust-oriented (shared institution), and have low opportunity cost.
**Validation needed:** Would campus administration support it? Are there enough task categories? Does the safety model need campus-specific adjustments?
**Recommendation:** Run a pilot at one campus before building campus-specific features.

---

### EX-3: Volunteer Credential Portability

**Opportunity:** Trust scores + verified task counts + skill points = portable volunteer credential for resumes, university service hours, CSR programs.
**Validation needed:** Would institutions accept Hey Padosi verification? Is there demand for this from users?
**Recommendation:** Explore institutional partnerships once the trust system is battle-tested.

---

### EX-4: Institutional Partnership Model

**Opportunity:** Apartment societies (MyGate-style), NGOs, or corporate CSR teams could use Hey Padosi as their verified volunteer management platform.
**Validation needed:** Would institutions pay for this? What features do they need (analytics, reporting, custom categories)?
**Recommendation:** Don't build institutional features until demand is validated.

---

## DO NOT BUILD — Low Value / Excessive Complexity / Poor Strategic Fit

| Feature                               | Reason for Rejection                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Gamification / leaderboards**       | Risk of reducing volunteering to a competition; can create toxic dynamics; explicitly out of Phase 1 scope                            |
| **Social feed / activity stream**     | Not a social network; adds moderation burden; dilutes task-focused UX                                                                 |
| **Payment system**                    | Volunteer model is the differentiator; payments add regulatory complexity, escrow burden, and shift positioning to "cheap TaskRabbit" |
| **AI/LLM content review**             | Explicitly out of Phase 1 scope; adds cost and complexity before there's scale to justify it                                          |
| **Video chat / voice calls**          | Excessive engineering cost; in-app text chat is sufficient for coordination                                                           |
| **Cafe voucher rewards**              | Explicitly out of scope; requires merchant partnerships and payment rails                                                             |
| **Aadhaar verification**              | Explicitly out of scope; regulatory complexity; privacy concerns; Aadhaar API access restrictions                                     |
| **Insurance / deposits**              | Explicitly out of scope; regulatory burden; no revenue to fund it                                                                     |
| **Advanced certificates**             | Explicitly out of scope; no institutional backing yet to make certificates meaningful                                                 |
| **IP ban as primary control**         | Explicitly out of scope; VPNs make it ineffective; account-level enforcement is better                                                |
| **Rich text / markdown in chat**      | Complexity for minimal gain; plain text is fine for coordination                                                                      |
| **Typing indicators / read receipts** | Nice-to-have that adds real-time subscription complexity                                                                              |
| **Dark mode**                         | Low priority; can be added later without architectural changes                                                                        |

---

## Monetization Exploration

### Monetization NOW: None

The platform has zero users. Monetization before product-market fit would add friction and reduce adoption. Keep the platform free.

### Monetization LATER (Once Validated)

| Model                              | Who Pays                            | Value                                                      | Friction                                          | Fit                                        | Complexity                    | Risk                         |
| ---------------------------------- | ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------ | ----------------------------- | ---------------------------- |
| **Institutional subscription**     | Campuses, NGOs, apartment societies | High — organisations pay for verified volunteer management | Low — B2B, not consumer friction                  | High — aligns with community model         | Medium — needs admin features | Depends on demand validation |
| **Premium volunteer profiles**     | Volunteers                          | Low — what premium features for a free service?            | High — creates two-tier volunteer class           | Low — undermines community equity          | Low                           | Risk of perceived unfairness |
| **Requester priority matching**    | Customers                           | Medium — faster matching                                   | Medium — pay-to-skip feels wrong for volunteering | Low — contradicts trust-based matching     | Medium                        | Damages volunteer trust      |
| **Community partner sponsorship**  | Local businesses                    | Medium — sponsor task categories or community events       | Low — doesn't affect user experience              | Medium — if done tastefully                | Low                           | Ad fatigue                   |
| **Data insights for institutions** | Campus/NGO admins                   | Medium — anonymised volunteer engagement analytics         | Low — no user-facing impact                       | High — valuable for CSR/university reports | Medium                        | Privacy compliance needed    |

### Monetization to AVOID

- Per-task fees (kills volunteering motivation)
- Commission on tips/gratitude (extractive)
- Selling user data (trust destruction)
- Mandatory subscriptions (blocks access to help)

---

## User Segment Exploration

| Segment                           | Fit                                                                     | Acquisition Difficulty                  | Safety                               | Marketplace Density                | Value                                     | Priority                   |
| --------------------------------- | ----------------------------------------------------------------------- | --------------------------------------- | ------------------------------------ | ---------------------------------- | ----------------------------------------- | -------------------------- |
| **College students**              | Excellent — mutual help, tech-savvy, dense, bounded                     | Low — campus channels, word of mouth    | Good — institutional oversight       | Excellent — hundreds in one campus | High — habit formation, brand ambassadors | **Primary launch segment** |
| **Apartment community residents** | Good — shared space, moderate density                                   | Medium — society management channels    | Good — verified residency            | Good — dozens per building         | Medium — less frequent tasks              | **Secondary**              |
| **Individual urban neighbours**   | Moderate — less trust baseline                                          | High — scattered, expensive acquisition | Moderate — no institutional backing  | Low — need critical mass           | Medium                                    | **Later**                  |
| **NGO volunteers**                | Moderate — different use case (sustained volunteering, not micro-tasks) | Medium — NGO partnerships               | Good — organisational accountability | Low — geographically scattered     | Medium — institutional value              | **Explore**                |
| **Small businesses**              | Low — commercial tasks don't fit volunteer model                        | High                                    | Low — liability concerns             | N/A                                | Low                                       | **Do not pursue**          |
| **Seniors/elderly**               | Moderate — high need, low tech adoption                                 | High — digital literacy barriers        | Moderate — vulnerability             | Low                                | High social value                         | **Future consideration**   |

**Recommended initial segment:** **College campus** (single campus pilot) → **adjacent apartment communities** → broader neighbourhoods.

---

> **Note:** Timeline and phasing for these features are in Document 07.
