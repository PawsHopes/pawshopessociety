# Paws Hopes Society ERP — Production Readiness Gate

**Current decision: NOT APPROVED FOR PRODUCTION**

The staging branch now contains implemented admin workspaces and initial API workflows for animal registry, rescue, veterinary records, adoption/foster, finance, inventory, volunteers and CMS drafts. This is not a complete or production-approved NGO ERP: workflows still require owner UAT, edge-case testing, operational controls and release hardening. A successful compile or CI run does not establish that it is safe for real records.

## Implemented and verified in source

- Cloudflare Access JWT verification with issuer, audience, expiry, not-before, issue-time, key-id and RSA signature checks.
- API-side role/permission middleware.
- Request security headers, strict configured CORS origins, API body-size ceiling.
- Public join-link hashing, HTML escaping, bounded form parsing, duplicate-pending protection, and rate-limit middleware.
- Private-document MIME magic-byte checks, short-lived user-bound HMAC links, permission checks and no-store delivery.
- Append-only audit and financial immutability database triggers in migrations.
- CI for frontend type-check/build, Worker type-check/tests, and SQLite migration application.
- npm dependency audit, CodeQL security analysis, Gitleaks secret scanning, and Dependabot update configuration.

## Known release blockers

1. **ERP workflows need UAT and completion.** The staging branch now has module workspaces and API routes for Animals, Rescue, Medical, Adoptions/Foster, Finance/Ledger, Inventory, Volunteers and CMS drafts. Remaining work includes end-to-end tests for each role, full audit-failure/transaction atomicity checks, payment reconciliation/refunds, 12A/80G receipt controls, live CMS publishing integration, notifications/alert delivery and owner acceptance testing. Do not treat these first-pass workflows as production-ready.
2. **Only staging infrastructure is provisioned.** Admin Pages `phs-phs` has a successful staging deployment with a same-origin Pages Function; staging D1 and KV are bound and migrations are applied. Staging R2 buckets `pawshopes-public-media-staging` and `pawshopes-private-vault-staging` are provisioned and bound to the Admin Pages Function. The public bucket's `r2.dev` domain is enabled; the private bucket's public domain is disabled. End-to-end upload, record linking, signed access and download tests are still required. There are no separate production D1/KV/R2 resources, production Access app, or production deployment. Keep production isolated until separately provisioned and reviewed.
3. **Staging identity is configured but not browser-verified.** The staging Access app allows only the configured owner email. Staging D1 already contains two active Super Admin accounts, including that owner, so first-user bootstrap is not required for the owner. The owner still needs to complete an interactive Access login and verify `/api/v1/admin/me`. The Pages secret `SIGNED_URL_SECRET` is configured. Production Access policies and secrets must be created independently. Razorpay keys are not configured; add them only after payment integration and reconciliation tests are complete. Never commit secrets.
4. **Rate limiting requires Cloudflare edge enforcement.** KV counters are best-effort under concurrent requests. Add Cloudflare WAF/rate-limit rules for public join submissions, uploads and other public endpoints. Ensure the production Worker has the `RATE_LIMIT_KV` binding; the public join route fails closed if it is missing.
5. **Database verification and recovery are incomplete.** Staging D1 schema objects through migrations `0001`–`0008` are present. The standard `d1_migrations` history table was initially absent; after generating a D1 SQL export snapshot, the ledger was reconciled with the eight already-applied migration filenames. Migration `0008` adds database-level adoption eligibility and one-approved-application-per-animal safeguards; the staging trigger was exercised with temporary QA records and the records were removed. CI validates migration files and triggers against temporary SQLite. Staging D1 still needs complete business-level tests, seed-data review, scheduled backup/PITR configuration where available, and a documented restore rehearsal before operational records are entered.
6. **Repository protection needs owner/admin confirmation.** The connected GitHub integration cannot read or change branch-protection settings. Confirm rulesets for `main` and `erp-development`, requiring pull requests, independent review and CI/security checks. Keep production deployment secrets unavailable to untrusted pull-request workflows.
7. **Dependency reproducibility.** CI creates a temporary npm lockfile for each run, audits it, and installs from it. Commit reviewed lockfiles for both npm projects before production to make builds reproducible across runs.
8. **No full integration or penetration test evidence.** There is no verified production-like end-to-end test of Cloudflare Access, CORS, D1, R2, uploads, RBAC, audit failures, restore, or payment callbacks.

## Required release checklist

### GitHub and supply chain
- [ ] Enable branch protection/rulesets for `main` and `erp-development`.
- [ ] Require PR review and all relevant CI/security checks.
- [ ] Commit and review `package-lock.json` for both npm projects; use `npm ci` only.
- [ ] Review CodeQL findings and Dependabot PRs; do not waive high/critical advisories without documented risk acceptance.
- [ ] Keep Actions permissions least-privilege and pin third-party actions to reviewed immutable SHAs.

### Cloudflare identity and edge
- [ ] Create separate staging and production Cloudflare resources.
- [ ] Restrict the Admin ERP Access application to named Society administrators/staff; enforce MFA and short session duration.
- [ ] Confirm the Access JWT audience exactly matches the Worker secret/config.
- [ ] Restrict CORS to the exact public-site and admin origins.
- [ ] Configure WAF/rate limits for public forms, uploads and API abuse.
- [ ] Configure TLS, custom domains, DNS, HSTS suitability and security event alerts.

### D1 and data protection
- [x] Verify staging schema through migrations `0001`–`0008` and reconcile the Wrangler `d1_migrations` ledger.
- [ ] Complete D1 business-level validation, seed-data review, backups and restore rehearsal.
- [ ] Test least-privilege access for every role and every document category.
- [ ] Configure backups/PITR where available and complete a restore rehearsal.
- [ ] Define retention, correction, export and deletion procedures for donor, adopter, volunteer, staff and animal medical records.
- [ ] Verify audit entries are written for every sensitive mutation and that failures cannot silently leave partial business operations.

### R2 and uploads
- [x] Activate R2 and create staging buckets.
- [x] Bind `PUBLIC_MEDIA` and `PRIVATE_VAULT` to the Pages Function.
- [x] Keep `PRIVATE_VAULT` private with no public custom domain.
- [ ] Limit public-media bucket contents to approved publishable assets.
- [ ] Test MIME spoofing, oversized files, malformed multipart requests, path traversal names and access to another user's document token.
- [ ] Decide whether malware scanning/quarantine is required before staff documents become downloadable.

### Business and financial workflows
- [ ] Complete owner UAT and end-to-end tests for all implemented module workflows before entering live records.
- [ ] Finish statutory receipt controls, payment reconciliation/refunds and live CMS publishing before enabling those operations.
- [ ] Implement payment provider signature verification, idempotency, reconciliation and refund/reversal flows before enabling Razorpay.
- [ ] Obtain qualified review of receipt wording, 12A/80G eligibility and statutory reporting. Software must not automatically mark donations as tax-deductible without verified legal status.
- [ ] Test approval segregation, immutable ledger postings, reversal handling and audit evidence with sample data.

### Release and rollback
- [ ] Complete staging user-acceptance testing with synthetic data only.
- [ ] Run authenticated and unauthenticated smoke tests for every endpoint.
- [ ] Perform an independent security review/penetration test.
- [ ] Confirm rollback plan for Worker version, Pages build, D1 schema and data.
- [ ] Obtain explicit release approval before merging/deploying to production.

## Operational note

Do not put production personal or financial data into the development branch, test fixtures, CI logs, or public repository. Use synthetic test data only.
