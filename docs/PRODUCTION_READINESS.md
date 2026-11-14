# Paw's Hopez Society ERP — Production Readiness Gate

**Current decision: NOT APPROVED FOR PRODUCTION**

The current repository contains a working foundation and roadmap placeholders. A successful compile or CI run does not mean the full NGO ERP is implemented, configured, or safe for real records.

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

1. **Incomplete ERP modules.** The Animals, Rescue, Medical, Adoptions, Finance/Ledger, Inventory, Volunteers and CMS pages are roadmap placeholders. Their production UI/API workflows, business validation, authorization tests, audit coverage and end-to-end tests are not complete. Do not store live operational records in these modules.
2. **Cloudflare infrastructure is not provisioned in this repository.** The only Worker config currently supplied is `workers/api/wrangler.toml.example`; it contains placeholder D1 and KV IDs. There is no verified production Worker deployment, production D1 binding, R2 binding, or production smoke-test evidence.
3. **Production secrets and Access policy are not verifiable from GitHub.** Configure and verify `CF_ACCESS_AUD`, `SIGNED_URL_SECRET` (at least 32 random bytes), Razorpay secrets only when payment routes exist, and the Cloudflare Access application policy. Never commit these values.
4. **Rate limiting requires Cloudflare edge enforcement.** KV counters are best-effort under concurrent requests. Add Cloudflare WAF/rate-limit rules for public join submissions, uploads and other public endpoints. Ensure the production Worker has the `RATE_LIMIT_KV` binding; the public join route fails closed if it is missing.
5. **Database migration verification is limited.** CI applies migration SQL to temporary SQLite and checks integrity/foreign keys. This is not a substitute for applying migrations to a separate staging D1 database, testing all constraints/triggers against D1, checking seed data, taking backups, and rehearsing a restore.
6. **Repository protections are not enabled.** GitHub reports both `main` and `erp-development` as unprotected. Require pull requests, required status checks, and at least one independent review before merging. Keep production deployment secrets unavailable to untrusted pull-request workflows.
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
- [ ] Apply migrations to staging D1 and verify schema version, triggers, indexes and foreign keys.
- [ ] Test least-privilege access for every role and every document category.
- [ ] Configure backups/PITR where available and complete a restore rehearsal.
- [ ] Define retention, correction, export and deletion procedures for donor, adopter, volunteer, staff and animal medical records.
- [ ] Verify audit entries are written for every sensitive mutation and that failures cannot silently leave partial business operations.

### R2 and uploads
- [ ] Keep `PRIVATE_VAULT` private with no public custom domain.
- [ ] Limit public-media bucket contents to approved publishable assets.
- [ ] Test MIME spoofing, oversized files, malformed multipart requests, path traversal names and access to another user's document token.
- [ ] Decide whether malware scanning/quarantine is required before staff documents become downloadable.

### Business and financial workflows
- [ ] Implement and test all modules listed above before entering live records.
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
