# Paws Hopes Society Admin ERP — staging deployment runbook

This runbook is staging-only. It must not change the public website, the existing public Pages project, the `main` branch, or production data.

## Current verified staging state (15 November 2026)

- Admin Pages project: `phs-phs`
- Admin URL: `https://phs-phs.pages.dev`
- Source: `PawsHopes/pawshopessociety`, branch `erp-development`
- Pages root: `apps/admin-erp`
- Build command: `npm install --prefix ../../workers/api --no-save --no-package-lock --omit=dev && npm run build`
- Output directory: `dist`
- Latest verified application-code deployment: commit `6ed04ebce52aa5d0434b84124040185832d00af8` (`https://d4e56253.phs-phs.pages.dev`)
- ERP CI and Security Analysis passed for that application-code commit: frontend build, Worker API checks, migration validation, CodeQL and secret scanning.
- Cloudflare Access app protects `phs-phs.pages.dev` and currently allows only `hopezpaws@gmail.com`.
- Zero Trust team: `mute-pond-e3e6.cloudflareaccess.com`
- Staging D1: `pawshopes-erp-db-staging` (`a6fd7136-b618-4072-af6a-5373f4e727d1`)
- Staging KV: `pawshopes-erp-rate-limit-staging` (`1156cf04f6b9496dabc7d580457f0c53`)
- Staging D1 schema objects through migrations `0001`–`0008` are present. The standard `d1_migrations` history table was reconciled and now records all eight migration files. D1 SQL export snapshots were generated before the metadata repair and adoption-reservation migration. The database has 17 animal records, 2 volunteer records and 3 stock movements; 21 synthetic QA records were added for testing. The adoption-reservation trigger was verified with a temporary animal and two applications: the first approval reserved the animal, the second was blocked, and all temporary test records were removed. Review existing records before operational use; do not delete or overwrite records without confirming their origin.
- `SIGNED_URL_SECRET` is configured as a Pages secret. Its value is intentionally not exposed in this runbook; verify private-document signed-link behavior after deployment.
- R2 is activated. The public staging bucket `pawshopes-public-media-staging` has its managed `r2.dev` domain enabled; `pawshopes-private-vault-staging` has no public domain. The latest verified application-code deployment includes the `PUBLIC_MEDIA` and `PRIVATE_VAULT` bindings. Application-level upload, record linking, signed access and download still need authenticated end-to-end verification.
- The Pages Function at `apps/admin-erp/functions/api/[[path]].ts` serves the same Hono API on the Admin hostname. The latest Pages build and deployment completed successfully.
- Interactive browser login and authenticated end-to-end smoke tests are not yet confirmed.

## 1. R2 staging storage — provisioned

Cloudflare confirms that both staging buckets exist and are bound to the `phs-phs` Pages Function:
- `pawshopes-public-media-staging` — public staging media; managed `r2.dev` domain enabled.
- `pawshopes-private-vault-staging` — private documents; managed public domain disabled.
- Pages bindings: `PUBLIC_MEDIA` and `PRIVATE_VAULT`.
- `PUBLIC_MEDIA_BASE_URL` matches the public bucket domain.

The buckets are provisioned, but application-level upload, record attachment, signed-link access and download still need authenticated end-to-end verification. Do not enable a public domain on the private vault. Do not change public website DNS for this staging setup.

## 2. Admin Pages and API

