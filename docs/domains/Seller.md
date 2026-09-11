---
model: Seller
type: Domain Context
purpose: Shared Seller workflow and implementation context
version: 1.3
status: Revised — aligned with the approved order/Logistics flow and implemented catalog/inventory foundation
---

# Seller Model Context

## Overview

Seller is Aisley's merchant role. An approved Seller operates exactly one Shop through the separate React/Vite Seller web application; Laravel APIs and the database remain authoritative. Seller-owned reads and writes are always scoped from the authenticated Seller to that one Shop.

The Seller owns catalog and inventory preparation. After a Customer places an Order, the Seller verifies and packs the purchased items, selects an eligible Logistics organization, and requests pickup. That transaction creates the immutable shared waybill and confirms `ready_for_pickup`; Logistics and Couriers own later scheduling and physical handoffs.

## Account, Shop, and approval boundary

- Each Seller account owns exactly one Shop in the MVP (`users.id → shops.seller_id` is unique). Multiple shops and Seller staff/sub-accounts are not part of the current contract.
- Seller registration collects the personal profile, business address, business name, one canonical Shop Category, government ID, and business permit from `docs/references/user-registration-requirements.md`.
- Seller age is calculated from `birth_date` by the API; a client-supplied age is never authoritative.
- Seller registration uses the bundled PSGC Region → Province → City/Municipality → Barangay lookup with a required manual postal code and street/building fields. The address is the Seller's registered business address, not a Logistics hub address.
- Registration evidence follows `docs/references/file-upload-requirements.md`: private JPEG/JPG, PNG, or WebP images under 10 MiB with server-side signature/MIME/decode validation.
- Registration creates exactly one pending Shop with the application. Missing or invalid required registration fields/evidence prevent approval; no second Shop is created after approval.
- Admin approves or rejects the pending Seller application, existing Shop, and evidence as one decision. A pending, rejected, suspended, or deactivated Seller cannot use the Seller dashboard.
- After approval, the Seller may complete or edit permitted storefront settings on the existing Shop. `SHOP_SETUP_REQUIRED` means required storefront fields are incomplete; it is not an alternative to Admin approval or a second approval state.
- The Seller cannot approve itself, alter account/Shop status, choose a Logistics hub, assign a Courier, or mutate another Seller's data.

The Seller web application uses Sanctum cookie/session authentication. The API resolves a Seller by normalized `email + role`, and every protected request rechecks the Seller role and active status.

## Tenancy and visibility contract

The authoritative ownership chain is:

```text
authenticated Seller user
→ exactly one Shop
→ Shop Categories / Products / Variants / Media / Description Assets / Inventory SKUs
```

- Never authorize from a client-provided `seller_id`, `shop_id`, Product owner, or storage path.
- Draft and archived catalog records remain visible to their owning Seller but are not public Buyer listings.
- A public Product requires an active/published Product, active approved Seller, active Shop, Shop not on vacation, no active compliance restriction, and any required stock/visibility conditions enforced by the shared `storefrontVisible()` boundary.
- Seller-facing DTOs may include operational details needed for the Seller workspace, but must not expose another tenant's records, private registration evidence, payment credentials, or raw storage paths.

## Canonical status and lifecycle contract

Persisted and API status values use lowercase `snake_case`. PHP enum case names may use `PascalCase`, and UI labels are separate. Legacy/source terms such as `PENDING`, `APPROVED`, `PACKED`, `DELIVERED`, or `READY_FOR_PICKUP` are presentation/source wording, not canonical database values.

### Seller and Shop states

```text
Seller account: pending → active → suspended/deactivated
Shop: pending → active → suspended/deactivated
Product: draft → active → archived
Product Variant: active ↔ inactive
```

Seller/Admin lifecycle decisions must preserve their own history. Archiving a Product or deactivating a Shop does not hard-delete historical catalog references or placed Orders.

### Seller order handoff

The current high-level `OrderStatus` contract is:

```text
pending_payment
→ placed
→ seller_processing
→ ready_for_pickup
→ picked_up
→ in_transit
→ out_for_delivery
→ delivered
```

Current COD placement skips `pending_payment`: checkout creates the Order at `placed` with `payment_status = pending` and reserves inventory. `pending_payment` remains available for a future online-payment flow.

Seller-owned preparation covers only:

```text
placed → seller_processing → ready_for_pickup
```

`ready_for_pickup` means the Seller has completed preparation; it does not mean a Courier has physically collected the parcel. Detailed physical states belong to the deferred Shipment/Delivery Task contract:

