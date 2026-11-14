# IMPLEMENTATION_PLAN.md — Paws Hopes Society ERP

| | |
|---|---|
| Version | 0.1 |
| Status | PROPOSAL — nothing is implemented until you approve |

---

## 1. Decisions needed from you before Phase 3

| # | Decision | Recommendation | Why it matters |
|---|---|---|---|
| Q1 | **Exact registered legal name** (Paw's Hopez / Paws Hopes / Paws Hopez Society) and registration year | Use the name exactly as on the registration certificate | Printed on receipts, agreements and reports |
| Q2 | **Custom domain?** | Yes (e.g. a `.org`); keep `pages.dev` working | Professional receipts and links; WAF rate-limit rules; cleaner Access setup |
| Q3 | **Repo restructure + private repo** | Move the site to `apps/public/` and make the repo private | Prevents ERP source, migrations and docs being publicly served (Audit T8) |
| Q4 | **Workers Paid ($5/month) at production launch** | Yes | Avoids hard daily stops on an ERP |
| Q5 | **Razorpay** — is there an account with completed NGO KYC? | Phase 5b only after confirmation; UPI/bank reconciliation first | Gateway integration is wasted effort without an active account |
| Q6 | **Foreign donations / FCRA status** | Block foreign payments unless FCRA is granted | Legal exposure |
| Q7 | **Email for receipts** (needs a third-party sender) | Defer; download/WhatsApp-share PDFs at first | Avoids a new dependency until needed |
| Q8 | **Phase order change** (§3) | Approve | Delivers the most-wanted feature (live adoption listings) earlier |
| Q9 | **Expense approval thresholds** (SECURITY.md §4.3) | Confirm or amend | Encoded as configuration |
| Q10 | **Chart of accounts** | Have the NGO's CA review the default before Phase 5 | Accounting policy is a professional decision |

---

## 2. Working method

### 2.1 Branching and review

- **Branch flow:** `feature/*` → PR → `staging` → PR → `main`.
- **`main` is protected:** PR required, CI green, your approval.
- **Each PR is a small, testable unit** with:
  - a description;
  - screenshots for UI changes;
  - migration notes;
  - a rollback note.

### 2.2 CI on every PR

| Check | Tool |
|---|---|
| Typecheck | `tsc` |
| Lint | ESLint |
| Unit and integration tests | Vitest in workerd |
| Secrets scan | gitleaks |
| Migration safety | Apply all migrations to a fresh local D1 |
| Bundle check | Fail if the dev auth stub appears in the build |

**Production deploys happen only after your explicit approval**, as a merge to `main`.

### 2.3 Definition of Done (per feature)

- Server-side validation in place.
- Permission tests cover both allowed and denied cases.
- Audit log written.
- Mobile layout checked at 360 px.
- Empty, loading and error states present.
- Docs updated.

---

## 3. Phases

> **Proposed change to the brief's order.** Phase 4a delivers *Animals → live public adoption listing* immediately after the foundation, so `animals.js` stops being the bottleneck early. The rest of the CMS stays in Phase 6.

### Phase 1 — Repository audit *(in progress)*

Delivered:

- REPOSITORY_AUDIT.md (partial)

Remaining:

- source-level review with the repo ZIP;
- full-history secrets scan;
- domain inventory for the CSP;
- Lighthouse/axe baseline.

### Phase 2 — System design *(this document set)*

Deliverables:

- ARCHITECTURE.md
- DATABASE_SCHEMA.md
- API_SPECIFICATION.md
- SECURITY.md
- this plan

**Exit criterion:** your approval and the answers to Q1–Q10.

### Phase 3 — Foundation (size: L)

| PR | Content |
|---|---|
| 3.1 | Repo restructure (`apps/public`), Pages output-dir change **tested on a preview branch**, `_headers`, CI + gitleaks. *Production config change requires your approval.* |
| 3.2 | Monorepo scaffolding: admin SPA shell (branding, layout, nav, mobile drawer), Hono API skeleton, shared packages |
| 3.3 | D1 staging and production databases, R2 buckets, bindings, `0001_init.sql` (identity, audit, sequences, documents) |
| 3.4 | Access applications (prod + preview), JWT middleware, `/me`, RBAC seed (7 roles, permissions), user admin screens |
| 3.5 | Audit log with hash chain, upload pipeline (client resize → validation → R2), document download with authorisation |
| 3.6 | Nightly encrypted D1 backup workflow + **first restore drill** |

**Acceptance criteria:**

- Login works.
- Unauthorised requests are rejected at both layers.
- Role tests pass.
- A backup has been restored into staging.

### Phase 4 — Core ERP (size: XL, split into a–e)

| Sub-phase | Content |
|---|---|
| **4a Animals + public adoption feed** | Registry, enclosures, status history, timeline, photos. **animals.js migration (dry run → your sign-off → apply).** `/api/public/animals`; `adopt.html` fetches live data with the old file as fallback. |
| 4b Rescue | Intake (incl. phone entry), cases, workflow transitions, team, updates, link to animals |
| 4c Medical | Records, prescriptions, procedures (vaccination/deworming/sterilisation/lab), appointments, reminders + notifications |
| 4d Adoption and foster | Applications, verification, home visit, decisions, agreements, handover, follow-ups; public application form (Turnstile) |
| 4e Dashboard v1 | Operational widgets: animals, cases, treatment, vaccinations due, adoptable, fostered |

### Phase 5 — Finance and inventory (size: XL)

| Sub-phase | Content |
|---|---|
| 5a Ledger core | Chart of accounts (CA-reviewed), funds, journal + seals + immutability triggers, reversals, sequences |
| 5b Donations | Donors, manual donations (UPI/bank/cash), verification, receipts PDF, cancellations; **Razorpay only after Q5** |
| 5c Expenses | Submission with invoice upload, approval chain with separation of duties, payment posting, duplicate detection |
| 5d Reports | Cash book, ledger, trial balance, receipts & payments, income & expenditure, fund balances, budget vs actual, animal-wise expenditure, bank reconciliation (CSV import) |
| 5e Inventory | Items, lots/expiry, movements, adjustments with approval, purchase orders, low-stock/expiry alerts |
| 5f Dashboard v2 | Financial widgets, pending approvals |

### Phase 6 — CMS and public integration (size: L)

- Content entries, revisions, preview, publish/unpublish.
- **Dual approval for payment details.**
- Stories, gallery, announcements, statistics, SEO fields.
- `script.js` switches to API data.
- HTMLRewriter server-rendering for `/adopt` and `/rescue`.
- Native forms replace Tally, after a decision on importing existing Tally data.
- Compliance centre: registrations (12A/80G/AWBI/FCRA), registers, CSV/PDF exports, document expiry reminders.
- Volunteer module: profiles, tasks, attendance, feeding rota.

### Phase 7 — Testing (size: M)

- Full acceptance list from the brief §14.
- Security checklist (SECURITY.md §8).
- Playwright E2E on Android Chrome viewport + desktop.
- axe accessibility.
- Restore drill.
- **TEST_REPORT.md** delivered to you.

### Phase 8 — Production (size: S)

- DEPLOYMENT.md, BACKUP_RECOVERY.md, USER_GUIDE.md (with screenshots, in simple English; Hindi version optional), MAINTENANCE.md.
- Staff onboarding session.
- Production go-live **only on your written approval**.
- Monitoring: Cloudflare analytics + error alerts.

---

## 4. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Source audit reveals surprises (secrets, unusual structure) | Medium | Medium | Complete Phase 1 before any code lands |
| R2 | Pages output-dir change breaks the live site | Low | High | Preview-branch test, URL crawl comparison (all 8 pages + `.html` variants + assets), instant rollback by reverting the setting |
| R3 | animals.js data incomplete or images missing | Medium | Low | Dry-run report; nothing written without sign-off; fallback file retained |
| R4 | Staff adoption: the ERP is too complex for daily use | **High** | **High** | Mobile-first, few required fields, phone-friendly quick actions (log feeding, add vaccination, record donation), staged rollout, training |
| R5 | Access 50-user cap if volunteers get logins | Medium | Medium | Volunteers stay out of Access; separate portal auth later (ADR-5) |
| R6 | D1 free-tier daily caps cause outages | Low | Medium | Caching, indexed queries, Workers Paid at launch (Q4) |
| R7 | Accounting design doesn't match CA/audit expectations | Medium | High | CA review of chart of accounts and report formats before 5a |
| R8 | Single maintainer / bus factor | High | High | Documentation, simple stack, two Super Admins, maintenance guide |
| R9 | Legal or compliance over-claiming | Low | High | Registrations are recorded, never inferred; no 80G flag unless granted; DPDP/FCRA reviewed by a professional |
| R10 | Tally data orphaned or retained longer than needed | Medium | Medium | Import + retention decision in Phase 6 |

---

## 5. Immediate next steps

1. You send the repository ZIP (or grant repo access via Claude Code) and the Pages build-settings screenshot.
2. You answer Q1–Q10. Defaults apply where you agree with the recommendation.
3. I complete REPOSITORY_AUDIT.md v1.0 (source-level), update these documents, and present Phase 3 PR 3.1 for review.
