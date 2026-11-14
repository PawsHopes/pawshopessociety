# SECURITY.md — Paws Hopes Society ERP

| | |
|---|---|
| Version | 0.1 |
| Status | PROPOSAL |

---

## 1. What we are protecting

| Data class | Examples | Sensitivity | Storage |
|---|---|---|---|
| Public | Adoptable animal profiles, stories, gallery, contact info | Low (but **integrity** matters) | D1 published views, R2 public bucket |
| Payment instructions | Bank account, UPI ID, QR image | **Integrity-critical** (fraud target) | D1 CMS with dual approval |
| Personal data | Donors, applicants, reporters, volunteers (phones, addresses, ID docs) | High | D1 + R2 private |
| Financial | Ledger, receipts, invoices, bank statements | High (integrity + confidentiality) | D1 append-only + R2 private |
| Medical | Diagnoses, prescriptions, lab reports | Medium–High | D1 + R2 private |
| Credentials | Razorpay keys, webhook secrets, backup encryption key | Critical | Cloudflare secrets only |

**Personal data** must also be handled in line with India's **Digital Personal Data Protection Act, 2023**: purpose limitation, consent notices on forms, retention limits and breach handling. Confirm the current obligations with a qualified professional. This system supports compliance; it does not by itself make the NGO compliant.

---

## 2. Threat model (top risks)

| # | Threat | Control |
|---|---|---|
| 1 | Someone alters bank or UPI details on the website | CMS dual approval for `donate.*` payment keys; audit log; alert to all Super Admins on change; GitHub branch protection |
| 2 | Account takeover of a staff member | Access with email OTP/Google; enable 2FA on the Google accounts used; short Access session (e.g. 24 h); immediate deactivation path |
| 3 | Insider edits or deletes financial history | Append-only triggers, reversal-only corrections, hash-chained audit log, separation of duties |
| 4 | Fake payment "success" | Server-side signature verification + webhook as the sole source of truth (API_SPECIFICATION §4) |
| 5 | Spam or abuse of public forms | Turnstile, per-IP rate limits, payload size caps, honeypot field |
| 6 | Malicious file upload | Type allowlist, magic-byte check, size cap, private bucket, `Content-Disposition: attachment`, no server-side execution |
| 7 | XSS through CMS content | Store structured JSON/Markdown and render through a sanitiser (allowlisted tags); strict CSP |
| 8 | SQL injection | Parameterised queries only (Drizzle / `prepare().bind()`); lint rule against string-built SQL |
| 9 | Secrets in the public repo | gitleaks in CI on every PR + one-off full-history scan; `.dev.vars` git-ignored |
| 10 | Data loss | Time Travel + encrypted nightly offsite export + quarterly restore drill |
| 11 | Foreign donations without FCRA registration | `is_foreign_source` flag on donors; Razorpay international payments disabled unless FCRA registration is recorded as granted; warning banner in the donation form |

---

## 3. Authentication

| Area | Control |
|---|---|
| Edge | **Cloudflare Access** application covering the admin production domain **and** its preview deployments. The policy is an allowlist of individual emails, with no "anyone with a Gmail" rules. |
| API | **Every request** verifies the Access JWT: signature via the team JWKS, `aud` = application tag, `exp`. Header presence alone is never trusted. The user must be `active` in D1. |
| Development | A dev-only stub identity, compiled out of production builds. A test asserts that it is absent from the production bundle. |
| Break-glass | At least **two** Super Admin accounts at all times. The API blocks removing the last one. |

---

## 4. Authorisation (RBAC + separation of duties)

### 4.1 Role matrix

**Legend:** R = read · W = create/edit · A = approve/decide · own = only records they submitted or are assigned to · — = no access

| Module | Super Admin | Finance | Vet/Medical | Rescue Coord. | Adoption Coord. | Volunteer | Auditor |
|---|---|---|---|---|---|---|---|
| Dashboard | R (all) | R (finance) | R (medical) | R (rescue) | R (adoption) | R (own tasks) | R |
| Animals | R W A | R (basic) | R W (health fields) | R W | R W (adoption fields) | R (basic, no PII) | R |
| Rescue cases | R W A | R | R | R W A | R | R/W own assigned | R |
| Medical | R | R (invoices only) | R W | R (summary) | R (summary) | — | R |
| Adoption/foster | R W A | — | R | R | R W A | — | R |
| Donations/donors | R A | R W A | — | — | — | — | R |
| Expenses | R A | R W A | W own (submit) | W own (submit) | W own (submit) | — | R |
| Ledger/reports | R | R W | — | — | — | — | R |
| Inventory | R W A | R | R W (medicines issue) | R | — | W (food issue) | R |
| Volunteers | R W | — | — | R (assign tasks) | R | R W own profile | R |
| CMS | R W A (publish) | — | — | W (rescue story drafts) | W (adoption drafts) | — | R |
| Compliance | R W | R W | — | — | — | — | R |
| Users and roles | R W | — | — | — | — | — | R |
| Audit log | R | — | — | — | — | — | R |