```text
seller_pickup_assigned
→ seller_pickup_accepted
→ picked_up_from_seller
→ received_at_hub
→ sorted_at_hub
→ in_transfer
→ dispatched_from_hub
→ delivery_assigned
→ delivery_accepted
→ picked_up_from_hub
→ in_transit
→ out_for_delivery
→ delivered
```

The Seller does not write Logistics/Courier states. After `ready_for_pickup`, a first-mile Courier may be assigned independently from the final-mile Courier; assignment, scanning, and delivery completion belong to the downstream contracts.

The Seller selects one eligible Logistics organization when requesting pickup. The API recommends exact city/province/country matches before Geoapify road-distance ranking, revalidates eligibility at commit, and freezes the selection. Seller cannot create a first-mile task or assign a Courier.

For the high-level Order projection, an explicit first-mile Courier confirmation advances `ready_for_pickup → picked_up`; the detailed `picked_up_from_seller` task event remains authoritative proof of that handoff. `assigned` remains reserved for a later Logistics/final-mile assignment contract and is not written by scheduling.

## Physical fulfillment flow

```text
Customer places an Order (`placed`)
→ Seller opens and verifies immutable purchased item/SKU snapshots
→ Seller begins processing (`seller_processing`)
→ Seller packs the correct items and records package details
→ Seller selects Logistics and requests pickup
→ Aisley creates the immutable shared waybill and confirms `ready_for_pickup`
→ Seller prints and attaches the waybill
→ selected Logistics organization creates and offers the first-mile task to an eligible Courier
→ first-mile Courier accepts and confirms pickup from Seller (`picked_up_from_seller`; Order `picked_up`)
→ Courier transfers the parcel to Logistics' sole hub
→ Logistics receives the parcel (`received_at_hub`) using the same shared waybill reference
→ Logistics sorts, transfers, and dispatches it
→ Logistics assigns a final-mile Courier
→ final-mile Courier picks up from the hub and delivers to the Customer
```

Seller preparation must not assign a Courier, select a hub, simulate transit, or mark the parcel physically picked up. Seller order edits must not rewrite immutable Order item, price, address, or discount snapshots.

## Seller capabilities and boundaries

### 1. Seller Authentication

- **Purpose:** Register a Seller, wait for Admin approval, and use a secure Seller-only web session.
- **Owns:** Registration, login, session restoration/logout, password recovery/reset, role/status gating, and safe identity DTOs.
- **Current state:** Seller Auth, Admin approval integration, private evidence, Shop creation, and session-based SPA gating are implemented.

### 2. Seller Dashboard

- **Purpose:** Provide a Shop-scoped operational overview and navigation.
- **Owns:** Current catalog counts and safe section availability/loading/error states.
- **Boundary:** Orders, finance, analytics, reviews, notifications, and inventory metrics must not be fabricated while their owning contracts are unavailable. Aggregates must be scoped to the authenticated Shop.

### 3. Catalog / Product Management

- **Purpose:** Create, edit, publish, archive, and unarchive Products with categories, prices, options, Variants, SKUs, gallery media, and Markdown descriptions.
- **Owns:** Product lifecycle and catalog validation. The legacy feature name `Order Management` refers to this catalog surface, not purchased-order fulfillment.
- **Current state:** Product, Variant, media, category, publication, archival, and Seller-scoped authoring workflows are implemented. The seeded canonical taxonomy contains 14 Shop Categories and 83 Product Categories.

### 4. Markdown Product Descriptions

- **Purpose:** Author `description_markdown` using MDXEditor — the Rich Text Markdown Editor React Component.
- **Owns:** Controlled Seller editor, headings/lists/links/images, picture insertion by toolbar/paste/drop, and Product-owned description assets.
- **Rules:** Description images are separate from Product gallery media. They use canonical Aisley asset references, never Base64/raw HTML/arbitrary external images. The Customer page renders safe Markdown with `react-markdown` and `remark-gfm` without raw HTML execution.

### 5. Inventory Management

- **Purpose:** Manage SKU-level on-hand, reserved, available, threshold, and movement information.
- **Owns:** Authoritative `inventory_skus`, `inventory_balances`, and append-only `inventory_movements` behavior, including manual adjustments and stock history.
- **Rules:** Sellers cannot set a resulting balance directly. Checkout reservations and later fulfillment actions use the Inventory service; Product catalog quantities are compatibility projections, not a second ledger.
- **Fulfillment boundary:** Checkout reserves the requested SKU quantity. An accepted cancellation or rejection before `picked_up_from_seller` releases only that Order's reservation once and transactionally. First-mile pickup commits the reservation to fulfillment exactly once; post-pickup cancellation, delivery failure, returns, refunds, and partial fulfillment remain deferred.

