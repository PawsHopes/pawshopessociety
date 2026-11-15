# Security Policy

## Supported release

Security fixes are developed on the `erp-development` branch first. Do not treat a green CI run as approval to deploy an unreviewed change.

## Reporting a vulnerability

Please do not publish exploitable details in a public issue or discussion. Contact the repository owner privately through the contact method shown on the Society's official website or GitHub profile. Include:
- Affected URL, API route, or file.
- Impact and realistic attack prerequisites.
- Reproduction steps and sanitized evidence.
- Any suggested mitigation.

Do not include real donor, volunteer, adopter, staff, animal medical, identity, payment, or access-token data in reports.

## Security expectations

- Production admin access must be protected by Cloudflare Access with MFA and a narrowly scoped allow-list.
- Application authorization must be enforced by API-side RBAC; hiding a UI control is not authorization.
- Secrets must be stored in Cloudflare Worker secrets or GitHub Actions secrets, never in source files, commits, issues, or logs.
- Private documents must remain in a non-public R2 bucket and be served only through short-lived, user-bound links.
- Production rate limiting must use the configured KV binding and Cloudflare WAF/rate-limiting rules. The Worker KV counter is best-effort under concurrency and is not a substitute for edge enforcement.
- Financial and audit records must be append-only or corrected through explicit reversal workflows.
- Run the security and ERP CI workflows before every release.
