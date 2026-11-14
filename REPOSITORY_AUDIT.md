# REPOSITORY_AUDIT.md — Paws Hopes Society Website

| | |
|---|---|
| Version | 0.1 (PARTIAL) |
| Date | 14 Nov 2026 |
| Status | Awaiting source-code access to complete |

---

## 0. Scope and limitations (read first)

**What was inspected**

- The live production site at `https://pawshopessociety.pages.dev`, as served HTML, for these pages: `/`, `/adopt`, `/donate`, `/rescue`, `/volunteer`.
- Current published Cloudflare pricing and limits (see ARCHITECTURE.md §10).

**What was NOT inspected**

- **The GitHub repository source.** Every attempt to fetch `github.com/PawsHopes/pawshopessociety` returned a rate-limit error.
- The following were therefore not read:
  - `assets/data/animals.js`, `assets/js/script.js` and `assets/css/style.css`.
  - Any `_headers`, `_redirects`, `wrangler.toml`/`wrangler.jsonc` or `.github/` workflows.
  - The Tally embed code.
  - Git history.
- The pages `/about`, `/gallery` and `/contact`.
- The Cloudflare Pages dashboard: build command, output directory, environment variables and custom domains.

**Everything tagged [VERIFY] must be confirmed against the source before Phase 3 begins.**

**To complete this audit I need one of the following:**

1. A ZIP of the repository, including hidden files. In GitHub: Code → Download ZIP. Hidden files such as `_headers` and `.github/` are included in that download.
2. Repository access through Claude Code, which can clone the repo, run a secrets scan over the full history and open PRs.

I also need a screenshot of **Cloudflare dashboard → Workers & Pages → (project) → Settings → Build**.

---

## 1. How the existing website works (observed)

### 1.1 Hosting and URLs

- **Hosting.** Static multi-page site on Cloudflare Pages.
- **URL handling.** Pages serves extensionless URLs, so a request for `/adopt.html` resolves to `/adopt`. All internal links point at `.html` URLs. **Both forms must keep working after any change.** This is Pages' default behaviour and must not be broken by new routing.

### 1.2 Pages

| Page | Observed behaviour |
|---|---|
| Home | Hero with tagline and helplines. "Shelter Photo Coming Soon" placeholder. Animated counters render as `0` in the static HTML and are filled in by JS. Teaser for adoptable animals. |
| About | Not inspected. |
| Rescue | Species list and helpline. The "Report An Animal In Distress" form body is **not present in the static HTML**. It is injected by script or iframe, consistent with a Tally embed [VERIFY]. |
| Adopt | Species and gender filters, cards, modal gallery, adopted success stories. **All rendered client-side** from `animals.js`. Without JS, the page reads "No animals match this filter right now." The "Inquire / Apply via WhatsApp" link is `#` until JS sets it. |
| Donate | Amazon wishlist links, impact tiers, UPI QR image (`assets/images/donation-qr.png`), and the UPI ID (blank in static HTML, injected by JS). Also shows **full bank account details**, the monthly-sponsor (UPI Autopay) text, an FAQ stating **no 80G**, and an in-kind donation note. |
| Gallery | Not inspected. |
| Volunteer | Benefits list. The registration form body is not in the static HTML (likely Tally [VERIFY]). |
| Contact | Not inspected. |

### 1.3 Shared elements

Every page shares the following:

- Skip link.
- Navigation and footer markup.
- Google Translate widget ("Translate Site").
- Helplines.
- Social links.
- A static string "Visitors: 110,520".

### 1.4 Technologies and dependencies (observed)

- Vanilla HTML, CSS and JavaScript. No build step was evident [VERIFY].
- **Third-party runtime code:**
  - Google Translate widget.
  - Probably Tally embeds [VERIFY].
  - Possibly Google Fonts or icon CDNs [VERIFY].
- **External links:** Amazon.in wishlist, Instagram, YouTube, WhatsApp, `tel:` links.
- **Data:** hardcoded in `assets/data/animals.js`, according to the brief.

---

## 2. Data and content integrity findings (need organisational confirmation)

These are not code bugs. The ERP will make these values **authoritative and audited**, so they must be settled first.

