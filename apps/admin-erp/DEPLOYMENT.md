# Admin ERP deployment notes

The `pha-phs` Pages project serves the production Admin ERP.

- Production branch: `erp-development`
- Pages Functions API route: `functions/api/[[path]].ts`
- API connection: the Pages production service binding `ERP_API` targets the production `pawshopes-erp-api` Worker.
- The API Worker owns the production D1, R2, KV, and signed-URL secret bindings.
- The Pages Function forwards the Cloudflare Access JWT assertion to the API Worker and does not forward the browser's Access session cookie.
- Production access is restricted by Cloudflare Access to the two designated Society Super Admin accounts.

Do not bind the Pages Function directly to the production database or storage. Keep production data resources on the API Worker.


## Controlled production release

The ERP CI workflow runs staging deployment, same-origin API/Access smoke tests, private-file protection checks, and synthetic animal/CMS publishing verification before it can deploy the production ERP Worker and apply production migrations. A release commit on `erp-development` must include `[deploy-production]` in its commit message to authorize that one-time production rollout. The read-only production website and ERP smoke tests run after the production deployment.
