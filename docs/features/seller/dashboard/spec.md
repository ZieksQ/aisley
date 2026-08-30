---
feature: dashboard
title: Seller Dashboard
system: AISLEY
type: Feature Specification
version: 1.1
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Dashboard

## WHAT

- **Purpose:** Give an approved Seller a secure, shop-scoped overview of current business state and the next actions requiring attention.
- **Primary actor:** an authenticated active `SELLER` using the React/Vite Seller SPA.
- **Frontend route:** `/dashboard`, matching the Seller Authentication post-login contract.
- **API endpoint:** `GET /api/v1/seller/dashboard`.
- **Current UI state:** `src/seller/src/App.tsx` is a static demonstration with hard-coded revenue, order, listing, and action values.
- **Current backend state:** no Seller dashboard route/controller exists; Shop, Product, and ProductVariant data exist, while Orders/finance, inventory movements, Reviews, notifications, analytics, and reporting remain deferred.
- **First implementable slice:** safe shop identity/status, catalog status counts, basic current stock signals, and setup/action states derived from existing records.
- **Target sections:** financial summary, order workload, inventory attention, review summary, traffic, notifications, and bounded actionable items as their owning domains become authoritative.
- **Core flow:**

```text
Seller Auth restores active session
→ Dashboard resolves Seller-owned Shop
→ Laravel validates optional period inputs
→ each available section applies Shop scope before aggregation
→ unavailable domains return explicit availability state
→ React renders data, empty, unavailable, partial-error, or retry state
→ cards/actions deep-link to their owning Seller feature
```

- **Architecture:** React/Vite and React Router own composition and interaction; Laravel/Eloquent/PostgreSQL own scope, definitions, aggregation, and safe serialization.
- **Feature boundaries:** Dashboard is read-only composition; Orders, Inventory, Reports, Reviews, Analytics, and Notifications own their records and mutations.
- **Non-goals:** fake/demo metrics, platform-wide totals, direct order/stock mutations, exports, a competing analytics store, or frontend-authoritative calculations.

## MUST

### Authentication and tenant isolation

- Require `auth:sanctum` plus the Seller-active role/status middleware defined by Seller Authentication.
- Resolve Seller identity from the session and resolve the Shop through `users.id → shops.seller_id`.
- Never accept `seller_id` or `shop_id` as authorization input.
- Apply the Shop constraint before every Product, Order, finance, inventory, Review, notification, or analytics query.
- A Seller must never receive another Shop's values, previews, identifiers, or cache entries.
- A Seller without a Shop receives an explicit `SHOP_SETUP_REQUIRED` state; the API must not fall back to global data.
- Suspended, rejected, pending, deactivated, Customer, Admin, and Courier accounts cannot access the endpoint.

### Request and period semantics

- Initial request may omit filters; period-aware sections may accept `from`, `to`, and IANA `timezone` query values.
- Laravel validates date format, `from <= to`, timezone, and a configured maximum range.
- Normalize Seller-local dates into UTC half-open boundaries: `[from_inclusive, to_exclusive)`.
- Return the normalized period so Dashboard and Generate Report can use identical definitions.
- Exact default range, maximum range, date presets, and comparison policy remain open decisions.
- Reject malformed filters with `422`; do not accept arbitrary metric names, SQL fragments, grouping, or sorting expressions.

### Response contract and availability

- Return one versioned DTO with `shop`, `period`, `sections`, `actions`, and server `generated_at`.
- Every section uses an explicit state: `available`, `empty`, `unavailable`, or `error`.
- `0` means an authoritative zero; unavailable or failed data must never be serialized as zero.
- An unavailable section includes a stable reason such as `DOMAIN_NOT_IMPLEMENTED`; it must not expose internal exceptions.
- A failed optional section may produce a partial response while preserving successful sections and a retryable error code.
- Whole-request auth, scope, or validation failure must fail normally rather than return a partial success.
- Lists/previews are bounded, deterministically ordered, and contain only fields needed by the Dashboard.
- `generated_at` is server-generated UTC; cached sections additionally expose their own `data_as_of` and stale state.

### Current catalog section

- Catalog metrics must derive only from Products belonging to the authenticated Seller's Shop.
- Required initial counts: total, active, draft, archived, and current zero-stock Products/SKUs when the schema can represent them safely.
- Variant-aware stock signals must not double-count a Product and its variants; the final Inventory contract decides canonical SKU availability.
- Until reservations/movements exist, label current stock as a catalog signal rather than authoritative `available` inventory.
- Catalog actions may link to Product or Inventory routes only when those routes exist; otherwise show a non-clickable setup state.
- Never reuse public storefront visibility queries as the only Seller management scope because draft/archived Products must remain visible to their owner.