| # | Finding | Where | Why it matters |
|---|---|---|---|
| D1 | **Organisation name is inconsistent.** The brief says "Paw's Hopez Society", the website says "Paws Hopes Society" and the bank account name is "Paws Hopez Society". | Brief, all pages, donate page | Donation receipts, agreements and compliance exports must carry the **exact registered legal name**. |
| D2 | **Registration year is inconsistent.** The home page says "Founded in 2020 and officially registered"; the donate page says "registered NGO (since 2022)". | Home, Donate | Public statements should match the registration certificate. |
| D3 | **Animal count is inconsistent.** The brief says 35–40; the donate page says 44, twice. | Donate | This will become a live figure computed from the animal registry. |
| D4 | **"Rescued over 237 animals" has no recorded source.** | Donate | This becomes a CMS statistic with an owner and a last-verified date. |
| D5 | **The visitor counter "110,520" is in the static HTML of every page.** It shows the same value everywhere. | All pages | [VERIFY] whether JS updates it. If the number is hardcoded, it is misleading and should be removed or replaced with real figures from Cloudflare Web Analytics (free). |
| D6 | **The 80G statement is correct and consistent with the brief.** | Donate FAQ | The ERP will default every receipt to *not 80G-eligible* until a verified registration is recorded. |
| D7 | **Bank and UPI details are published.** | Donate | This is normal for an NGO, but changing them is the single most damaging fraud vector, because it redirects donations. They will become CMS fields that need **two-person approval** and are audit-logged. |
| D8 | **The home hero still shows a placeholder.** | Home | Content task for the CMS. |

---

## 3. Technical findings

| # | Area | Finding | Severity | Proposed action |
|---|---|---|---|---|
| T1 | SEO | Adoptable animals exist only in JS, so crawlers that don't run JS see none. | Medium | In Phase 6, render animal cards on the server with a Pages Function + HTMLRewriter, with JS as progressive enhancement. |
| T2 | SEO | Sub-pages show only `<title>` and the viewport meta. No meta description or canonical tag was observed [VERIFY]. | Low | Add meta descriptions, canonical URLs and Open Graph tags. These become CMS-managed. |
| T3 | Security | Security headers (CSP, HSTS, X-Frame-Options and others) could not be checked [VERIFY `_headers`]. | Medium | Add a `_headers` file. The CSP must allow Google Translate and Tally. |
| T4 | Security | Third-party scripts (Google Translate, Tally) run with full page privileges. | Low–Medium | Pin them with a CSP. Replace Tally with native forms once the API exists. |
| T5 | Secrets | No secrets scan has been run. | Unknown | Run `gitleaks` over the **full git history** before any ERP work merges. A public repo exposes history too. |
| T6 | Privacy | Rescue reports and volunteer applications (names, phone numbers, addresses) are currently held by Tally, a third party [VERIFY]. | Medium | Decide on retention. Import existing submissions into the ERP, then purge them from Tally if appropriate. |
| T7 | Integrity | Payment details live in static files that anyone with repo or deploy access can change silently. | Medium | Enable branch protection and require PRs. Turn on 2FA for all GitHub and Cloudflare accounts. Payment details move to the audited CMS. |
| T8 | Hosting | If the Pages output directory is the repo root (likely, since there is no build step [VERIFY]), **any new folder added to the repo becomes publicly downloadable**. That would include `apps/`, `migrations/` and `docs/`. | **High for the ERP plan** | Move the public site into `apps/public/` and point the Pages output directory there. Test on a preview branch first. See ARCHITECTURE.md §4. |
| T9 | Accessibility | Positive: skip link and alt text on the logo and QR image. | — | Keep these. Run an axe audit in Phase 7. |

---

## 4. What can be reused

The following are reused **as-is**:

- All eight HTML pages, the stylesheet, logo, images, QR code and branding colours.
- The URL structure.
- The helpline and contact details.
- The Amazon wishlist links.
- The Google Translate widget, subject to CSP.
- The `animals.js` data, as the **seed source** for the animals table (DATABASE_SCHEMA.md §9).
- The existing UX patterns: filter chips, card grid, modal gallery, WhatsApp enquiry.

---

## 5. What must change (minimal-footprint principle)

| Current | Change | Phase |
|---|---|---|
| `animals.js` hardcoded | The page fetches `/api/public/animals`, keeping the bundled JS as an offline fallback until cut-over is validated. | 6 |
| Hardcoded counters and statistics | Served from `/api/public/stats`, sourced from the CMS and the registry. | 6 |
| Tally forms | Native forms posting to `/api/public/forms/*` with Turnstile. Tally stays live during transition (§3 T6). | 6 |
| Payment details in HTML | Rendered from the CMS. Changes need two approvals. | 6 |
| No security headers [VERIFY] | Add `_headers`. | 3 |
| Repo root as output dir [VERIFY] | Move the site to `apps/public/` and set the output directory. | 3 |

---

## 6. Remaining audit checklist (once source access is available)

- [ ] Full file tree, including hidden files.
- [ ] `animals.js`: schema, field names, image paths. Check every referenced image exists.
- [ ] `script.js`: counters, filters, modal, WhatsApp link builder, UPI injection, visitor counter.
- [ ] Tally: form IDs, fields, whether webhooks are configured, and where submissions go.
- [ ] `_headers`, `_redirects` and any Functions directory.
- [ ] `.github/` workflows.
- [ ] Pages build settings: build command, output directory, branch, environment variables.
- [ ] `gitleaks detect` over the full history. Report any findings, with rotation steps.
- [ ] Lighthouse and axe run on all eight pages to set a performance and accessibility baseline.
- [ ] Inventory of every external domain loaded, used to draft the CSP.
