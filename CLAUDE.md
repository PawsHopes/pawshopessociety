# CLAUDE.md — Paws Hopes Society ERP

Project instructions for Claude Code. Read this first in every session.

---

## Project

- **What:** an NGO ERP and admin dashboard for an animal-welfare NGO in Bakshi Ka Talab, Lucknow. The registered legal name is unconfirmed (see Q1 in `docs/IMPLEMENTATION_PLAN.md`).
- **Public site:** https://pawshopessociety.pages.dev. It is static HTML/CSS/JS on Cloudflare Pages and **must keep working unchanged**, including both `/page` and `/page.html` URLs.
- **Target stack:**
  - React, TypeScript, Vite, Tailwind and shadcn/ui for the admin app;
  - Hono on Pages Functions for the API;
  - Cloudflare D1 (Drizzle ORM, SQL migrations), R2 for files, Access for login and Turnstile for public forms.
- **Design documents** live in `docs/`. They are drafts awaiting the owner's approval:
  - REPOSITORY_AUDIT.md (partial)
  - ARCHITECTURE.md
  - DATABASE_SCHEMA.md
  - API_SPECIFICATION.md
  - SECURITY.md
  - IMPLEMENTATION_PLAN.md

---

## Current state

- **Phase 1 (repository audit) is PARTIAL.** It was done from the live site only. Finish it from source before anything else.
- **Phase 2 (design) is PROPOSED.** Decisions Q1–Q10 in IMPLEMENTATION_PLAN.md are still open.
- **No implementation has been approved yet.**

---

## First session: finish the audit, change nothing

1. **Map the repository.** List the full tree, including hidden files (`_headers`, `_redirects`, `functions/`, `.github/`, any wrangler config).
2. **Read the site's code.** Go through `assets/data/animals.js`, `assets/js/script.js` and every HTML page.
   - Document the animals.js data shape.
   - Check that every image path it references exists.
3. **Find the integrations.** Identify each Tally embed (form IDs and fields) and every external domain loaded, for the future CSP.
4. **Scan for secrets.**
   - Run `gitleaks detect` across the **full git history**.
   - Report any findings to the owner with rotation steps.
   - **Never print secret values.**
5. **Check the visitor counter.** Determine whether "Visitors: 110,520" is hardcoded or computed.
6. **Ask the owner** for the Cloudflare Pages build settings: build command, **output directory** and production branch. If the output directory is the repo root, every committed file, including `docs/`, is publicly served (REPOSITORY_AUDIT T8).
7. **Update REPOSITORY_AUDIT.md to v1.0** and resolve every [VERIFY] tag.
8. **Commit on a branch and open a PR** for the owner to review. The branch is `audit/source-review`.

---

## Hard rules (from the owner's master brief)

### Git and deployment

- Never push to `main`. Never change Cloudflare production settings. Never deploy to production without explicit written approval in the conversation.
- Work in small, testable PRs: `feature/*` → `staging` → `main`. Write meaningful commit messages.
- Do not delete or rewrite existing website files. Moving them requires approval (Q3) and a preview-branch test first.

### Data integrity

- Never fabricate organisational data: no animal records, medical history, donations, expenses, approvals or registrations.
- Seed and test data must be clearly synthetic and must never reach production.
- Never claim 80G, 12A, AWBI or FCRA status. Registration status is only ever recorded from documents the owner provides.
- Never delete data without a verified backup.

### Secrets and dependencies

- No secrets in code, the repo or frontend bundles. Use `wrangler pages secret put` and a git-ignored `.dev.vars`.
- No new dependency without a line in `docs/DECISIONS.md`. Verify Workers compatibility first and pin exact versions.

### Finance and security

- **Money** is stored as integer paise. Ledger, receipts, stock movements, approvals, history tables and the audit log are **append-only**: database triggers block UPDATE and DELETE, and corrections are made with reversal entries.
- **D1 has no interactive transactions.** Atomic multi-step writes go in `db.batch([...])`.
- **Authorisation is enforced server-side on every route.** Verify the Access JWT, check the user is active, then check the permission. Separation of duties: nobody approves their own submission, including the Super Admin.
- **Payments:** never trust a frontend "payment success". Only a verified Razorpay webhook creates a verified donation.

### Behaviour

- Ask the owner only when a real decision is needed. Otherwise make a safe, documented assumption.