### Deferred target sections

- Financial values remain `unavailable` until shop-scoped Orders, payments, fees, refunds, and settlement semantics exist.
- When available, financial labels distinguish gross paid sales, refunds, pending amounts, settled amounts, and net proceeds.
- Do not label net proceeds as profit unless Product cost/COGS is authoritative; all money uses fixed precision and explicit currency.
- Order counts must map presentation groups to the canonical Order lifecycle; notification read state is not fulfillment state.
- Pending fulfillment derives from actionable Seller Order states and deep-links to the filtered Order/Prepare Order view.
- Low-stock values derive from the future Inventory/Low Stock Alert authority, not duplicated Product-level guesses.
- Review summaries use only verified Reviews on Seller-owned Products; cached `average_rating` fields are insufficient without reconciliation rules.
- Traffic stays unavailable until event definitions and Seller-scoped Analytics storage exist; do not invent visitors, conversion, or impressions.
- Notification counts/previews use the shared persisted notification domain and never create Dashboard-owned read state.
- Dashboard financial totals must reconcile with Generate Report for the same Shop, period, currency, and status rules.

### User experience and acceptance

- Use the professional dashboard design system with light/dark themes, responsive layout, accessible focus, and non-color-only statuses.
- Provide page loading, loaded, empty, partial, stale, session-expired, shop-setup, and whole-page error states.
- Charts require textual summaries and accessible labels; omit charts when no authoritative series exists.
- Refresh/realtime signals trigger an API refetch after committed domain events; browser events never mutate totals directly.
- [ ] Guest and non-active/non-Seller accounts cannot fetch or view the Dashboard.
- [ ] Every returned identifier and metric belongs to the authenticated Seller's Shop.
- [ ] A missing Shop produces `SHOP_SETUP_REQUIRED` without leaking global data.
- [ ] Existing catalog counts are computed server-side and the static demo values are removed.
- [ ] Deferred sections display unavailable—not zero, fabricated data, or misleading empty charts.
- [ ] Partial section failure is distinguishable from authoritative empty data.
- [ ] Money, date, timezone, comparison, and freshness metadata are explicit when applicable.
- [ ] Every action routes to an implemented, Seller-scoped owning feature.
- [ ] Dashboard and Generate Report definitions reconcile once financial domains exist.

## HOW

- Add Seller-namespaced `DashboardController`, `DashboardRequest`, `SellerDashboardResource`, and a query/service under `src/api/app`.
- Register `GET /api/v1/seller/dashboard` under `auth:sanctum` and Seller-active middleware in `routes/api.php`.
- Start with Shop/catalog queries supported by the current schema; keep deferred section builders behind stable availability envelopes.
- Aggregate with scoped database `count`/`sum`/`avg` queries rather than loading records for React to total.
- Use independently testable section builders only where complexity warrants them; share metric definitions with owning domains.
- Replace the static `App.tsx` dashboard with a protected React Router page using the Seller Auth credentialed API client.
- Suggested UI modules: `DashboardHeader`, `CatalogSummary`, `SectionState`, `ActionList`, and later financial/order/inventory/review modules.
- Fetch once on route entry, support abort/retry, and prevent stale responses from overwriting a newer period request.
- Begin without metric caching; add bounded caching only after profiling demonstrates need.
- Cache keys must include Shop ID, normalized period/timezone, section, and metric version; cached data must expose freshness.
- Invalidate/refetch only after committed source-domain events; Laravel 13 `Cache::flexible` is optional for bounded stale-while-revalidate.
- API tests cover role/status denial, missing Shop, cross-Seller isolation, catalog counts, unavailable/empty/error distinction, DTO shape, and bounded actions.
- PostgreSQL tests verify scoped aggregates and planned indexes; Seller checks cover lint, TypeScript/build, responsive states, and keyboard access.
- Log request ID, Seller/Shop IDs, duration, section result categories, and cache hit/staleness without Buyer PII or financial row details.
- Roll out the catalog slice first; enable later sections only with migrations, source-domain tests, metric definitions, and reconciliation coverage.
- **Open questions:** shop onboarding route, initial stock definition, default period/comparison, currency policy, section error HTTP strategy, chart library, cache TTL, and realtime driver.
- **References:** `docs/domains/Seller.md`, `docs/schema.md`, Seller Auth and dependent Seller specs, [Laravel 13 query aggregates](https://laravel.com/framework/docs/13.x/queries#aggregates), [Laravel 13 cache](https://laravel.com/framework/docs/13.x/cache), and [React Router modes](https://reactrouter.com/start/modes).
