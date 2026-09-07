---
feature: dashboard
title: Seller Dashboard
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented catalog slice
role: Seller
scope: Seller Web Application
---

# Seller Dashboard

## WHAT

- **Purpose:** Give an approved Seller a secure, Shop-scoped overview and links to the features that own each piece of data.
- **Route/API:** Seller SPA `/dashboard`; Laravel `GET /api/v1/seller/dashboard`.
- **Current implementation:** the API returns the authenticated Shop summary, optional normalized period metadata, catalog counts, and explicit unavailable envelopes for domains that have no authoritative dashboard source yet. The React page renders these states instead of demo totals.
- **Catalog slice:** total, active, draft, archived, zero-stock base Products, and zero-stock variant SKUs. These zero-stock values are a catalog signal, not a replacement for Inventory `available`.
- **Target sections:** Orders, Inventory/low stock, finance, reviews, traffic, notifications, reports, and other metrics become available only when their owning domain defines a reconciled source.
- **One-Shop rule:** the account owns one Shop. Registration creates it pending; after approval, setup edits that Shop rather than creating another one.
- **Non-goals:** mutations, platform-wide totals, fabricated analytics, duplicate metric stores, or Seller access to another Shop.

```text
active Seller session
→ resolve the Seller's one Shop
→ validate optional period/timezone
→ aggregate only Shop-owned records
→ return available/empty/unavailable section states
→ render cards and links to owning features
```

## MUST

### Authorization and scope

- Require `auth:sanctum` and active Seller status. Pending, rejected, suspended, deactivated, Customer, Admin, and Courier accounts cannot fetch the dashboard.
- Resolve Seller and Shop from the authenticated session; never accept `seller_id`, `shop_id`, arbitrary metric names, SQL fragments, or client-calculated totals.
- Apply the Shop constraint before every aggregate, preview, cache key, and action. A cross-Shop lookup is a `404`/empty scoped result, never a fallback.
- If the existing Shop is absent or its required storefront fields are incomplete, return `SHOP_SETUP_REQUIRED` without global data or a placeholder Shop. Setup edits the existing registration-created Shop.

### Request and response contract

- Optional `from`, `to`, and IANA `timezone` values are validated; normalize accepted dates to Seller-local half-open UTC boundaries and return the normalized period.
- Reject malformed dates, invalid timezones, reversed ranges, and overlong periods with field-addressable `422` errors.
- Return `version`, `code`, `shop`, `period`, `sections`, `actions`, and server-generated UTC `generated_at`.
- Every section is `available`, `empty`, `unavailable`, or a retryable `error`; authoritative zero is not the same as unavailable or failed.
- Lists/actions are bounded, deterministic, and contain only safe Seller fields. Do not expose Buyer PII, payment secrets, private evidence, raw storage paths, or another tenant's identifiers.
- A partial section failure remains distinguishable from a successful empty section. Whole-request auth/scope failures remain normal HTTP failures.

### Current catalog section

- Count Products through the authenticated Shop, including draft and archived records for Seller management.
- Count zero-stock base Products and variant SKUs without double-counting variant Products. Inventory owns the eventual canonical availability calculation.
- Catalog actions link only to implemented Seller routes. The dashboard does not publish, archive, adjust stock, approve Orders, or assign Logistics/Couriers.
- Product visibility and compliance restrictions remain governed by Product/catalog and Admin compliance domains; dashboard counts must not make restricted Products public.

### Deferred sections

- Orders use canonical status groups and link to Order Approval/Prepare Orders when those sources are exposed; notification read state is not fulfillment state.
- Inventory and low-stock cards read Inventory/Low Stock Alert DTOs, never duplicate `on_hand`, `reserved`, or `available` calculations.
- Finance waits for authoritative Orders, payments, fees, refunds, settlement, currency, and period semantics. Do not call net proceeds “profit” without COGS.
- Reviews require verified Seller-owned reviews and defined rating reconciliation. Traffic requires Seller-scoped analytics events and storage.
- Notifications use the shared notification domain and do not create Dashboard-owned read state. Reports must reconcile with identical Shop, period, currency, and status rules.

### UX and acceptance

