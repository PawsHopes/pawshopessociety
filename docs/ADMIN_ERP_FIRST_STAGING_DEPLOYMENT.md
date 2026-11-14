# Admin ERP first staging deployment

This runbook deploys the Admin ERP as a separate Cloudflare Pages project and the API as a staging Worker. It does not change the public website, the existing Pages project, the `main` branch, or production data.

## Current status

The React Admin ERP source is in `apps/admin-erp`. The API expects Cloudflare Access JWT authentication, a staging D1 database, staging R2 buckets, a staging KV namespace, and Worker secrets. The repository's `workers/api/wrangler.toml.example` contains placeholders, not usable Cloudflare resource IDs. A working admin URL must not be advertised until the steps below are completed and smoke-tested.

## 1. Create isolated staging resources in Cloudflare

In the Cloudflare dashboard, create:
- A new Pages project named `pawshopes-admin-erp-staging`, connected to this repository. Set the production branch to `erp-development`, root directory to `apps/admin-erp`, build command to `npm run build`, and output directory to `dist`.
- A separate staging D1 database named `pawshopes-erp-db-staging`.
- Separate staging R2 buckets named `pawshopes-public-media-staging` and `pawshopes-private-vault-staging`.
- A staging KV namespace for `RATE_LIMIT_KV`.

Do not reuse production databases, buckets, KV namespaces, or the existing public Pages project.

## 2. Configure the Admin Pages build

Set the Pages environment variable:
- `VITE_API_BASE_URL`: the HTTPS origin of the staging API Worker (for example, the Worker custom domain you configure in the next section).

Do not set `VITE_DEV_USER_EMAIL` in any hosted Pages environment. That header is a local-development-only escape hatch and must never be used for staging or production.

## 3. Configure the staging API Worker

Create a staging Worker using `workers/api/wrangler.toml.example` as a reference, replacing every placeholder with the real staging resource IDs. Keep `ENVIRONMENT=staging`. Configure:
- `PUBLIC_SITE_ORIGIN`: the existing public site's exact origin.
- `ADMIN_ERP_ORIGIN`: the exact HTTPS origin of the new Admin Pages project.
- `CF_ACCESS_TEAM_DOMAIN`: the Cloudflare Zero Trust team domain.
- `PUBLIC_MEDIA_BASE_URL`: the staging media origin.

Bind the staging D1, both staging R2 buckets, and staging KV namespace. Apply the repository's D1 migrations to the staging database and verify them before testing.

Set Worker secrets using the Cloudflare dashboard or Wrangler secrets (never commit them):
- `CF_ACCESS_AUD`: the Access application's audience tag.
- `SIGNED_URL_SECRET`: a cryptographically random secret of at least 32 bytes.
- Any other required integration secrets only when those integrations are actually enabled.

## 4. Restrict access to the owner

Create a Cloudflare Access self-hosted application for the exact Admin Pages hostname. Configure a default-deny policy that allows only the President's verified email address. Require a strong authentication method and a short session lifetime. Do not create an allow-all or email-domain-wide policy.

The API's first-user bootstrap is deliberately development-only. It cannot create a staging Super Admin. For the first staging account, insert the owner as an active `role_super_admin` user using a reviewed, one-time staging-only database operation after confirming the email matches the Access allowlist. Never expose a public registration route or enable development bootstrap in staging/production. Record the bootstrap in the staging change log and remove any temporary credentials or scripts afterwards.

## 5. Smoke-test before using

Verify all of the following from a browser signed in through Cloudflare Access:
1. Unauthenticated requests to the Admin hostname are redirected to Access login.
2. The staging API rejects missing, invalid, expired, and wrong-audience Access JWTs.
3. The owner's email can call `/api/v1/admin/me` and receives `roleCode=super_admin`.
4. A different email is denied by Access and by the API.
5. Dashboard health reflects the staging D1/API only.
6. Users, join requests, and audit log screens load and enforce RBAC.
7. Public website and public animal listing remain unchanged.
8. No real donor, animal medical, volunteer, or financial data is entered until backups, restore, audit consistency, and the relevant module workflows have been validated.

## 6. Do not promote to production yet

The remaining ERP modules (animal registry, rescue cases, veterinary, adoptions, donations/ledger, inventory, volunteers, and website CMS) are roadmap placeholders. This staging foundation is not a complete operational NGO ERP. Keep the existing PR unmerged and do not point the live website at this staging API.
