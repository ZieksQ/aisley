---
feature: vacation-mode
title: Seller Vacation Mode
system: AISLEY
type: Feature Specification
version: 1.1
status: Implemented (Phase 1) — immediate Shop toggle and message; scheduling and presentation variants deferred
role: Seller
scope: Seller Web Application and Laravel API
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Seller.md, docs/features/seller/acount-management/spec.md, docs/features/customer/browse-shop/spec.md, docs/features/customer/view-product/spec.md, docs/design.md
---

# Seller Vacation Mode

## WHAT

- **Purpose:** Let an approved active Seller temporarily stop new purchases for the one Shop while keeping the Shop record, catalog, inventory, and existing Order obligations intact.
- **Canonical role:** `seller` in the API and database; “Seller” is the dashboard term.
- **Current implementation:** Vacation Mode is part of Seller Account Management. `shops.is_on_vacation` is an immediate boolean toggle and `shops.vacation_message` is an optional message that is required while the toggle is enabled. There is no separate Vacation Mode route, schedule, automatic expiry, or configurable presentation setting.
- **Current flow:**

  ```text
  active Seller opens Account → Storefront information
  → sets Vacation mode and message → PATCH /api/v1/seller/account/storefront
  → Laravel validates and saves the own Shop → returns the fresh account projection
  → storefront, Cart, and Checkout apply the current Shop state
  ```

- **Availability rule:** Vacation Mode is a Shop-level availability overlay. It is not Seller suspension, Product archive, compliance restriction, inventory depletion, or an Order status.
- **Boundaries:** Seller Account Management owns the toggle/message write; `Shop::storefrontVisible()` owns public eligibility; Cart and Checkout revalidate purchase eligibility; Admin owns suspension/deactivation/compliance; Product and Inventory features own their records; Order/fulfillment features own existing obligations.
- **Non-goals:** schedules, recurring vacations, automatic start/end, timezone conversion, `HIDE`/`UNAVAILABLE` choice, public vacation banners, Product edits, inventory changes, Order cancellation, refunds, Logistics/Courier changes, Seller auto-replies, or notification preferences.

## MUST

### Access and ownership

- Require `auth:sanctum` and the active-Seller middleware for Account Management access. Resolve the Seller and exactly one Shop from the authenticated user.
- A Seller may update only that Shop's vacation fields. Never trust `seller_id`, `shop_id`, status, Product IDs, or a client-selected owner in the request.
- A guest, Customer, Admin, Courier, Logistics user, pending Seller, rejected Seller, suspended Seller, or deactivated Seller cannot use the Seller vacation mutation.
- Return `401` for no session, `403` for the wrong role or inactive account, `404` when the required own Shop is missing, `409` for an approved stale/conflicting write contract, and field-addressable `422` validation errors.

### Implemented immediate toggle

- Use the existing `PATCH /api/v1/seller/account/storefront` endpoint. The current request includes the allow-listed storefront fields plus `is_on_vacation` and `vacation_message`; it is not a generic Shop patch.
- `is_on_vacation` is a required boolean. When it is `true`, `vacation_message` is required, nullable only when disabled, and limited to 1,000 characters by the current Form Request.
- Validate all submitted storefront fields server-side. Reject forbidden `seller_id`, `shop_id`, `slug`, `status`, category, reviewer, ownership, Product, Inventory, Order, and compliance fields instead of silently mass-assigning them.
- Save the Shop change transactionally, return the fresh safe account/Seller projection, and write a secret-free Seller account mutation log. Repeating the same state is a safe no-op and must not create a second business decision.
- The API response is authoritative. The Seller UI must not claim that Vacation Mode changed until the response returns successfully.

### Storefront and purchase enforcement

- `Shop::storefrontVisible()` requires an active Shop, active Seller role/status, and `is_on_vacation = false`. Public Shop directory and Shop-product queries reuse that scope.
- `Product::storefrontVisible()` also requires the Shop not to be on Vacation. Search, homepage, Browse Shop, and Product Detail therefore hide affected Products/shops rather than expose a new public unavailable state.
- A stale Product page or Cart cannot bypass Vacation Mode. Cart add/update and Checkout perform a current server-side check and return the existing unavailable/conflict response when the Shop is on Vacation.
- Existing Cart intent may remain stored but is represented as unavailable by the current Cart projection; Vacation Mode does not silently convert it into a valid Order.
- The current MVP uses one public behavior—hide from discovery and purchasing. A future public vacation message or `UNAVAILABLE` presentation needs an explicit visibility/DTO contract.

### Existing Orders, Products, and Inventory

- Enabling or disabling Vacation Mode must not delete, archive, unpublish, reprice, or change the compliance state of any Product. Product eligibility is recomputed after reactivation.
- Vacation Mode must not change `on_hand`, `reserved`, `available`, SKU thresholds, low-stock cycles, or Inventory movements.
- It must not cancel or rewrite a placed Order, its immutable item/address/financial snapshots, or its status history. Existing Seller order/fulfillment obligations remain available under their owning feature.
- Vacation Mode does not create or alter Shipment, Parcel, Waybill, Scan, Delivery Task, Logistics, or Courier state. It must not prevent the Seller from completing an already committed fulfillment action unless that separate contract says otherwise.
- Turning Vacation Mode off restores only Products that independently satisfy active Seller, Shop, Product, publication, compliance, and stock rules. It never overrides an Admin restriction or an archived Product.

### Message and privacy

