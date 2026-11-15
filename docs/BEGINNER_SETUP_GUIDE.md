# Beginner-Safe Setup & GitHub Upload Guide (Zero Risk to Live Website)

## Golden Rule: Your Live Website Will NEVER Break If You Follow This Order
Your live website (`https://pawshopessociety.pages.dev`) is connected ONLY to the **`main`** branch on GitHub.
As long as we work on a separate branch called **`erp-dev`**, your live website remains 100% untouched.

## Step 1: Create the `erp-dev` Branch on GitHub (Takes 15 Seconds)
1. Open `https://github.com/PawsHopes/pawshopessociety` in your browser.
2. Near the top-left of the file list, click the dropdown button that says **`main`**.
3. Type **`erp-dev`** into the box and click **`Create branch: erp-dev from main`**.
4. Verify the top-left dropdown now says **`erp-dev`**.

## Step 2: What Files Are Inside This Phase 3 Package?
When you extract `pawshopessociety-phase3-foundation.zip`, you will see ONLY new folders and `.gitignore`:
- `.gitignore` (protects secret keys from ever being uploaded to GitHub)
- `database/` (SQLite/D1 table migrations and initial roles/accounts/animals seed files)
- `workers/api/` (Cloudflare Workers REST API backend with Auth, RBAC, R2 storage, and tests)
- `apps/admin-erp/` (React + TypeScript Admin Dashboard foundation)
- `scripts/` (Animal data migration script)
- `docs/` (Architecture, Database, Security, and Setup guides)

**Notice:** None of your existing HTML files (`index.html`, `adopt.html`, `donate.html`, etc.) or `assets/` folders are touched or overwritten in Phase 3!

## Step 3: How to Upload Safely to the `erp-dev` Branch
### Option A: Using GitHub Desktop (Recommended for Beginners — Visual & Easy)
1. Download & open **GitHub Desktop**, sign in, and clone `PawsHopes/pawshopessociety`.
2. At the top bar, set **Current Branch** to **`erp-dev`** (NOT `main`).
3. Extract `pawshopessociety-phase3-foundation.zip` directly into your local `pawshopessociety` folder (allow it to replace the empty `.gitignore`).
4. In GitHub Desktop, you will see the new files listed on the left. Write commit summary `feat: add phase 3 ERP foundation` and click **Commit to erp-dev**, then **Push origin**.

### Option B: Using Git Terminal
```bash
git checkout -b erp-dev
# Extract pawshopessociety-phase3-foundation.zip into the repository root
git add .
git commit -m "feat: add phase 3 ERP foundation (D1 schema, Workers API, Admin ERP)"
git push -u origin erp-dev
```
