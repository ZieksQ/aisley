# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:

```
## YYYY-MM-DD
- Feature/change short summary
```

---

## Status

Project is in active implementation across the API, Customer storefront, and Admin dashboard.

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

## 2026-08-28

- Repaired the Customer marketplace homepage branch integration with `main`: resolved the environment, default seeder, schema-documentation, and progress-log conflicts; restored versioned Customer endpoint examples; and made `main` part of the branch history. Clean SQLite and PostgreSQL 18.3 migrations/seeding and all 55 API tests/449 assertions pass; Customer, Admin, and Seller lint and production builds pass.
- Added concise Next.js design principles covering SEO metadata, SSR/SSG/ISR, CSR boundaries, crawlability, hydration safety, and performance.

## 2026-08-28

- Added Azure Blob Storage support to the Laravel filesystem configuration through the maintained Azure Blob Laravel driver. Storage remains local by default and can be switched by setting `FILESYSTEM_DISK=azure` with the documented `AZURE_STORAGE_*` connection settings.

## 2026-08-29

- Synchronized `docs/schema.md` with migration `2026_08_29_000120_add_product_details_and_variants.php`, documenting product-detail fields, product option groups/values, variants, variant option selections, media, foreign-key behavior, and related application invariants.
- Added the public UUID-based Customer product-detail API with storefront visibility enforcement, ordered media, safe public media URLs, Markdown descriptions, specifications, shop summaries, valid option combinations, variant price inheritance/overrides, and stock availability. Added the supporting product detail/variant schema and models, and upgraded the idempotent catalog seeder with detailed products, variants, zero-stock combinations, and 12 verified Unsplash stock images. All 59 API tests and 514 assertions pass on SQLite and PostgreSQL 18.3, and a clean PostgreSQL migration/seed cycle passes.
- Added the server-rendered Customer product-detail route at `/products/{id}` and integrated the public UUID product-detail API. The responsive page includes an accessible keyboard/swipe gallery with asset fallbacks, valid-combination variant selection, variant pricing/media/SKU/stock, bounded quantity controls, payload-ready cart and Buy Now intents, shop details, safe GFM Markdown descriptions, specifications, review summary/empty state, canonical social metadata, Product structured data, and a scoped not-found page. Product discovery cards now link by immutable UUID; storefront lint, strict TypeScript, webpack production build, and the 4 product-detail API tests/54 assertions pass.
- Fixed the product-detail and product-not-found routes to provide the shared marketplace header with homepage/viewer context, preventing `useHomeData` runtime failures while preserving credentialed customer, delivery-location, and cart refresh behavior outside the homepage. Reconfirmed that homepage product sections are supplied by the Customer homepage and recommendation APIs; storefront lint, strict TypeScript, webpack production build, and the combined homepage/product-detail API suites with 9 tests and 136 assertions pass.
- Completed the Customer storefront login-to-navbar integration using the existing Sanctum HttpOnly session-cookie flow. Guest product browsing remains public; authenticated homepage context now exposes a safe email fallback and saved-address label, the utility bar shows the account name/email, and the responsive header orders Messages, Cart, and Sign in/Profile while removing Wishlist and replacing the signed-in location prompt with the saved city/province or an add-address action. Customer auth/homepage tests (16 tests, 186 assertions), storefront lint, strict TypeScript checks, and the webpack production build pass.

## 2026-08-29

- Added customer-only, server-validated auth-aware storefront navigation. The root layout forwards request cookies to the active-Customer Sanctum endpoint with no-store semantics and hydrates one shared auth provider; non-Customer, inactive, expired, and anonymous sessions are normalized as guests. The responsive header now has a keyboard-accessible account menu with Profile, Wishlist, Settings, and CSRF-protected logout, while login/register redirect active Customers home and `/account/*` preserves a same-origin return path for signed-in access. The Customer `/me` and login responses now expose only the minimal navigation DTO; all 59 API tests (523 assertions), storefront lint, strict TypeScript checks, and webpack production build pass. Turbopack remains blocked in this environment by its local CSS-worker port restriction.

## 2026-08-29

