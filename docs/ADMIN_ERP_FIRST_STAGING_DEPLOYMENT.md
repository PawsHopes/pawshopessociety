# Paw's Hopez Society Admin ERP — staging deployment runbook

This runbook is staging-only. It must not change the public website, the existing public Pages project, the `main` branch, or production data.

## Current verified staging state (15 November 2026)

- Admin Pages project: `phs-phs`
- Admin URL: `https://phs-phs.pages.dev`
- Source: `PawsHopes/pawshopessociety`, branch `erp-development`
- Pages root: `apps/admin-erp`
- Build command: `npm install --prefix ../../workers/api --no-save --no-package-lock --omit=dev && npm run build`
- Output directory: `dist`
- Latest confirmed successful Pages deployment: commit `6c456fe830e79124f6cefa1b654de85243a7ba09`
- ERP CI and Security Analysis passed for that commit: frontend build, Worker API checks, migration validation, CodeQL and secret scanning.
- Cloudflare Access app protects `phs-phs.pages.dev` and currently allows only `hopezpaws@gmail.com`.
- Zero Trust team: `mute-pond-e3e6.cloudflareaccess.com`
- Staging D1: `pawshopes-erp-db-staging` (`a6fd7136-b618-4072-af6a-5373f4e727d1`)
- Staging KV: `pawshopes-erp-rate-limit-staging` (`1156cf04f6b9496dabc7d580457f0c53`)
- All five migrations are applied. The database currently has 15 animal records, 7 compliance records and no ERP users. Review existing seed/migrated records before operational use; do not delete or overwrite records without confirming their origin.
- A random `SIGNED_URL_SECRET` has been generated and stored as a Pages secret. A new deployment is required before relying on that configuration.
- R2 is now activated. Two APAC staging buckets exist: `pawshopes-public-media-staging` (public development URL enabled: `https://pub-3819e5d7af12440f8b190b69723b4dc4.r2.dev`) and `pawshopes-private-vault-staging` (private; no public domain). Pages production deployment config has `PUBLIC_MEDIA` and `PRIVATE_VAULT` R2 bindings, and `PUBLIC_MEDIA_BASE_URL` is set to the public development URL. A new Pages deployment is required before the running Function receives the bindings.
- The Pages Function at `apps/admin-erp/functions/api/[[path]].ts` serves the same Hono API on the Admin hostname. The latest Pages build and deployment completed successfully.
- Interactive browser login and authenticated end-to-end smoke tests are not yet confirmed.

## 1. R2 staging storage — owner action required

The Cloudflare account currently returns zero R2 buckets. The account owner must first activate the R2 subscription in Cloudflare Dashboard:

1. Open [Cloudflare R2 Overview](https://dash.cloudflare.com/?to=/:account/r2/overview).
2. Select **Storage & databases → R2 → Overview**.
3. Complete the R2 subscription checkout. Cloudflare includes a free monthly usage allowance, but usage beyond included limits is billable; review current pricing before confirming.
4. Tell the implementation operator when R2 is enabled. Do not send payment details or API credentials in chat.

After activation, provision only staging buckets:
- `pawshopes-public-media-staging` — approved public animal/site media only.
- `pawshopes-private-vault-staging` — private veterinary, adopter, donor and compliance documents; never enable public access.

Bind them to the Pages Function as `PUBLIC_MEDIA` and `PRIVATE_VAULT`. The public-media bucket uses its Cloudflare-managed `r2.dev` URL for staging only. The private vault has no public domain. The Cloudflare account currently has no DNS zone for `pawshopessociety.org`, so a branded media custom domain cannot be attached from this account. Do not change existing website DNS to solve this.

## 2. Admin Pages and API

The Git-connected Pages project is configured with:
- Production branch: `erp-development` (this Pages project's production deployment is still the ERP staging environment).
- Root directory: `apps/admin-erp`
- Build command: `npm install --prefix ../../workers/api --no-save --no-package-lock --omit=dev && npm run build`
- Output directory: `dist`
- Preview deployments disabled.

The Admin frontend uses same-origin `/api/v1/*` requests. The Pages Function imports the tested Hono API from `workers/api/src/index.ts`. D1 and KV are bound. R2 bindings must be added after the owner activates R2 and the two buckets are created.

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

The D1 database currently has zero ERP users, so the bootstrap has not yet run. Do not create a public registration path for Super Admin.

## 4. Smoke tests required before operational use

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

## 5. R2 bucket configuration now in place

- `pawshopes-public-media-staging` — APAC, Standard; managed `r2.dev` URL enabled for staging testing only.
- `pawshopes-private-vault-staging` — APAC, Standard; remains private with no public endpoint.
- Pages bindings: `PUBLIC_MEDIA` and `PRIVATE_VAULT` configured on the `phs-phs` production deployment environment (which is the staging environment for this project).
- Public media base URL: `https://pub-3819e5d7af12440f8b190b69723b4dc4.r2.dev`.
- Bucket bindings take effect only after a new Pages deployment. Test actual upload and private signed download after deployment.

## 6. Production remains out of scope

No production D1, KV, R2, production Access app, production secret set or production deployment has been approved. Do not merge the ERP PR, deploy production, change DNS, or point the public website at the staging API without separate explicit approval.
