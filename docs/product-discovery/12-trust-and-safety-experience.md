# 12 — Trust & Safety Experience Specification

> **Purpose:** Document Hey Padosi's trust and safety architecture, competitive differentiation, verified badge rules, risk communication, reporting/blocking flows, and moderation transparency.

---

## 1. Core Philosophy & Strategic Differentiation

Hey Padosi is positioned at the intersection of hyperlocal service marketplaces and community volunteering. Unlike commercial gig platforms that rely on expensive corporate liability fees or social networks with unmoderated feeds, Hey Padosi's core moat is **neighbourhood solidarity paired with server-authoritative safety controls**:

1. **vs. Urban Company:** Replaces expensive corporate service middle-men with community assistance while maintaining safety through **Risk-Tiered ID Verification** and **In-Person Physical OTP Handshakes**.
2. **vs. TaskRabbit:** Eliminates commercial gig haggling; provides **Structured Task Contracts (meeting point, what to bring, preference, safety note)** and mutual accountability.
3. **vs. Nextdoor:** Replaces unstructured, unvetted message boards with **strict PII privacy shielding (exact coordinates never shared, phone numbers shielded)** and **server-enforced mutual blocklists**.
4. **vs. VolunteerMatch / Idealist:** Moves beyond remote/institutional NGO volunteering to provide **real-time, in-person task safety with active moderation**.

---

## 2. Standardized Badge Hierarchy

| Badge                  | Visual Treatment                                    | Eligibility Rule                | Meaning                                                | Audience             |
| ---------------------- | --------------------------------------------------- | ------------------------------- | ------------------------------------------------------ | -------------------- |
| `🛡️ ID Verified`       | `bg-emerald-50 text-emerald-800 border-emerald-200` | `userDoc.idVerified === true`   | Identity documents verified by platform administrator. | Customer & Volunteer |
| `✓ Verified Neighbour` | `bg-[#e3efe9] text-[#1f6f5c] border-[#1f6f5c]/20`   | `userDoc.verifiedTaskCount > 0` | Has completed at least 1 verified in-person task.      | Customer & Volunteer |
| `★ Skill Matched`      | `bg-[#e8effb] text-[#1f4baa] border-[#1f4baa]/20`   | `scoreBreakdown.skill > 0.5`    | Volunteer's registered skills match task requirements. | Customer & Volunteer |

> [!IMPORTANT]
> A badge must **never** be rendered if the underlying Firestore field is absent or false. The platform never claims "police verification" or "biometric verification" without backend support.

---

## 3. Humanized Trust Score Tiers

Trust Score is clamped in `[30, 100]` and calculated server-side by `recompute-trust-score.ts`. Instead of exposing internal algorithmic weightings, it is paired with plain-language community tiers:

| Score Range  | Tier Descriptor               | Human Meaning                                                       |
| ------------ | ----------------------------- | ------------------------------------------------------------------- |
| **90 – 100** | `Exceptional Community Trust` | Punctual, consistently verified neighbour with outstanding reviews. |
| **70 – 89**  | `High Community Trust`        | Active verified neighbour with positive community feedback.         |
| **40 – 69**  | `Building Trust`              | Active volunteer establishing a verified local track record.        |
| **< 40**     | `Community Member`            | Recently joined the neighbourhood network.                          |

### The Three Pillars of Trust Explainer:

1. **In-Person Handshake Verification:** 6-digit start and completion passcodes exchanged verbally in person.
2. **Mutual Neighbour Feedback:** Verified ratings after every completed task.
3. **Verified Identity for Sensitive Tasks:** Mandatory ID verification for Medium risk categories.

---

## 4. Contextual Risk Levels

| Category Tier        | Backend Field         | Customer UX Explanation                                                                                                | Volunteer Eligibility                           |
| -------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Everyday Task**    | `riskLevel: 'low'`    | `"Everyday Community Task: Involves everyday neighbourhood micro-assistance. Open to all active local volunteers."`    | Open to all registered volunteers.              |
| **ID-Verified Task** | `riskLevel: 'medium'` | `"ID-Verified Task: Involves medicine, errands, or home assistance. Matched exclusively with ID-verified volunteers."` | Restricted to `idVerified === true` volunteers. |

---

## 5. Reporting & Blocking Architecture

### Reporting (`functions/src/report-user.ts`)

- **Taxonomy:** `safety` (Safety concern), `no_show` (Did not arrive), `inappropriate` (Abusive behavior), `fraud` (Commercial fee solicitation), `other`.
- **Privacy:** Confidential submission directly to Admin Moderation Console (`AdminDashboard.tsx`).
- **Feedback:** Clear confirmation without false promises of instant bans.

### Blocking (`functions/src/block-user.ts`)

- **Consequences:** Immediate and mutual. Excludes user from `rankForTask` in matching algorithm.
- **Chat:** Real-time chat communication is immediately disabled.
- **Management:** Users can inspect their blocked users list in their Profile settings.

---

## 6. Moderation Transparency

Affected users receive direct banners on both Customer and Volunteer dashboards:

- **Warned Accounts (`accountStatus === 'warned'`):** `"Community Guidelines Notice: Strike {strikeCount}/3. Reason: {moderationReason}."`
- **Suspended Accounts (`accountStatus === 'suspended'`):** `"Account Temporarily Suspended. Reason: {moderationReason}."`

Admin notes and reporter details remain strictly restricted to server-side admin roles.
