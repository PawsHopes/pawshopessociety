# Paw's Hopez Society deployment environments

| Purpose | URL | Data environment |
|---|---|---|
| Public production website | https://pawshopessociety.pages.dev | Production D1 |
| Admin ERP staging | https://phs-phs.pages.dev | Isolated staging D1 |
| Public website staging | https://pawshopes-public-staging.pages.dev | Same isolated staging D1 |
| Planned Admin ERP production | https://pha-phs.pages.dev | Production D1; not deployed yet |

## Safe testing workflow

1. Sign in to Admin ERP staging through Cloudflare Access using the designated bootstrap administrator.
2. The one-time staging bootstrap creates both trusted Super Admin accounts with the same `super_admin` role.
3. Create or edit test animals in staging, complete the public description and eligibility/status fields, then explicitly publish.
4. Verify the animal on the public staging adoption or rescue page.
5. Test CMS blocks and drag-and-drop ordering on staging before production migration/deployment.

Staging and production use separate D1 databases. Staging edits must never be expected to appear on the public production site.

## Production release gate

The production Admin ERP URL and public CMS renderer are held until staging acceptance, production D1 backup/rollback checkpoint, and the production schema migration have been completed and verified. The production public animal feed is read-only and already uses published production animal records.