The Git-connected Pages project is configured with:
- Production branch: `erp-development` (this Pages project's production deployment is still the ERP staging environment).
- Root directory: `apps/admin-erp`
- Build command: `npm install --prefix ../../workers/api --no-save --no-package-lock --omit=dev && npm run build`
- Output directory: `dist`
- Preview deployments disabled.

The Admin frontend uses same-origin `/api/v1/*` requests. The Pages Function imports the tested Hono API from `workers/api/src/index.ts`. D1 and KV are bound. R2 bindings `PUBLIC_MEDIA` and `PRIVATE_VAULT` are configured for this Pages project; end-to-end use still requires testing.

Pages Function variables include:
- `ENVIRONMENT=staging`
- `PUBLIC_SITE_ORIGIN=https://pawshopessociety.pages.dev`
- `ADMIN_ERP_ORIGIN=https://phs-phs.pages.dev`
- `CF_ACCESS_TEAM_DOMAIN=mute-pond-e3e6.cloudflareaccess.com`
- `CF_ACCESS_AUD`: the Admin Pages Access app audience tag.
- `STAGING_BOOTSTRAP_ADMIN_EMAIL=hopezpaws@gmail.com`
- `SIGNED_URL_SECRET`: stored as a random secret of at least 32 bytes.
- `PUBLIC_MEDIA_BASE_URL=https://pub-3819e5d7af12440f8b190b69723b4dc4.r2.dev`.

Never commit or paste secrets into chat or Git.

## 3. Cloudflare Access and first Super Admin

The Access app allows only `hopezpaws@gmail.com`. Public path overrides are limited to `/api/v1/public/*`, nested public paths and `/api/v1/health`; admin paths remain protected.

First-login bootstrap endpoint:
`POST /api/v1/admin/bootstrap/super-admin`

It is staging-only, requires a verified Cloudflare Access JWT with the exact owner email, creates only the first active Super Admin, and records an audit entry. The frontend attempts this bootstrap when `/api/v1/admin/me` reports that the authenticated email has no ERP user record.

Owner verification:
1. Open [https://phs-phs.pages.dev](https://phs-phs.pages.dev).
2. Sign in through Cloudflare Access using `hopezpaws@gmail.com` and complete the email verification challenge.
3. Confirm that the dashboard opens and displays the Super Admin role.
4. Report any error text or screenshot with tokens, codes and personal data hidden.

The staging D1 database currently has two active Super Admin accounts, including the configured owner email. The owner already has the required ERP role, so first-admin bootstrap is not required for that account. Do not create a public registration path or create duplicate Super Admin accounts.

## 4. Approved-member Cloudflare Access synchronisation

The Join Management API now attempts to add only the exact email of an approved applicant to the existing Allow policy. It reads the current policy, preserves the existing narrow email rules, refuses to modify a non-Allow policy or a policy containing broad Everyone/domain/service-token rules, and records sync status. A Super Admin can retry failed/pending syncs from Join Management. ERP approval remains separate from Access synchronisation: if Access sync is unavailable, the ERP account is active but the person cannot sign in until the Access step succeeds.

To enable automatic synchronisation on staging:
1. Create a Cloudflare API token restricted to this account with **Access: Apps and Policies Edit** permission. Do not use the Global API Key.
2. In Cloudflare Pages → `phs-phs` → Settings → Environment variables → Production (the Pages project's production deployment is the ERP staging environment), add `CF_ACCESS_API_TOKEN` as an encrypted secret.
3. Redeploy the `erp-development` branch so the Pages Function receives the secret.
4. Test with a controlled test applicant email. Verify the exact email is appended to policy `3fe62b03-bb97-47d3-8839-02001fee7ce0`, the existing owner email remains, and Join Management reports `synced`.
5. Remove the test member from the Access policy and disable/revoke the temporary test account after verification.

Never paste the API token into chat, GitHub, source code, plain-text variables, or logs. If the secret is absent or the API token lacks permission, the UI will retain a pending/failed status and provide the manual fallback.

Migration `0009_access_sync_status.sql` adds persistent sync status/error/timestamp fields. It has been applied to staging D1 after a SQL export snapshot.

## 5. Smoke tests required before operational use

1. Unauthenticated Admin requests redirect to Cloudflare Access.
2. Public animal/join/health endpoints bypass Access only on explicit public path overrides.
3. Admin API rejects missing, invalid, expired and wrong-audience Access JWTs.
4. Owner login bootstraps exactly one Super Admin and `/api/v1/admin/me` returns `roleCode=super_admin`.
5. A different email is denied by Access and the API.
6. D1, KV, public-media and private-vault bindings report their actual readiness.
7. Animal, rescue, medical, adoption, finance, inventory, volunteer and CMS workspaces load with correct permissions.
8. Donation verification and expense posting create one balanced ledger transaction only.
9. Stock approval updates on-hand quantity; insufficient stock is rejected.
10. Audit events, document upload/download, CORS, rate limits, backups and restore are tested.
11. Public website and its existing animal listings remain unchanged.

Do not enter real donor, medical, financial or volunteer records until staging UAT, security checks and backup/restore rehearsal pass.

## 6. R2 bucket configuration now in place

- `pawshopes-public-media-staging` — APAC, Standard; managed `r2.dev` URL enabled for staging testing only.
- `pawshopes-private-vault-staging` — APAC, Standard; remains private with no public endpoint.
- Pages bindings: `PUBLIC_MEDIA` and `PRIVATE_VAULT` configured on the `phs-phs` production deployment environment (which is the staging environment for this project).
- Public media base URL: `https://pub-3819e5d7af12440f8b190b69723b4dc4.r2.dev`.
- Bucket bindings take effect only after a new Pages deployment. Test actual upload and private signed download after deployment.

## 7. Production remains out of scope

No production D1, KV, R2, production Access app, production secret set or production deployment has been approved. Do not merge the ERP PR, deploy production, change DNS, or point the public website at the staging API without separate explicit approval.
