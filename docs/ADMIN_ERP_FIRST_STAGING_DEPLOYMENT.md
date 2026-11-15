# Paw's Hopez Society Admin ERP — staging deployment runbook

This runbook is staging-only. It must not change the public website, the existing public Pages project, the `main` branch, or production data.

## Current verified infrastructure

- Admin Pages project: `phs-phs`
- Admin URL: `https://phs-phs.pages.dev`
- Source: `PawsHopes/pawshopessociety`, branch `erp-development`
- Pages root: `apps/admin-erp`
- Build: `npm run build`; output: `dist`
- Cloudflare Access app exists for `phs-phs.pages.dev`, allowing only `hopezpaws@gmail.com`
- Zero Trust team: `mute-pond-e3e6.cloudflareaccess.com`
- Staging D1 database: `pawshopes-erp-db-staging` (`a6fd7136-b618-4072-af6a-5373f4e727d1`)
- Staging KV namespace: `pawshopes-erp-rate-limit-staging` (`1156cf04f6b9496dabc7d580457f0c53`)
- All five migrations have been applied to staging D1. Reference roles/permissions, finance categories/accounts with a non-live placeholder bank account, compliance placeholders, and 15 migrated public animal listings have been seeded.
- R2 is not enabled on the Cloudflare account yet. The two staging buckets do not exist.
- The API is mounted through a same-origin Cloudflare Pages Function at `apps/admin-erp/functions/api/[[path]].ts`, reusing the tested Worker/Hono implementation. The Pages Function build and browser smoke tests are still pending.

## 1. Staging storage

After enabling R2 in the Cloudflare dashboard, create:
- `pawshopes-public-media-staging` — public media only.
- `pawshopes-private-vault-staging` — private documents; never enable public access.

Bind these to `PUBLIC_MEDIA` and `PRIVATE_VAULT`. Configure the public media origin only after the public bucket's URL/domain has been verified. Do not use a production bucket.

The D1 and KV IDs above are already bound in `workers/api/wrangler.toml`. The actual config intentionally has no production environment.

## 2. Admin Pages

The Git-connected Pages project is already configured with:
- Production branch: `erp-development`
- Root directory: `apps/admin-erp`
- Build command: `npm run build`
- Output directory: `dist`
- Preview deployments disabled.

The Admin frontend uses same-origin `/api/v1/*` requests, served by the Pages Function. No cross-origin API base URL is required. The Pages production deployment config has the staging D1/KV bindings and environment variables. Do not set `VITE_DEV_USER_EMAIL` in any hosted environment.

## 3. Pages Function API

The Pages Function imports the same tested Hono API from `workers/api/src/index.ts`. Pages project production bindings are configured for staging (the Pages project's production environment is the staging deployment). D1 and KV are bound; R2 is intentionally omitted until enabled. The API returns explicit 503 storage responses until R2 bindings exist.

Required Pages Function configuration:
- `ENVIRONMENT=staging`
- `PUBLIC_SITE_ORIGIN=https://pawshopessociety.pages.dev`
- `ADMIN_ERP_ORIGIN=https://phs-phs.pages.dev`
- `CF_ACCESS_TEAM_DOMAIN=mute-pond-e3e6.cloudflareaccess.com`
- `CF_ACCESS_AUD`: the audience tag of the Admin Pages Access app (`b93203823e0d4aae22bc961e5d9d1451ca38605e48d788b4bddccdc7c5418316`).
- `STAGING_BOOTSTRAP_ADMIN_EMAIL=hopezpaws@gmail.com`
- `PUBLIC_MEDIA_BASE_URL`: set only to the verified staging public-media origin.

Set `SIGNED_URL_SECRET` as a Pages Function secret using a cryptographically random value of at least 32 bytes. Never commit or paste secrets into chat or Git.

The existing Access application protects the Admin hostname and allows only the exact owner email. Its destination overrides explicitly leave `/api/v1/public/*` and `/api/v1/health` public; all admin API paths remain protected by Access and API JWT verification.

## 4. First Super Admin

A one-time bootstrap route now exists at `POST /api/v1/bootstrap/super-admin`. It is:
- available only when `ENVIRONMENT=staging`;
- protected by Cloudflare Access JWT validation;
- restricted to the exact `STAGING_BOOTSTRAP_ADMIN_EMAIL`;
- blocked once an active Super Admin exists;
- recorded in the audit log.

The Admin frontend attempts this bootstrap only when the verified Access identity has no ERP user record. No public registration or development bypass is enabled in staging.

## 5. Smoke tests required before use

1. Unauthenticated requests to `phs-phs.pages.dev` and its admin API are redirected to Access login.
2. Public animal/join/health endpoints bypass Access only on the explicit public path overrides.
3. API admin requests reject missing, invalid, expired and wrong-audience Access JWTs.
4. The owner can call `/api/v1/admin/me` and receives `roleCode=super_admin`.
5. A different email is denied by both Access and the API.
6. Dashboard health reflects staging D1/API only.
7. Animal, rescue, medical, adoption, finance, inventory, volunteer and CMS workspaces load with the correct permissions.
8. Donation verification and expense posting create one balanced ledger transaction only.
9. Stock approval updates on-hand quantity; insufficient stock is rejected.
10. Audit events, document upload/download, CORS, rate limits, backups and restore are tested.
11. The public website and its existing animal listings remain unchanged.

Do not enter real donor, medical, financial or volunteer records until the full staging test and backup/restore checks pass.

## 6. Production remains out of scope

Do not merge the ERP PR, deploy production, change DNS, or point the public website at the staging API without a separate explicit approval. The current work is staging development, not a production release.