### 6. Low-Stock Alerts

- **Purpose:** Configure a per-SKU threshold and receive one persistent alert for each low-availability cycle.
- **Owns:** Threshold configuration, breach/recovery lifecycle, alert history/detail, and Seller-scoped database notifications.
- **Rules:** `null` disables alerting; `0` and positive thresholds follow the Inventory availability rule. Alerts never change balances, reservations, Product publication, or Orders. Repeated mutations/retries cannot duplicate an active cycle.

### 7. Order Notifications

- **Purpose:** Notify the Seller that a new Customer Order requires review and expose a safe order summary.
- **Owns:** Seller-scoped notification/inbox presentation and navigation into the authoritative Order detail.
- **Boundary:** A notification does not approve, process, pack, assign Logistics/Courier, or change the Order. Delivery failures are retried separately and never roll back a committed Order event.

### 8. Prepare Orders and First-Mile Handoff

- **Purpose:** Verify purchased snapshots, begin Seller processing, pack the parcel, select Logistics, request pickup, and print/reprint the immutable shared waybill.
- **Owns:** `placed → seller_processing → ready_for_pickup`, provider selection, shared-waybill creation, the immutable Order/Parcel reference, and readiness history.
- **Waybill rule:** Aisley creates the reference, QR, and immutable Shop/pickup/destination/provider snapshot inside the pickup transaction. Seller and selected Logistics access the same artifact.
- **Boundary:** The selected Logistics organization creates first-mile tasks/schedules after readiness and owns parcel receipt, scanning, sorting, assignment, transit, and delivery. Seller creates no task and assigns no Courier.

### 9. Delivery Confirmation

- **Purpose:** Let the Seller see that the Customer received the Order.
- **Owns:** Read-only delivery confirmation/notification after the authoritative downstream `delivered` transition.
- **Boundary:** Seller does not mark an Order delivered and does not fabricate a Courier callback or proof of delivery.

### 10. Seller Reporting

- **Purpose:** Show basic Shop-scoped sales, profit, and performance totals with a from/to date range.
- **Owns:** Read-only aggregates and bounded exports once authoritative financial data exists.
- **Boundary:** Commission, payout, tax, settlement, and large-report job policies remain separate/deferred; reports must not infer financial truth from incomplete Order data.

### 11. Chat/Messaging

- **Purpose:** Communicate with relevant Customers, Admins, Logistics operators, or Couriers for authorized product/order support.
- **Owns:** Seller-authorized threads, message state, and operational context.
- **Rules:** Access is tied to the Seller's Shop and relevant relationship; unrelated users, private evidence, payment secrets, and direct contact details are not exposed.

### 12. Account and Shop Management

- **Purpose:** Maintain the Seller profile, one Shop's public details, security credentials, vacation state, and permitted profile photo.
- **Owns:** Allow-listed profile/Shop edits, password/email security controls, private profile-photo replacement/removal, and Shop settings.
- **Boundary:** Seller cannot change role/status, ownership, registration review evidence, another Shop, or payout state without a defined provider/review contract.

### 13. Review Management

- **Purpose:** Read and reply to verified Customer reviews on the Seller's Products.
- **Owns:** Seller-scoped review list, public reply, and safe moderation/display states.
- **Boundary:** Review eligibility and Customer authorship belong to the Customer review domain; Seller cannot edit the Customer's rating or review text.

### 14. Vacation Mode

- **Purpose:** Temporarily stop new purchases and communicate Shop unavailability.
- **Owns:** `shops.is_on_vacation` and optional message, with consistent enforcement across storefront, Cart, and Checkout.
- **Rules:** Vacation mode does not delete Products or alter existing Order snapshots. Existing fulfillment handling remains subject to the Order/Prepare Orders policy.

### 15. Bulk Product Import/Export

- **Purpose:** Export a bounded Shop catalog, edit an approved CSV/XLSX template, and import validated Product changes in bulk.
- **Owns:** File parsing, row-level validation, preview/errors, idempotent batch processing, and Seller scope.
- **Boundary:** Bulk operations cannot bypass category, price, media, publication, Inventory, compliance, or historical snapshot rules. Spreadsheet files require their own approved upload policy.

### 16. Discounts, Vouchers, and Promotions

