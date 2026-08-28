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

- Added Admin account-registration management for the currently implemented Customer and Seller roles, with a permission-gated paginated/searchable review queue, role-aware details, atomic approval/rejection transitions, reviewer metadata, queued applicant emails, immutable UUID audit records, and conflict protection. Added responsive queue/detail screens and minimal dashboard/sidebar navigation while preserving the dashboard scaffold; Courier applications remain excluded. All 34 API tests and 244 assertions pass on SQLite and PostgreSQL 18.3, and Admin lint and production build pass.
