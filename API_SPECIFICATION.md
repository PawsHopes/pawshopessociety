# API_SPECIFICATION.md — Paws Hopes Society ERP

| | |
|---|---|
| Version | 0.1 |
| Status | PROPOSAL — request/response schemas will live as Zod schemas in `packages/shared` and an OpenAPI file will be generated from them |

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Base paths | Admin: `/api/v1/*` (admin origin). Public: `/api/public/*` (public origin). |
| Format | JSON, UTF-8. Money values are integer paise named `*_paise`. Dates use ISO-8601. |
| Pagination | `?limit=25&cursor=<opaque>` returns `{ data: [...], next_cursor }` |
| Filtering | `?status=…&q=…&from=…&to=…` (whitelisted fields only) |
| Errors | `{ error: { code, message, details? } }` with codes 400 validation, 401 unauthenticated, 403 forbidden, 404, 409 conflict/duplicate, 422 business rule, 429 rate limited |
| Idempotency | `Idempotency-Key` header **required** on financial POSTs. A replay returns the original response. |
| Concurrency | Mutable resources return `version`. A PATCH must send `If-Match: <version>`, or the API returns 409. |
| CSRF | Mutations require `Content-Type: application/json` and a same-origin `Origin`. Access cookies are SameSite. |
| Auth | Every admin request: verify `Cf-Access-Jwt-Assertion` → active user → permission (see SECURITY.md §4) |
| Audit | Every mutation writes an `audit_logs` row in the **same batch** |

---

## 2. Public API (`/api/public`) — no authentication

| Method | Path | Purpose | Protection |
|---|---|---|---|
| GET | `/animals?species=&gender=` | Adoptable animals (from `v_public_adoptable`) | Cached for 60 s |
| GET | `/animals/{code}` | One public profile | Cached |
| GET | `/stories?kind=rescue\|adoption_success\|announcement` | Published stories | Cached |
| GET | `/content/{key}` | Published CMS block (hero, about, donate.bank, contact…) | Cached |
| GET | `/stats` | Public statistics (in shelter, adopted, rescued) | Cached |
| GET | `/gallery?page=` | Public gallery | Cached |
| POST | `/forms/rescue` | Rescue report (+ up to 3 photos) | Turnstile, rate limit, size limits |
| POST | `/forms/volunteer` | Volunteer sign-up | Turnstile, rate limit |
| POST | `/forms/adoption` | Adoption or foster application | Turnstile, rate limit |
| POST | `/forms/contact` | General enquiry | Turnstile, rate limit |
| POST | `/donations/razorpay/order` | Create an order (amount, purpose) | Turnstile, rate limit (Phase 5b) |
| POST | `/donations/razorpay/webhook` | Razorpay webhook | **HMAC-SHA256 signature over the raw body**; event-id idempotency |

**What the public API never returns:**

- internal notes or PII;
- medical details beyond the public health summary;
- private-bucket URLs.

---

## 3. Admin API (`/api/v1`) — selected endpoints

The required permission is shown in brackets.

### 3.1 Platform

| Method | Path | Required permission |
|---|---|---|
| GET | `/me` | none (returns user, roles, permissions) |
| GET | `/dashboard?from=&to=` | `dashboard.view` (widgets filtered by permission) |
| GET | `/notifications` | none |
| POST | `/notifications/{id}/read` | none |
| POST | `/uploads` | `upload.create` (multipart; returns `media_asset_id`) |
| GET | `/documents/{id}/download` | Permission depends on the document's sensitivity and the linked entity; streamed from R2 |
| GET | `/audit-logs?entity_type=&entity_id=` | `audit.view` |
| GET, POST, PATCH | `/users` | `user.manage` |
| PUT | `/users/{id}/roles` | `user.manage` (cannot remove the last Super Admin) |

### 3.2 Animals

| Method | Path | Required permission |
|---|---|---|
| GET, POST | `/animals` | `animal.view` / `animal.create` |
| GET, PATCH | `/animals/{id}` | `animal.view` / `animal.update` (field-level: medical fields need `medical.update`) |
| POST | `/animals/{id}/status` | `animal.status.change` (`{to, reason}`; writes history) |
| GET | `/animals/{id}/timeline` | `animal.view` |
| POST, PATCH | `/animals/{id}/media` | `animal.update` |
| GET | `/animals/{id}/expenses` | `finance.view` |

### 3.3 Rescue

| Method | Path | Required permission |
|---|---|---|
| GET | `/rescue-reports` | `rescue.view` |
| POST | `/rescue-reports/{id}/convert` | `rescue.create` |
| GET, POST | `/rescue-cases` | `rescue.view` / `rescue.create` |
| PATCH | `/rescue-cases/{id}` | `rescue.update` |
| POST | `/rescue-cases/{id}/transition` | `rescue.update` (enforces the workflow graph) |
| POST | `/rescue-cases/{id}/updates` | `rescue.update` |

### 3.4 Medical

