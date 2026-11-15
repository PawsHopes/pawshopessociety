# Paw's Hopez Society ERP — Security and Workflow Controls

## Primary administrator boundary

The only full ERP administrator is `hopezpaws@gmail.com`. This identity is fixed in the API; environment variables cannot transfer the primary-admin role to another address.

Secondary accounts carrying the database role `super_admin` receive read-only effective permissions. They can inspect permitted read views, but cannot:
- Create, edit, suspend, reactivate, promote, or demote ERP users.
- Approve/reject join applications, assign applicant roles, or grant Cloudflare Access sign-in.
- Create/revoke join links or retry Access synchronization.
- Write or approve animal, rescue, medical, adoption, foster, finance, donation, inventory, volunteer, CMS, or compliance records.
- Upload private documents or bypass document-category checks.

The API enforces these controls independently of the UI. The primary administrator's own account is protected against changes by secondary accounts.

## Animal lifecycle controls

- Public animal publishing uses a dedicated `animals:publish` permission and a dedicated endpoint; the generic animal editor cannot set the public-published flag.
- A reserved animal is hidden from the available-for-adoption public list.
- An adoption agreement can be created only for a home-check-passed, approved application and a reserved animal. The database trigger performs the handover, marks the animal adopted, updates the application to handover, and records status history.
- Foster activation requires an approved application and a foster-eligible animal. Database triggers move the animal to fostered and record history.
- Foster completion requires an actual end date; triggers return the animal to recovering status and restore foster eligibility.
- Direct creation or manual status edits cannot set an animal to adopted/fostered outside those workflows.
- Released and deceased status changes require rescue and medical write permissions respectively.

## CMS publishing

CMS content is versioned. Only draft versions can be edited; published and archived versions are immutable. Publishing a new draft archives the previous published version for the same page/section. The public content feed returns published records only.

The public website preview reads the staging D1 database through a read-only Pages Function. The binding is configured for preview deployments only; the production Pages configuration and `main` branch remain unchanged.

## Staging validation and deployment

The ERP Pages build runs Worker TypeScript checks and Vitest before the frontend build. The staging deployment workflow validates migrations and workflow triggers, applies pending staging D1 migrations, and only then deploys the staging API Worker.

Migration `0010_verified_animal_handover.sql` adds database-level adoption and foster lifecycle guards. It has been applied to the staging D1 database and exercised with temporary verification records that were removed after the checks.

## Production boundary

The current ERP deployment remains staging. Do not point production Pages, production D1, production R2, or production Access configuration at staging resources. Production go-live still requires separate production resources, backup/restore verification, authenticated end-to-end acceptance tests, and explicit release approval.