- Treat `vacation_message` as untrusted Seller text. Validate its length server-side and render it as escaped text wherever a future public surface permits it; never accept executable HTML or scripts.
- The current public Shop summary does not expose a vacation state/message because vacation Shops are filtered out. Seller Account and dashboard projections may show the Seller's own message and boolean.
- Do not expose private Seller profile data, registration evidence, internal reasons, or raw storage paths through Vacation Mode responses, logs, or public catalog DTOs.

### Consistency and precedence

- Lock the authenticated Shop row for the update, compare current values, and commit the changed fields together with the safe mutation log. A failed transaction leaves the previous state intact.
- Availability precedence is effectively:

  ```text
  Admin account/compliance restriction
  → Shop status and Seller status
  → Shop Vacation Mode
  → Product publication/compliance/stock rules
  ```

- Vacation Mode cannot restore a suspended/deactivated Seller, an inactive Shop, a restricted Product, or a Product that has independently been archived.
- Any future projection invalidation or notification must run after the state commit. A delivery failure must not reverse the committed Shop toggle.

### Seller UI

- The current control lives in Seller Account → Storefront information. It includes a checkbox, a required message field when enabled, a Save storefront action, and account-level loading/saving/success/error states.
- Explain that enabling prevents new purchases from this Shop while existing Orders still require fulfillment. Do not imply that Orders are cancelled or inventory is changed.
- Use labels, keyboard-accessible controls, visible focus, field-level validation, `aria-live` success/error feedback, responsive dashboard styling, and non-color-only status cues.
- A dedicated schedule page, confirmation effect summary, timezone control, public vacation banner, or notification preference control is deferred.

### Acceptance criteria

- [x] An active Seller can enable or disable Vacation Mode only on the authenticated Seller's own Shop.
- [x] Laravel validates `is_on_vacation` and requires a maximum-1,000-character message when enabled.
- [x] Forbidden ownership, status, category, reviewer, Product, Inventory, and Order fields are rejected.
- [x] Public Shop/Product discovery excludes Shops and Products whose Shop is on Vacation.
- [x] Cart and Checkout revalidate Shop availability and reject stale purchase attempts.
- [x] The toggle does not delete/modify Products, Inventory balances, or existing Order snapshots/statuses.
- [x] Disabling Vacation Mode reuses normal Seller/Shop/Product/compliance eligibility and does not override Admin restrictions.
- [x] Seller Account and Dashboard projections expose the current own-Shop state without private unrelated data.
- [x] The Seller UI shows loading, saving, validation, success, error, and load-retry feedback accessibly.
- [ ] Future start/end schedules, timezone handling, automatic expiry, and recurring vacations are implemented.
- [ ] Seller-selectable `HIDE` versus `UNAVAILABLE` presentation and a public vacation-message contract are approved and implemented.
- [ ] Manual/scheduled transition audit events, projection events, notification delivery, and cross-instance idempotency are separately implemented.

## HOW

### Current project findings

- `src/api/app/Http/Requests/Seller/UpdateOwnStorefrontRequest.php` validates the current toggle/message contract; `SellerAccountService::updateStorefront()` locks and updates the authenticated Shop.
- `SellerAccountResource` and `SellerUserResource` return safe `is_on_vacation`/`vacation_message` values for the authenticated Seller. `DashboardService` returns the Shop's current vacation boolean.
- `Shop::storefrontVisible()`, `Product::storefrontVisible()`, `CartService`, and `CheckoutService` apply the Vacation predicate. Customer Product Detail/Browse tests verify a vacation Shop is not publicly found.
- No migration is needed for Phase 1: `is_on_vacation` and `vacation_message` already exist on `shops`. Do not edit that executed migration.

### Current interfaces and data flow

- Read: `GET /api/v1/seller/account` returns the own Shop projection. Update: `PATCH /api/v1/seller/account/storefront` accepts the current storefront/vacation payload and returns `account` plus `seller` projections.
- The Seller Account page sends the complete current storefront form, including the boolean and nullable message. The API is the authority for the resulting state.
- Public discovery uses server-side scopes; Cart and Checkout acquire current Product/Shop state and reject a stale Vacation decision before creating or mutating purchase data.

### Verification and future extension

- Focused Seller tests cover own-Shop scope, required message validation, forbidden-field rejection, safe DTOs, and the Account UI contract. Customer Product Detail/Browse tests verify vacation Shops are not publicly found; Cart and Checkout services apply the same current-state predicate before purchase.
- Before adding schedules, create additive nullable schedule/timezone fields or a schedule table, define versioned transitions and due-job locking, and update this spec with the approved API before implementation.
- Before exposing a public message or `UNAVAILABLE` state, define Shop/Product DTO fields, direct-URL behavior, cache invalidation, and Customer UI states. Do not infer these from the current hide-only scope.
- Before adding notifications or audit events, define recipients, payload privacy, deduplication, retention, and after-commit delivery behavior. Existing notification failures must never undo the Shop state.
- Open decisions: schedule/timezone/recurrence, public presentation, message visibility/length beyond the current Seller limit, pending-payment behavior, pre-sale chat, notification channels, and audit retention.

**Sources:** `docs/domains/Seller.md`, `docs/features/seller/acount-management/spec.md`, `docs/features/customer/browse-shop/spec.md`, `docs/features/customer/view-product/spec.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/design.md`, [Laravel Authorization](https://laravel.com/docs/12.x/authorization), [Laravel Validation](https://laravel.com/docs/12.x/validation), [Laravel Transactions](https://laravel.com/docs/12.x/database#database-transactions), and [Laravel Notifications](https://laravel.com/docs/12.x/notifications).