| Method | Path | Required permission |
|---|---|---|
| GET, POST | `/animals/{id}/medical-records` | `medical.view` / `medical.create` |
| PATCH | `/medical-records/{id}` | `medical.update` (diagnosis edits keep the prior value in audit) |
| POST | `/animals/{id}/procedures` | `medical.create` |
| GET | `/reminders/medical?due_before=` | `medical.view` |
| GET, POST | `/appointments` | `medical.view` / `medical.create` |

### 3.5 Adoption and foster

| Method | Path | Required permission |
|---|---|---|
| GET | `/applications?type=&status=` | `adoption.view` |
| POST | `/applications/{id}/transition` | `adoption.update` (approve/reject needs `adoption.decide`) |
| POST | `/applications/{id}/agreements` | `adoption.update` |
| POST | `/applications/{id}/followups` | `adoption.update` |

### 3.6 Finance

| Method | Path | Required permission |
|---|---|---|
| GET, POST | `/donors` | `donor.view` / `donor.manage` |
| POST | `/donations` | `donation.create` (Idempotency-Key; duplicate `mode+txn_ref` returns 409) |
| POST | `/donations/{id}/verify` | `donation.verify` (posts the journal entry) |
| POST | `/donations/{id}/receipt` | `receipt.issue` (gapless number; 80G flag only if a granted 80G registration exists) |
| POST | `/receipts/{id}/cancel` | `receipt.cancel` (reason required; posts a reversal) |
| POST | `/expenses` | `expense.submit` |
| POST | `/expenses/{id}/submit` | `expense.submit` |
| POST | `/expenses/{id}/approve` | `expense.approve` (**403 if approver = submitter**) |
| POST | `/expenses/{id}/reject` | `expense.approve` |
| POST | `/expenses/{id}/pay` | `expense.pay` |
| POST | `/journal-entries` | `ledger.post` (manual entry, must balance) |
| POST | `/journal-entries/{id}/reverse` | `ledger.post` |
| GET | `/reports/{cashbook\|ledger\|trial-balance\|income-expenditure\|receipts-payments\|fund-balances\|budget-vs-actual\|animal-expenditure}?from=&to=&format=json\|csv` | `report.finance` |
| POST | `/bank-statements/import` | `reconcile.manage` (CSV) |
| POST | `/bank-statements/{lineId}/match` | `reconcile.manage` |
| GET, POST | `/budgets` | `budget.manage` |

### 3.7 Inventory

| Method | Path | Required permission |
|---|---|---|
| GET, POST | `/inventory/items` | `inventory.view` / `inventory.manage` |
| POST | `/inventory/movements` | `inventory.move` (receipt/issue; issuing below zero returns 422) |
| POST | `/inventory/adjustments` | `inventory.adjust` (creates a pending approval) |
| GET | `/inventory/alerts` | `inventory.view` (low stock + expiring ≤ 30 days) |
| GET, POST, PATCH | `/purchase-orders` | `procurement.manage` |

### 3.8 Volunteers

| Method | Path | Required permission |
|---|---|---|
| GET, POST, PATCH | `/volunteers` | `volunteer.view` / `volunteer.manage` |
| GET, POST, PATCH | `/volunteer-tasks` | `task.manage`; a volunteer can only update the status of their own tasks |
| POST | `/attendance` | `attendance.record` |

### 3.9 CMS

| Method | Path | Required permission |
|---|---|---|
| GET | `/content` | `cms.view` |
| POST | `/content/{key}/revisions` | `cms.edit` (draft) |
| GET | `/content/{key}/preview/{rev}` | `cms.view` |
| POST | `/content/{key}/publish/{rev}` | `cms.publish` (dual approval for `donate.bank`/`donate.upi`) |
| POST | `/content/{key}/unpublish` | `cms.publish` |
| GET, POST, PATCH | `/stories` | `cms.edit` |
| POST | `/stories/{id}/publish` | `cms.publish` |

### 3.10 Compliance

| Method | Path | Required permission |
|---|---|---|
| GET, POST, PATCH | `/registrations` | `compliance.manage` |
| GET | `/compliance/registers/{donations\|expenses\|veterinary\|adoptions\|volunteers\|members}?from=&to=&format=csv` | `compliance.view` |
| GET | `/compliance/expiring-documents` | `compliance.view` |

**PDF exports** are rendered client-side from the JSON returned by these endpoints.

---

## 4. Razorpay flow (Phase 5b, only after the account and KYC are confirmed)

1. **Create the order.** The browser calls `POST /api/public/donations/razorpay/order`. The server creates the Razorpay order with the secret key and stores a `pending` donation.
2. **Checkout.** The browser opens Razorpay Checkout. On success, the browser posts `{order_id, payment_id, signature}`. The server verifies `HMAC_SHA256(order_id|payment_id, key_secret)`. **Even then, the donation is only `payment_claimed`.**
3. **Webhook.** The `payment.captured` webhook is verified over the raw body with the webhook secret, then de-duplicated by event id. Only this step marks the donation `verified` and posts the ledger entry.
4. **Never trust the frontend.** A frontend "success" message never creates a receipt.
5. **Secrets.** The keys live only as Pages secrets.