- Fixed storefront session restoration after refresh: any non-authenticated server hydration now uses the navbar loading state while the browser performs a credentialed `GET /api/v1/customer/auth/me`, and the shared provider retries that validation once for each public-route visit until an active Customer is confirmed.
- Revised the Customer View Cart specification for SKU-level variant choices and product-page Add to Cart: documented the existing normalized variant schema, Cart-line identity and PostgreSQL-safe uniqueness, authoritative add/change-variant contracts, selected-choice display, and the concrete replacement for the current product-page placeholder. Added Shopee and Lazada research links and testable acceptance coverage; no application behavior was changed.
- Condensed the Customer View Cart draft into the implementation-ready feature-spec format, retaining the variant and Add to Cart decisions while removing duplicated checkout detail; no application behavior was changed.
- Added the active-Customer Cart API with authenticated read/add/update/delete endpoints, one UUID Cart per Customer, SKU-level partial uniqueness, transactional quantity/variation merges, authoritative storefront/variant/stock validation, current-price and ordered-choice projections, unavailable-intent preservation, and Customer-scoped item access. All 68 API tests and 617 assertions pass on SQLite, with the full 68-test/615-assertion suite also passing on PostgreSQL 18.3 after a clean migration cycle.
- Added the responsive Customer Cart storefront and integrated all Cart endpoints through shared authenticated state. Product Detail now performs real Add to Cart mutations with login return and intentional post-login retry, the header reflects authoritative Cart quantity, and `/cart` supports current-price/availability display, quantity updates, removal, recoverable errors, and an accessible valid-combination variation editor. Storefront lint, strict TypeScript checks, and the Next.js webpack production build pass.

## 2026-08-29

- Added an implementation-ready Seller Authentication specification covering role-isolated registration, Admin approval gating, Sanctum web sessions, password recovery, Seller frontend integration, security, testing, rollout requirements, and unresolved shop/document decisions. No application code was changed.
- Revised the Seller Dashboard specification into a concise, implementation-ready phased contract aligned with the React/Vite Seller app, `/api/v1` conventions, Seller Auth, current Shop/Product schema, strict tenant isolation, and explicit unavailable states for deferred Orders, finance, Inventory, Reviews, notifications, and analytics domains. No application code was changed.

## 2026-08-29

- Added Seller-only Sanctum web authentication with transactional pending registration, Admin approval gating, role-isolated login/session restoration/logout, stable account-state errors, throttling, and Seller-scoped password recovery. Replaced the static Seller demo with accessible registration/login/recovery routes, a protected responsive light/dark shell, and a skeleton Dashboard backed by strict Shop-scoped catalog counts; missing-Shop and deferred finance, Orders, Inventory, Reviews, traffic, and notification states are explicit and contain no fabricated data. All 74 API tests and 678 assertions pass on SQLite and PostgreSQL 18.3, and Seller lint, TypeScript, and the production build pass.

## 2026-08-29

- Added the dedicated local/testing `InitialSellerSeeder` with the shared `catalog@aisley.test` / `Seller12345` account, active Seller profile restoration, production exclusion, and default-seeder ordering before the catalog so the same Seller owns `Aisley Demo Store`. Documented the existing Admin, Seller, and Buyer/Customer role seeders and their credential policies in `docs/users.md`; all 76 API tests and 690 assertions pass on SQLite and PostgreSQL 18.3.

## 2026-08-29

- Revised the Seller Order Management specification into a concise catalog-management contract that adopts MDXEditor for `description_markdown`, with toolbar, paste, and drop picture insertion backed by Seller-scoped upload, scanning, canonical asset URLs, safe Markdown rendering, and separation from Product gallery media. No application code was changed.
- Replaced hard-coded Admin and Seller bootstrap credentials with optional `INITIAL_ADMIN_*` and `INITIAL_SELLER_*` environment configuration. The seeders now skip safely when credentials are absent, can be explicitly enabled in production, preserve existing passwords/account states/profile data on reruns, and let the catalog seeder reuse the configured Seller without silently reactivating it. Documented secure deployment setup and verified all 76 API tests and 693 assertions on SQLite and PostgreSQL 18.3.

## 2026-08-30

- Added `react-markdown` and `remark-gfm` to the Seller app dependencies for safe GFM description viewing alongside MDXEditor authoring.

## 2026-08-30

- Added the canonical 14-Shop-Category/83-Product-Category taxonomy and linked Product Categories to their Shop Category groups. Expanded Seller registration to collect a calculated-age profile, manually entered Philippine business address, business name/line of business, and private government-ID/business-permit images on the configured filesystem; registration now creates a pending Shop and Admin approval transitions the account, Shop, application, and evidence together. Added protected Admin evidence review/download support and updated both SPAs without third-party address services. All 89 API tests and 818 assertions pass on SQLite and PostgreSQL 18.3; Seller and Admin lint and production builds pass.

## 2026-08-30

- Marked every required Seller registration field with an asterisk and added a short required-field key while preserving the existing form layout and validation behavior. Seller lint, strict TypeScript checks, and the production build pass.

## 2026-08-30

- Fixed Seller registration submission by capturing its multipart form payload before the asynchronous Sanctum CSRF request, ensuring the registration POST and evidence uploads proceed instead of falling into the generic API-connectivity error. Seller lint, strict TypeScript checks, and the production build pass.

## 2026-08-30