### 4.2 Hard rules enforced in the service layer and by database triggers

- Nobody approves their own expense, stock adjustment or payment-detail change. **This includes the Super Admin.** The President's own expenses route to the Finance Manager.
- Finance cannot edit medical diagnoses. Medical staff cannot post ledger entries.
- Auditor is read-only. A test verifies that every mutating route returns 403 for the Auditor.
- Only `user.manage` can create users or change roles. Role changes are audit-logged with before/after values.
- Permission checks run on the **server only**. The UI hides buttons for convenience, not for security.

### 4.3 Approval thresholds (proposal — the NGO decides)

| Expense amount | Approval required |
|---|---|
| Up to ₹2,000 | One approver |
| Above ₹2,000 | Finance + President |
| Above ₹10,000 | Finance + President, plus a supporting invoice upload |

---

## 5. Application security controls

| Control | Implementation |
|---|---|
| Input validation | Shared Zod schemas, applied server-side on every route; unknown fields rejected |
| Output encoding | React escaping; CMS HTML sanitised with an allowlist; no `dangerouslySetInnerHTML` except the sanitiser output |
| CSRF | JSON-only mutations + Origin check + SameSite cookies |
| Rate limiting | Public forms: per-IP limits (Workers rate-limit binding or a D1 counter); a WAF rate-limit rule once a custom domain is used |
| File uploads | Max 10 MB (documents), 5 MB (images); allowlist JPEG/PNG/WebP/PDF; magic-byte sniff; SHA-256 de-duplication; EXIF/GPS stripped from public copies; random object keys |
| Private files | Never public-URL addressable; streamed by the API after a permission check; `Cache-Control: private, no-store` |
| Logging | Audit log for every mutation + logins + downloads of `restricted` documents; no PII or secrets in console logs |
| Dependencies | Exact pinned versions, Dependabot alerts, `npm audit` in CI, no install scripts from unknown packages |

### 5.1 Security headers

These are set via `_headers` on both projects; the admin values are stricter.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), geolocation=(self), microphone=()
X-Frame-Options: DENY            (admin)  / SAMEORIGIN (public)
Content-Security-Policy:          (public — final list from the audit's domain inventory)
  default-src 'self'; img-src 'self' data: <r2-public-domain>;
  script-src 'self' https://challenges.cloudflare.com <translate/tally domains>;
  frame-src https://challenges.cloudflare.com <tally>; connect-src 'self';
  object-src 'none'; base-uri 'self'; form-action 'self'
```

---

## 6. Secrets management

| Rule | Detail |
|---|---|
| Where secrets live | `wrangler pages secret put` per environment |
| What lives there | Razorpay key secret and webhook secret, Access AUD tag, Turnstile secret, backup encryption public key |
| Local development | `.dev.vars` (git-ignored) with **test-mode** keys only |
| CI | GitHub Actions secrets, used only by the backup and deploy workflows. Workflows triggered from forks never receive them. |
| Rotation | Annual rotation, and immediate rotation if a leak is suspected. Procedure documented in the maintenance guide. |

**Not secrets (fine in public HTML):** the Turnstile *site* key, the Razorpay *key id*, the UPI ID and the bank account number. These are public by design, but their **integrity** is protected (§2 #1).

---

## 7. Backup, recovery and incident response

| Item | Detail |
|---|---|
| Backup and restore | See ARCHITECTURE.md §9. Targets: **RPO ≤ 24 h** (offsite), minutes via Time Travel; **RTO ≤ 4 h**. |
| Incident steps | 1. Contain: disable the user in Access + D1, rotate secrets. 2. Assess with the audit log. 3. Restore, if needed, into staging first. 4. Notify affected people and authorities where the law requires. 5. Hold a post-mortem. |
| Contact | A named security contact (Super Admin) is recorded in the maintenance guide. |

---

## 8. Pre-launch security checklist (Phase 7 gate)

- [ ] Full-history gitleaks scan clean, or findings rotated.
- [ ] Every admin route has a permission test (allowed + denied).
- [ ] Separation-of-duties tests pass.
- [ ] Immutability triggers tested.
- [ ] Access policy covers production + preview; unauthenticated requests are rejected at both layers.
- [ ] CSP deployed in report-only mode for 1 week, then enforced.
- [ ] Upload fuzzing (wrong MIME, oversized, polyglot PDF).
- [ ] Restore drill completed and timed.
- [ ] 2FA confirmed on all GitHub, Cloudflare and Google admin accounts.