- Render responsive light/dark layouts with keyboard focus, text labels, accessible chart summaries, and non-color-only states.
- Support loading, loaded, empty, setup-required, unavailable, partial-error, stale/refetch, session-expired, and retry states.
- [x] Guests and inactive/non-Seller accounts cannot use the API or protected page.
- [x] Every current catalog value and Shop identifier is authenticated-Seller scoped.
- [x] Missing-Shop responses are explicit `SHOP_SETUP_REQUIRED` and contain no marketplace-wide data.
- [x] Catalog counts are server-derived; deferred sections are explicit `DOMAIN_NOT_IMPLEMENTED` rather than fake zeros.
- [ ] Order, Inventory, finance, review, traffic, notification, report, and comparison metrics are enabled only after their owning contracts and reconciliation tests exist.

## HOW

- Current backend: `src/api/app/Services/Seller/DashboardService.php`, Seller `DashboardController`, `DashboardRequest`, and `SellerDashboardResource`; route is protected by `seller.active`.
- Current frontend: `src/seller/src/pages/DashboardPage.tsx`, dashboard types/components, and the shared credentialed API client. It displays the Shop/catalog slice and safe deferred states.
- Use scoped database aggregates and explicit section builders. Add caching only after profiling; keys must include Shop, normalized period/timezone, section, and metric version, with freshness metadata.
- Dispatch refresh/broadcast work only after committed source-domain events. Browser events never mutate authoritative totals.
- Add new migrations only for an approved metric/read-model contract; do not modify executed migrations or introduce a Dashboard-owned source of truth.
- Before enabling a section, document its source tables, status/period definitions, privacy DTO, failure state, reconciliation query, indexes, and owning feature link.
- Test role/status denial, setup safety, Shop isolation, period validation, catalog counts, empty/unavailable/error distinction, DTO privacy, deterministic ordering, and stale refresh. Run Seller lint, TypeScript, and production build.

### Current response shape

- `shop` contains only the Shop UUID, name, status, and vacation flag. It is not a public storefront projection and must stay Seller-scoped.
- `sections.catalog` is `available` or `empty` and returns total, active, draft, archived, zero-stock base Product, and zero-stock variant-SKU counts plus `stock_signal = catalog_quantity`.
- `sections.financial`, `orders`, `inventory`, `reviews`, `traffic`, and `notifications` currently return `state = unavailable` with `reason = DOMAIN_NOT_IMPLEMENTED`.
- `actions` is currently empty. A future action must include a safe destination owned by an implemented Seller feature; a dashboard card must not imply an unavailable mutation exists.
- `generated_at` is UTC server time. The period object includes submitted local dates, timezone, and UTC boundaries when both dates are supplied.

### Section enablement rules

- Order cards may be enabled only after the Order Approval/Prepare Orders source defines actionable groups and a reconciliation test against the canonical `OrderStatus` history.
- Inventory cards must read the Inventory and Low Stock Alert APIs or a shared query object; they must not count Product `stock_quantity` as `available` once reservations are present.
- Finance cards require a currency-aware ledger and explicit treatment of COD pending payment, refunds, fees, settlement, and period boundaries.
- Review, traffic, and notification cards need ownership, retention, privacy, and failure contracts before any UI placeholder is changed to `0`.

### Observability and rollout

- Record request ID, Seller/Shop identifiers, normalized period, section result categories, duration, and cache freshness without logging Buyer rows or financial secrets.
- Start with the catalog response and no cache. Add bounded cache/read models only after profiling and include Shop, period, section, and metric-version in every key.
- A source-domain outage may mark one section `error` while preserving successful sections. Repeated failures are retried or surfaced to operators independently of the Seller page.
- When the one-Shop setup flow is approved, expose a setup action that routes to Account Management; do not let Dashboard create or silently attach a Shop.

### Period and freshness rules

- A request with no dates returns the current catalog snapshot and a null period. A request with both dates uses inclusive local `from` and `to` dates converted to `[from_utc, to_utc_exclusive)`.
- Partial dates are rejected rather than interpreted differently by each section. Server time, not the browser clock, supplies `generated_at`.
- If a future section is cached, expose `data_as_of`/stale metadata and keep the same Shop/period/metric definition in the cache key.
- Refresh after a committed Product, Order, Inventory, or notification event is a refetch signal only; the page never increments or decrements a metric optimistically.

### Implementation guardrails

- Keep Dashboard query objects read-only and share metric definitions with the owning domain instead of duplicating business calculations.
- Bound preview rows and action counts. Do not expose raw SQL/order clauses, unrestricted date ranges, or internal exception text through query parameters.
- A `DOMAIN_NOT_IMPLEMENTED` response is a truthful product state and should link to the relevant roadmap/spec, not show a disabled chart that looks like zero data.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`, Seller Auth, Product/Catalog, Inventory, Low Stock Alerts, Order Approval, Prepare Orders, and Generate Report specs.