- Fixed Admin registration-evidence review by fetching private document images through the authorized API with session credentials and rendering secure inline previews with full-size, download, loading, error, retry, and object-URL cleanup behavior. Admin lint, strict TypeScript checks, production build, and all 12 registration-management API tests pass.

## 2026-08-30

- Added Seller Product/Catalog Management and authoritative Inventory Management for approved Sellers. Seller-scoped APIs and responsive workspace screens now support product draft creation/editing, category validation, publication/archival, SKU listing/search, on-hand/reserved/available balances, low/out-of-stock filters, thresholds, manual adjustments, and immutable movement history. Added an additive inventory-ledger migration with catalog-stock backfill and synchronized legacy quantities for Storefront/Cart compatibility. Purchased-order fulfillment remains deferred until the canonical Order domain exists. All 92 API tests and 837 assertions, Seller lint, strict TypeScript, and the production build pass.

## 2026-08-30

- Added an explicit Edit action for draft Seller products and a confirmed Unarchive workflow for archived products. Unarchiving restores the Product to Draft, clears its publication timestamp, and reactivates its inventory SKUs without exposing it to buyers until the Seller publishes again. The focused 4-test/27-assertion API suite, Seller lint, strict TypeScript, and production build pass.

## 2026-08-30

- Added self-service Admin Account Management at `/account` for the authenticated Admin's defined profile fields, role-aware email, password, and private profile photo. Email and password changes use current-password confirmation without 2FA for now; no 2FA mechanism or preferences were invented. Profile images enforce the shared JPEG/PNG/WebP, exact-under-10-MiB, decoded-image, extension-match, ownership, generated-path, and private-delivery rules, storing bytes on the configured filesystem/Azure Blob and only validated metadata in PostgreSQL. All sensitive mutations emit redacted durable audit events. All 98 API tests and 892 assertions, Admin lint, strict TypeScript, and production build pass.
- Added implementation-ready Checkout & Order Creation and Voucher Usage specifications. They define direct Buy Now and selected-Cart checkout, one Order per Shop with atomic multi-Shop batches, Address Book snapshots, COD-only MVP, voucher issuer/benefit taxonomy, Shop scoping, and explicit one-Shop App-voucher targeting informed by Shopee and Lazada checkout rules. No application behavior was changed.
- Added active-Customer checkout quote, atomic placement, and Customer-scoped batch retrieval APIs for Buy Now and selected-Cart flows. Placement creates one COD Order per Shop with immutable item/address/financial/voucher snapshots, initial status history, stable quote validation, UUID idempotency, selective Cart cleanup, and inventory reservation. Added App/Shop fixed/percent discount and shipping-voucher eligibility/redemption persistence with explicit multi-Shop App targeting, server-configured per-Shop shipping while logistics selection remains deferred, authoritative seeded inventory balances, and focused coverage for role/ownership isolation, grouping, snapshots, vouchers, stale rollback, and retries.
- Added the Customer checkout storefront for Buy Now and selected-Cart handoffs with saved-address selection/creation, optional Google Places address suggestions and coordinate capture, COD-only payment, authoritative per-Shop requoting, explicit voucher targeting, idempotent placement, stale-checkout recovery, and private multi-Order confirmation. Added Customer-scoped address list/create APIs using the existing address schema and transactional default handling; logistics selection remains deferred.
- Replaced Google Places in the Customer checkout address form with optional Geoapify Address Autocomplete. The Philippines-filtered, debounced, keyboard-accessible suggestions retain coordinate capture and manual fallback, include required Geoapify/OpenStreetMap attribution, and use the restricted browser configuration `NEXT_PUBLIC_GEOAPIFY_API_KEY`; no package or schema change was needed.

## 2026-08-31

- Revised the Customer Order Monitoring and Logistics Tracking specification into an implementation-ready 136-line contract. It defines the authenticated Account icon → Orders journey, makes confirmed Logistics waybill receipt the Aisley-specific transition to the Customer-facing To Ship group, keeps transfer timeline/location authority in Logistics, and specifies a privacy-safe read-only embedded Customer map. The revision aligns the existing Order enum/events and checkout boundary with Shopee/Lazada tracking research; no application behavior was changed.
- Updated the Customer order-status specification so `/orders` explicitly follows the familiar marketplace purchase-history pattern: **All** is the default, paginated list of every Customer-owned Order, and visible status tabs filter that same list server-side. Aisley’s Logistics-receipt-to-**To Ship** rule remains unchanged; no application behavior was changed.
- Added active-Customer Order monitoring APIs for paginated purchase history, server-side status-group filtering, owned Order detail, and chronological tracking history. Added one canonical Customer status mapper, fixed-precision snapshot projections, privacy-safe event allow-listing, conservative map/action capabilities, private no-store responses, and ownership concealment. The 6-test Order Status suite passes with 92 assertions, and its combined Checkout regression suite passes with 12 tests and 144 assertions.
