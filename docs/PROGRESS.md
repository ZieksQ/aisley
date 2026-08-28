# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:

```
## YYYY-MM-DD
- Feature/change short summary
```

---

## Status

Project is currently in the planning/documentation phase. No code has been implemented yet.

## 2026-08-27

- Added the initial Laravel API data layer with UUID-backed users and Sanctum tokens, role profiles, registration approvals and documents, addresses, admin permissions, courier vehicles, shops, and category models/migrations. Added PHP enum casts, model relationships, and integration coverage for UUID generation and schema constraints.
- Documented the implemented UUID schema in `docs/schema.md`, including relationships, exact columns and constraints, enum values, foreign-key behavior, framework key exceptions, application-enforced invariants, migration order, and deferred marketplace domains.
- PostgreSQL 18.3 validation applied the first 16 migrations but exposed a pending ordering bug in the self-referencing `categories.parent_id` foreign key. With a database-only ordering workaround, all 7 tests and 57 assertions passed; the repository migration still requires a code fix.
- Fixed the PostgreSQL category migration ordering by adding the self-referencing `parent_id` foreign key after the table and UUID primary key exist. A clean PostgreSQL 18.3 migration and the complete 7-test, 57-assertion suite now pass.
- Added admin-only Sanctum session authentication with CSRF protection, login throttling, active-status and role enforcement, session restoration/logout endpoints, and environment-backed initial-admin seeding. Replaced the static admin mock with a responsive React Router login flow and protected light/dark dashboard scaffold; the complete API suite, frontend lint, and production build pass.
- Fixed local admin authentication startup by aligning the API and Docker environment templates with PostgreSQL on port `5436`, adding complete local API configuration, generating the application encryption key, and initializing the database/admin account. Verified the Sanctum CSRF endpoint returns credentialed cookies successfully; native PHP additionally requires the `php-pgsql` extension.

## 2026-08-27

- Added versioned Customer authentication API endpoints for pending-approval registration, role- and status-gated web/mobile sign-in, current-user session restoration, session/device-token logout, and rate-limited password recovery. Added role-scoped reset-token storage, Customer middleware/resources/notifications, storefront Sanctum/CORS configuration, and feature coverage for role isolation, approval states, credential issuance, and reset-token security; all 24 API tests and 191 assertions pass.

## 2026-08-27

- Added responsive, API-integrated Customer authentication pages for registration, approval/rejection states, session sign-in, and password recovery/reset. Added reusable form primitives through the new `@aisley/ui` workspace package, React Icons, route-specific SEO metadata, canonical URLs, robots rules, and a sitemap; storefront lint, strict TypeScript checks, and the Next.js production build pass.

## 2026-08-28

- Added public Customer marketplace homepage APIs for aggregated campaign/category/deal/product content, bounded cursor-based discovery, and product/shop/category search. Added approval-aware storefront visibility, authenticated delivery and recently viewed context, lightweight product-card DTOs, safe campaign destinations, PostgreSQL-backed product/campaign/flash-deal/history schema, cache-aware public metadata, and feature coverage; all 29 API tests and 273 assertions pass.
- Added idempotent initial Customer and product catalog seeders. The Customer seeder creates an active, approved account from `APPROVED_CUSTOMER_*` environment settings; the catalog seeds active seller/shop/category dependencies and four storefront-visible products with remote Unsplash thumbnails.

## 2026-08-28

- Added the responsive Customer marketplace homepage and product-search results UI. Integrated the public and personalized homepage APIs with ISR-prerendered discovery content, client-refreshed customer context, accessible campaign and flash-deal interactions, reusable product/category modules, bounded cursor infinite scrolling with session restoration, responsive media handling, analytics hooks, and discovery environment limits. Added canonical/Open Graph/Twitter/JSON-LD SEO metadata; storefront lint, strict TypeScript checks, and the Next.js production build pass.
- Added Admin account-registration management for the currently implemented Customer and Seller roles, with a permission-gated paginated/searchable review queue, role-aware details, atomic approval/rejection transitions, reviewer metadata, queued applicant emails, immutable UUID audit records, and conflict protection. Added responsive queue/detail screens and minimal dashboard/sidebar navigation while preserving the dashboard scaffold; Courier applications remain excluded. All 34 API tests and 244 assertions pass on SQLite and PostgreSQL 18.3, and Admin lint and production build pass.
- Replaced the environment-dependent initial Admin bootstrap with the shared local/testing seed account `admin@test.com`, restored to its known active credentials whenever the seeder runs, while preventing that test account from being seeded in production. All 35 API tests and 246 assertions pass.

## 2026-08-28

- Completed the Admin account-approval workflow: authorized Admins can open Customer and Seller registration details, approve or reject pending accounts, optionally provide a rejection reason, and safely handle already-reviewed conflicts. Decisions atomically update the application and user account, record the reviewer and timestamp, create an immutable audit entry, and queue the applicant email.
- Added the shared local/testing Admin account to `InitialAdminSeeder`: email `admin@test.com`, password `Admin12345`. Running `php artisan db:seed` creates or restores the active account and grants its registration view/review permissions; the known test account is not seeded in production.

## 2026-08-28

- Updated the Admin sidebar to follow the selected theme: light mode now uses a white neutral surface with readable purple/slate active, hover, profile, and navigation states, while dark mode preserves the original dark-purple appearance.

## 2026-08-28

- Added permission-gated Admin system audit logs with searchable/filterable/paginated list and read-only detail screens, historical actor and target snapshots, safe structured before/after state, event/request metadata, and resilient rendering for older taxonomy values. Reworked account-approval auditing into a sanitized transactional outbox with post-commit queued persistence, idempotent retries, scheduled recovery, and database-enforced append-only ledger rows. Clean migrations and all 45 API tests/303 assertions pass on SQLite and PostgreSQL 18.3; Admin lint and production build pass.

## 2026-08-28

- Added successful active-Admin login events to the System Audit Log, capturing the authenticated Admin account, server timestamp, IP address, user agent, and safe session-authentication context while excluding failed, inactive, Customer, Seller, and Courier attempts. The viewer marks the currently signed-in Admin's events as `You`; all 45 API tests/322 assertions pass on SQLite and PostgreSQL 18.3, and Admin lint/build pass.

## 2026-08-28

- Expanded the root `pnpm dev` launcher to automatically start the Laravel database queue worker and scheduler alongside the API and frontend applications, so queued notifications/audit events are processed and pending audit outbox events are recovered during local development.

## 2026-08-28

- Documented the current Admin feature set and Dashboard implementation boundaries in `apue-admin-req.md`, including the ready-but-deferred Pending Registrations KPI and Registration Action Center, currently feasible follow-up work, and domain-dependent features that must not be implemented yet. No application code or Dashboard UI was changed.

## 2026-08-28

- Added a permission-aware Admin Dashboard registration aggregate with pending Customer/Seller totals and per-role counts, plus a PII-minimized five-item oldest-first Registration Action Center linking to authoritative review screens. Added responsive loading, zero, error, retry, timestamp, and deep-link states while preserving the remaining Dashboard scaffold. All 48 API tests and 358 assertions pass on SQLite and PostgreSQL 18.3; Admin lint and production build pass.
