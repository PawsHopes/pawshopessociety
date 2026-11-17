# Admin ERP deployment notes

The `pha-phs` Pages project serves the production Admin ERP.

- Production branch: `erp-development`
- Pages Functions API route: `functions/api/[[path]].ts`
- API connection: the Pages production service binding `ERP_API` targets the production `pawshopes-erp-api` Worker.
- The API Worker owns the production D1, R2, KV, and signed-URL secret bindings.
- The Pages Function forwards the Cloudflare Access JWT assertion to the API Worker and does not forward the browser's Access session cookie.
- Production access is restricted by Cloudflare Access to the two designated Society Super Admin accounts.

Do not bind the Pages Function directly to the production database or storage. Keep production data resources on the API Worker.
