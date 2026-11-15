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
- The API Worker is not deployed. Do not call the Admin portal operational until the Worker, bindings, Access path, bootstrap and browser smoke tests are complete.

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

Set `VITE_API_BASE_URL` only after the staging API Worker has a verified HTTPS origin and an Access-protected admin API path. Do not set `VITE_DEV_USER_EMAIL` in any hosted environment.

## 3. API Worker

Use `workers/api/wrangler.toml` for staging. It binds the existing staging D1 and KV and expects the two staging R2 buckets. Build and type-check through the ERP CI workflow before deploying.

Required Worker configuration:
- `ENVIRONMENT=staging`
- `PUBLIC_SITE_ORIGIN=https://pawshopessociety.pages.dev`
- `ADMIN_ERP_ORIGIN=https://phs-phs.pages.dev`
- `CF_ACCESS_TEAM_DOMAIN=mute-pond-e3e6.cloudflareaccess.com`
- `CF_ACCESS_AUD`: the audience tag for the API-host Access application (not assumed to be the Admin Pages app's audience).
- `STAGING_BOOTSTRAP_ADMIN_EMAIL=hopezpaws@gmail.com`
- `PUBLIC_MEDIA_BASE_URL`: set only to the verified staging public-media origin.

Set `SIGNED_URL_SECRET` as a Worker secret using a cryptographically random value of at least 32 bytes. Never commit or paste secrets into chat or Git.

The Worker API must have an Access application for its own admin API path, using the same exact owner email allowlist. Public API endpoints must remain publicly reachable; do not protect the entire API hostname if that would block public animal and join endpoints.

## 4. First Super Admin

A one-time bootstrap route now exists at `POST /api/v1/bootstrap/super-admin`. It is:
- available only when `ENVIRONMENT=staging`;
- protected by Cloudflare Access JWT validation;
- restricted to the exact `STAGING_BOOTSTRAP_ADMIN_EMAIL`;
- blocked once an active Super Admin exists;
- recorded in the audit log.

The Admin frontend attempts this bootstrap only when the verified Access identity has no ERP user record. No public registration or development bypass is enabled in staging.

## 5. Smoke tests required before use

1. Unauthenticated requests to `phs-phs.pages.dev` are redirected to Access login.
2. API admin requests reject missing, invalid, expired and wrong-audience Access JWTs.
3. The owner can call `/api/v1/admin/me` and receives `roleCode=super_admin`.
4. A different email is denied by both Access and the API.
5. Dashboard health reflects staging D1/API only.
6. Animal, rescue, medical, adoption, finance, inventory, volunteer and CMS workspaces load with the correct permissions.
7. Donation verification and expense posting create one balanced ledger transaction only.
8. Stock approval updates on-hand quantity; insufficient stock is rejected.
9. Audit events, document upload/download, CORS, rate limits, backups and restore are tested.
10. The public website and its existing animal listings remain unchanged.

Do not enter real donor, medical, financial or volunteer records until the full staging test and backup/restore checks pass.

## 6. Production remains out of scope

Do not merge the ERP PR, deploy production, change DNS, or point the public website at the staging API without a separate explicit approval. The current work is staging development, not a production release.