- **Purpose:** Configure Seller-funded discounts or Shop vouchers where the promotion contract permits.
- **Owns:** Seller/Shop eligibility, terms, date windows, limits, and safe promotion presentation.
- **Boundary:** Checkout calculates and snapshots benefits authoritatively; a Seller cannot submit a final discount or alter an already placed Order.

## Operational invariants

- Every Seller API request requires Sanctum authentication, `seller` role, active account status, and a Shop resolved from the authenticated User.
- Every Product, Variant, SKU, movement, media asset, description asset, voucher, notification, report, conversation, and Order query is Shop-scoped server-side.
- Product publication requires a valid active Shop/Seller, valid catalog/media/Inventory state, and no active compliance restriction. Storefront visibility is centrally enforced by the shared visibility predicate.
- Inventory balances and Order snapshots are authoritative records. Catalog edits, low-stock evaluation, notifications, and Seller UI state cannot silently rewrite them.
- Seller order transitions are validated, transactional, idempotent, and append immutable history. A notification, mapping, upload, or downstream delivery failure must not undo a committed Seller decision.
- The Seller-selected Logistics organization is server-validated and retained in fulfillment context; it cannot be replaced after pickup-request commitment.
- Reservation release and fulfillment conversion are idempotent: pre-`picked_up_from_seller` cancellation/rejection releases the exact reserved quantity once, while first-mile pickup commits it once without decrementing `on_hand` twice.
- The shared waybill reference, snapshot, selected Logistics organization, and Order/Parcel link become immutable in the Seller pickup transaction at `ready_for_pickup`; later activity appends events.
- Private registration/profile assets and draft/private description assets remain authorization-gated; eligible public media receives only safe delivery URLs and never exposes raw disk paths or credentials.
- Seller cannot choose or operate another Seller's Shop, Logistics organization, hub, Courier, Order, or asset by changing request parameters.

## Current and deferred data boundary

Implemented Seller foundation:

- Seller role/profile, Admin-approved registration, business address, private ID/permit evidence, Sanctum Seller web authentication, and one-to-one Shop.
- Canonical Shop/Product Category taxonomy, Product drafts/active/archived lifecycle, options, Variants, Shop-scoped SKUs, Product gallery/variant media, and Product description assets.
- Authoritative Inventory SKU balances/movements, manual adjustments, thresholds, low-stock alerts/history, Seller account/Shop settings, vacation mode, and private Seller profile photos.
- Customer checkout-created Shop Orders, immutable item/address/financial snapshots, and high-level `OrderStatus`/history foundation.

Deferred or dependent Seller operations:

- Seller order queue/approval, pickup addresses/provider selection, shared-waybill persistence, pickup scheduling/first-mile assignment, explicit Courier pickup confirmation, and related notifications are implemented. Shared Shipment/Parcel/Scan/DeliveryTask records, Logistics receipt/sorting/dispatch, final-mile delivery, proof of delivery, delivery confirmation, financial reports/settlement, reviews, chat, bulk import/export, and abandoned-cart promotions remain dependent/deferred. The owning-Seller Product Q&A queue/detail UI, answer API, and notifications are implemented; answer editing/history and moderation remain deferred by the Product Q&A contract.

Future status-like columns must be stored as strings and cast to PHP enums. Future fulfillment migrations must preserve one Seller/one Shop tenancy, immutable Order snapshots, the shared high-level OrderStatus contract, and the separate Shipment/Delivery Task milestones.

## Shared contracts

- `docs/requirements.md` — Seller responsibilities, one-Shop boundary, and first-party fulfillment flow.
- `docs/workspace.md` — Seller preparation and canonical Order/Shipment status flow.
- `docs/schema.md` — implemented Seller/catalog/inventory/order foundation and deferred fulfillment entities.
- `docs/references/user-registration-requirements.md` — Seller registration fields.
- `docs/references/file-upload-requirements.md` — registration, profile, gallery, and description-image policy.
- `docs/references/seller-shop-catagories.md` — canonical Shop/Product Category taxonomy.
- `docs/features/seller/*/spec.md` — feature-specific implementation contracts.

**Current/future boundary:** `ConfirmFirstMilePickup` currently validates the accepted Courier task and commits Seller pickup, Order `picked_up`, and Inventory fulfillment without a separate Logistics review. The accepted target requires Courier evidence submission followed by Logistics validation and a server-owned transition. That target is not implemented. Its rollout must explicitly migrate the current confirmation contract, preserve existing confirmations and stock movements, and never replay pickup or fulfill stock twice.
