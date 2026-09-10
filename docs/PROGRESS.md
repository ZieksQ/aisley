# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:

```
## YYYY-MM-DD
- Feature/change short summary
```

---

## 2026-09-09

- Archived the previous 451-line progress log at `docs/logs/PROGRESS-2026-09-09.md` and added a 150-line progress-log archival rule to `AGENTS.md`.
- Added Seller pickup address-book CRUD with searchable PSGC fields and one default, per-Order pickup-address selection with immutable waybill snapshots, first-provider defaulting, and a searchable Logistics provider modal with hub details and recommendation/location tags.
- Changed solo and bulk Seller pickups to use one shared saved address per request, and added Geoapify geocoding with a click/drag Leaflet pin for pickup coordinates retained in immutable waybill snapshots.

## 2026-09-10

- Switched Seller registration and pickup-address PSGC selectors to the bundled `@aisley/psgc-address-data` loader and renamed the Seller Geoapify example variable to `GEOAPIFY_API_KEY`.
- Fixed repeat Customer homepage requests under production-safe cache deserialization by caching only scalar advertisement, campaign, and category projections, rotating the affected cache keys, and covering guest plus Seller/Admin/Logistics session behavior; disabled prefetch for unimplemented storefront resource links to prevent background RSC 404 noise.
- Revised Courier Account Management into a standalone Phase 1 contract for own-profile read/update and password change, with exact planned `/api/v1/courier` routes, bearer-token and Flutter handoff rules, privacy/error/retry semantics, and explicit deferral of vehicle, license, payout, uploads, and shipment operations. No application behavior or migrations changed.
- Implemented Courier Account Management for the external Flutter client. Added protected `GET /api/v1/courier/account`, `PATCH /api/v1/courier/account/profile`, and throttled `PUT /api/v1/courier/account/password` endpoints with Courier role/status/Logistics-affiliation gates, server-derived ownership, allow-listed profile updates, transactional row locking, centralized password validation, complete bearer-token revocation after password changes, private no-store DTOs, and no Courier web UI. Focused Courier account coverage passes 8 tests/84 assertions (13 tests/125 assertions with the existing Courier suite); PHP formatting and diff checks pass. Vehicle, license, payout, profile-photo, email, and delivery operations remain deferred by the account contract.
- Added the root `pnpm dev:backend` runner, which starts the Laravel API, queue worker, and scheduler concurrently for backend-only development. The existing `pnpm dev` full workspace launcher remains unchanged.
- Revised the Customer Browse Seller Shops specification to `Implemented (Phase 1)`, documenting the existing Laravel/Next.js API and UI, visibility and scope guarantees, focused test coverage, and deferred enhancements. No runtime behavior or migrations changed.
- Revised the Customer Recently Viewed Items specification to `Implemented (Phase 1)`, documenting the existing API, guest storage/merge behavior, Product Detail recording, homepage and Account integrations, focused coverage, and deferred enhancements. No runtime behavior or migrations changed.
- Clarified the canonical-document hierarchy for Courier specifications and removed stale `docs/order-logistics-flow-decisions.md` prerequisite/reference links; the worksheet remains background history only. No runtime behavior or migrations changed.
- Clarified in Courier Account Management that profile-photo work must inherit the shared file-upload contract and define only Courier-specific behavior. No runtime behavior or migrations changed.

## 2026-09-10

- Synchronized the Courier Account Management implementation with the revised 230-line contract, corrected its implementation commit reference, and added regression coverage proving successive transactional profile writes return the latest full projection while preserving untouched fields. The focused account suite passes 9 tests/91 assertions; the complete Courier suite passes 14 tests/135 assertions. No new endpoint, migration, or Courier UI was added.
- Revised Courier Account Management to define the deferred profile-photo extension from the shared file-upload policy, including planned private endpoints, metadata migration, storage/cleanup rules, Flutter states, and unchecked photo acceptance criteria. No runtime behavior or migration changed.
- Implemented the Courier Account Management profile-photo extension: additive metadata migration, configured-disk/Azure-compatible multipart upload with UUID object keys and shared image validation, private owner-only stream, replacement/removal cleanup, rate limiting, DTO capability URL, and no Courier web UI. Focused Courier account tests pass 14 tests/167 assertions; the full Courier suite passes 19 tests/211 assertions. Updated `docs/schema.md` and the feature contract to mark all six account/photo routes implemented.
- Revised Customer Order Modification and Cancellation to clarify the implemented read-only boundary, the `placed`-until-Seller-processing window, unavailable mutation routes, immutable snapshot/versioning requirements, reservation-release boundary, idempotency, concurrency, notification, and Customer UI/test contracts. No application behavior or migration changed.
- Implemented Customer Order Modification and Cancellation Phase 1. Added Customer-scoped, idempotent `POST /api/v1/customer/orders/{order}/cancel` with transactional reservation release and immutable cancellation history, plus `PATCH /api/v1/customer/orders/{order}/modification` for saved delivery-address replacement using additive versioned Order snapshots. Updated capabilities, DTOs, schema documentation, and Customer Order detail confirmation/address-selection UI; variant, quantity, voucher, shipping, repricing, and post-pickup changes remain deferred. Focused Customer API coverage passes 16 tests/180 assertions; webapp TypeScript, lint, and Webpack production build pass.
- Fixed production PostgreSQL Order detail and checkout failures by replacing the UUID-aggregating `latestOfMany()` address relation with deterministic descending address-version ordering. Added regression coverage for selecting the current address without a one-of-many UUID aggregate; 16 focused Customer tests pass with 182 assertions.
- Revised Logistics Account Management into a 120-line implementation-ready contract aligned with the existing one-account/one-organization/one-hub foundation. It records that account API/UI work is not implemented, defines protected personal/organization boundaries, blocks unapproved hub relocation, keeps subscription and approval separate, and specifies planned endpoints, security, SPA states, tests, and open decisions. No runtime behavior or migration changed.
