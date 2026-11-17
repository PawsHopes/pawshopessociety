# Paws Hopes Society Admin ERP — staging deployment runbook

This document describes the staging-only ERP setup and its verification procedure. It is not evidence that Cloudflare dashboard settings or interactive login have been verified today. Confirm live Cloudflare configuration independently before operational use.

## Safety boundary

- Work only on erp-development or an explicitly reviewed fix branch.
- Do not merge the ERP PR into main, deploy production, change DNS, alter production resources, or enter real NGO data without separate approval.
- Keep the existing public website and its production Pages project on main.
- Use synthetic test records only in staging. Remove only records created by the test itself.

## 1. Admin Pages request routing

The Admin frontend makes same-origin requests under /api/v1/*. The Pages Functions implementation must route all API paths through the single catch-all function:

apps/admin-erp/functions/api/[[path]].ts

That function imports and invokes workers/api/src/index.ts with the Pages environment bindings. Do not add a more-specific functions/api/v1/* proxy that forwards requests to a production Worker. Cloudflare Pages file-based routing gives more-specific function routes precedence over catch-all routes; such a file can silently bypass the staging Hono API.

Before deploying staging, verify:
1. /api/v1/admin/me is handled by the same-origin Pages Function and staging D1.
2. The Access JWT audience configured for the Admin Pages hostname is accepted by the API.
3. A staging request cannot reach the production Worker or production D1.
4. Unauthenticated requests are denied by Access; public exceptions are limited to explicitly documented public/health paths.

## 2. Code-declared staging resources

The source configuration is workers/api/wrangler.toml. Its env.staging declares:

- Worker: pawshopes-erp-api-staging
- D1 binding: DB → pawshopes-erp-db-staging-isolated
- R2 binding: PUBLIC_MEDIA → pawshopes-public-media-staging
- R2 binding: PRIVATE_VAULT → pawshopes-private-vault-staging
- KV binding: RATE_LIMIT_KV → staging rate-limit namespace
- Access team and audience variables for staging
- Public media base URL for the staging public-media bucket

These are repository-declared values, not proof that a Pages project or Worker currently has matching Cloudflare bindings. In Cloudflare, compare the actual Pages Function bindings, Worker bindings, environment variables and secret names with this file. Never print, commit or paste secret values.

Required secret names include CF_ACCESS_API_TOKEN (for approved-member Access-policy synchronisation where enabled) and SIGNED_URL_SECRET (private document signed links). Verify presence and configuration without exposing values.

Keep the private R2 vault private; do not enable a public bucket domain for it.

## 3. Designated Super Admin accounts

The two designated Society Super Admin identities are:

- hopezpaws@gmail.com
- infosecayush@gmail.com

Both must receive the same active role_super_admin role and the same full permission set. Neither account is a read-only or secondary administrator. Preserve equal permissions in backend authorization, account-management routes, UI controls, bootstrap logic and regression tests.

The bootstrap route must accept only a verified Cloudflare Access identity matching one of these exact email addresses, and must be repeatable without changing an existing account with a conflicting role or status. It must not grant Super Admin to arbitrary applicants.

For each account, verify:
1. Cloudflare Access login succeeds for the intended email.
2. GET /api/v1/admin/me returns that same email, roleCode=super_admin, active identity and full permissions.
3. Dashboard and user-management actions work.
4. Both accounts can manage the peer according to the same permission policy, while safeguards prevent removal/suspension of the last active designated administrator.
5. Audit events identify the actor correctly.

Do not infer successful interactive login from a D1 row or an Access policy alone.

## 4. Required staging browser acceptance tests

Run the following with synthetic data after API routing and Access configuration are aligned:

1. Open the stable Admin hostname in a clean browser session; verify Access login and denial for an unapproved identity.
2. Sign in separately as each designated Super Admin; verify /api/v1/admin/me identity and permissions.
3. Open the dashboard and all enabled workspaces.
4. Create, edit, view, publish, unpublish and archive a synthetic animal; verify adoption and rescue public feeds show only eligible published records.
5. Upload a synthetic public animal image and verify the record/media link.
6. Upload a synthetic private document; verify signed access and download are authorized and expiry is enforced.
7. Create and edit CMS drafts; publish/unpublish; verify the public content feed exposes published records only and ordering is preserved.
8. Exercise donation receipt immutability, financial ledger balancing, inventory approval/negative-stock prevention, adoption handover and foster lifecycle triggers.
9. Verify Join Management approval and Access synchronisation with a controlled test identity; remove that test identity afterwards.
10. Check audit logs, rate limits, CORS, error handling, and backup/restore rehearsal.

A successful build, Worker test suite, migration validation or deployment does not substitute for these authenticated browser tests.

## 5. Migration and deployment procedure

- Review every pending SQL migration and its compatibility with both the clean SQLite CI database and the isolated staging D1 schema.
- Run migration validation, foreign-key checks, integrity checks and workflow-trigger regression tests.
- Confirm the staging D1 target from workers/api/wrangler.toml before any remote migration.
- Take/verify an export or backup before applying staging migrations.
- Deploy only through an explicitly approved staging workflow. Do not use the production workflow input.
- Re-run the browser acceptance tests after deployment.

## 6. Public website publishing boundary

The live public website must remain on its existing production Pages project and main branch. Admin ERP publication must not be assumed to update the live adoption, rescue or CMS pages until the public feeds are proven to read from the intended data source.

Use a staging public-site preview or an explicitly controlled publishing/synchronisation mechanism for UAT. Verify animal and CMS visibility with synthetic records before considering any production publishing path.

## 7. Go-live gate

The Admin ERP is not approved for operational use until all of the following are verified:

- Separate Admin Pages URL responds and is protected by the intended Cloudflare Access policy.
- Both designated Super Admins can complete interactive Access login.
- /api/v1/admin/me returns the correct identity and full permissions for each account.
- Dashboard and critical module smoke tests pass.
- Private document upload/download and signed URL checks pass.
- Public adoption, rescue and CMS publishing paths are verified without changing existing production data.
- Current ERP CI, migration validation, CodeQL and secret scanning pass.
- Backup/restore and security review are complete.

Record the tested commit, deployment ID, workflow links, test evidence and unresolved limitations here after each approved staging UAT. Do not mark the portal usable based only on a successful Pages build or deployment.
