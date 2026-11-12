---
feature: order-modification-cancellation
title: Customer Order Modification and Cancellation
system: AISLEY
type: Feature Specification
version: 1.6
status: Implemented — cancellation and reviewed saved delivery-address changes; item changes deferred
role: Customer
scope: Customer storefront and Laravel API
---

# Customer Order Modification and Cancellation

## WHAT

- **Purpose:** Give an authenticated Customer a narrowly bounded way to correct or cancel a newly placed Shop Order.
- **Current implementation:** Customer Order list/detail/tracking remain snapshot-oriented, and `placed` Orders now expose cancellation plus delivery-address correction capabilities. Both mutations are authenticated, Customer-scoped, transactional, idempotent, and reflected in the Customer Order detail UI.
- **Canonical role:** `customer` is the API, authorization, and schema term. **Buyer** is the storefront term only.
- **MVP boundary:** The normal self-service window is open only while `orders.status = placed`, before Seller acceptance changes it to `seller_processing`. Seller approval closes address modification; cancellation reopens only after the preparation deadline expires while the Order remains `seller_processing`.
- Seller preparation lasts 72 elapsed hours from recorded acceptance. After expiry, the Buyer may cancel or approve one additional 72-hour window from approval; after that expiry only cancellation remains. Nothing cancels automatically.
- Cancellation uses an optional free-text reason (maximum 500 characters); no enumerated reason policy, fee, or refund promise is implied.
- The first approved modification field is `delivery_address`, selected from the Customer's existing shipping Address Book. Variant, quantity, provider selection and voucher selection remain deferred. Delivery repricing follows the confirmed-address contract below.
- One Customer checkout can produce separate Shop Orders; every mutation targets one Customer-owned Shop Order and never the whole checkout batch.
- **Non-goals:** arbitrary status/payment patches, Seller rejection, Seller preparation, Logistics/Courier actions, waybill/task changes, delivery failure, returns, refunds, disputes, online-payment reversal, and partial fulfillment.

```text
Customer opens an owned `placed` Order
→ server returns current capabilities
→ Customer confirms cancellation or selects an approved saved-address change
→ Laravel authorizes and locks the Order, rechecks state and reservation
→ commit one transition/revision or return a conflict
→ append immutable history → commit → notify after commit
```

## MUST

### Authorization and eligibility

- Require `auth:sanctum` and `customer.active` for every future mutation. Resolve the Order through `orders.customer_id`; never accept a Customer, Seller, Shop, or batch owner ID from the client.
- Return `401` without an authenticated session, `403` for a wrong role or inactive Customer, `404` for an Order outside the Customer scope, `422` for malformed/forbidden fields, and `409` when a valid Order became ineligible.
- Re-read authoritative status, payment state, snapshots, reservation, and any approved deadline inside the transaction. Client action flags, countdowns, totals, and status values are advisory only.
- Address modification remains `placed` only. Cancellation additionally accepts overdue `seller_processing` pending-COD Orders with acceptance evidence, intact snapshots/reservations and no pickup, waybill, parcel or first-mile task. Later and terminal states deny both actions.
- The race between Customer mutation and Seller `placed → seller_processing` is resolved by the locked transition; only one valid transaction may win.

### Cancellation

- Cancellation must be a named action such as planned `POST /api/v1/customer/orders/{order}/cancel`; never accept `{status: "cancelled"}` or a generic Order patch.
- Accept an optional free-text cancellation reason up to 500 characters. Do not invent reason codes, deadlines, fees, or refund promises in the client.
- Lock the Customer-scoped Order, confirm eligible `placed` or overdue `seller_processing`, append an immutable transition to `cancelled` and cancellation history, and commit atomically.
- A committed cancellation or Seller rejection before `picked_up_from_seller` releases only that Order's reserved SKU quantities, exactly once and transactionally. The release must not reduce `on_hand`.
- After `picked_up_from_seller`, automatic inventory release is prohibited. Delivery failure, returns, refunds, and partial fulfillment remain deferred until their owning policies and line-level records are approved.
- Current COD Orders remain `payment_status = pending`; cancellation does not claim a payment reversal. Any future paid cancellation needs a separate payment contract.

### Modification

- The modification endpoint exposes the named field `address_id` plus quote/revision metadata; it must not accept arbitrary Order columns, status, totals, payment state, ownership, or snapshots.
- `address_id` references a complete Customer-owned shipping/both saved address. The storefront selects an existing row without editing the Address Book. Changed recipient, phone, destination and optional complete valid pin are supported through review.
- `POST /api/v1/customer/orders/{order}/modification/quote` accepts only `address_id` and required integer `expected_revision >= 1`; returns `{data:{quoteId,expiresAt,expectedRevision,address,shippingProvider,previous,proposed}}`. `address` uses the saved-address DTO. Both totals contain decimal-string `shippingFee`, `shippingDiscount`, `payable` and `currency`. Quotes expire in ten minutes and have no Order/inventory/voucher effects.
- Confirmation uses the existing PATCH endpoint with `address_id`, `expected_revision`, `quote_id` and UUID `Idempotency-Key`. Revalidate the Customer/Order-bound quote, saved-address values, current address/pricing revisions, order state, provider eligibility, complete route and tariff/rate inputs while holding the routing gate then Order/address locks. Reject expired/stale reviews with `409 MODIFICATION_QUOTE_EXPIRED` / `MODIFICATION_QUOTE_STALE`; require a fresh deliberate review.
- Keep the current provider. Requote using stored physical parcel measurements, quantities, origin and Shop category; do not use changed catalog prices/measurements. Block unavailable coverage; never substitute a provider or use unplanned fallback pricing.
- Preserve purchased merchandise, merchandise discounts, commission policies, reservations and voucher redemptions. Shipping saving is `min(current committed saving, new shipping fee)` with original issuer attribution; it may decrease but never increase through an address change. Do not recheck redeemed voucher expiry or consume capacity again. Update effective shipping funding, Logistics commission/pool, Seller proceeds and COD atomically; require balanced funding.
- Append immutable address and pricing revisions, linked by `address_version`; never overwrite checkout snapshots or original Order voucher/redemption facts. Current Order/Batch, fulfillment and finance projections use the latest pricing revision and effective shipping savings. Audit scans exclude superseded pricing revisions.
- Missing stored parcel/pricing inputs return `409 ORDER_PRICING_UNAVAILABLE`. Legacy PATCH requests without `quote_id` remain contact-only: identical trimmed locations and seven-decimal pins, `422 ADDRESS_LOCATION_CHANGE_NOT_ALLOWED` on a location difference and `409 ADDRESS_UNCHANGED` on no change. They do not reprice shipping.
- Address modification never edits or deletes the Customer Address Book source. Logistics later reads the current committed Order snapshot/version, not a mutable default address.
- Variant changes must revalidate Product/Variant/SKU ownership, visibility, current price/discount, stock, Shop, and shipping rules using Checkout authority. Reservation adjustments must be atomic and idempotent.
- If a downstream package, waybill, assignment, or task already exists, deny the change unless its owning workflow supplies an explicit safe regeneration contract; never leave stale destination or item data downstream.

### Consistency, privacy, and communication

- Require a Customer-scoped `Idempotency-Key` for every mutation. Persist a request hash/result when the supporting migration is approved; a retry with the same key returns the original result, while different details return `409`.
- Append actor, request ID, timestamp, safe before/after summaries, and the authoritative source. Never overwrite history or log tokens, passwords, full private addresses, payment secrets, or raw storage paths.
- Dispatch Customer/Seller notifications only after commit. A failed email, in-app notification, or queue delivery must not undo a committed cancellation or modification; retry and delivery state are separate concerns.
- Keep Order status, payment state, inventory movement, snapshot revisions, and notification records separate. A notification read/open must never mutate the Order.

### Customer experience and acceptance

- The current Order detail shows only server-returned capabilities and does not render unavailable controls as functional.
- Mutation forms show only the server-returned approved fields, with confirmation naming the Order reference and truthful COD wording.
- On `409`, refetch the Order detail, explain that Seller processing or another state change won, and remove stale actions. On `422`, retain accessible field-level errors.
- Guests are redirected to sign in with a same-origin return path and must intentionally retry after authentication; no guest mutation is stored locally.
- Do not optimistically claim success. Refresh the authoritative Order projection only after the API commits.
- [x] Current Customer Order DTOs expose `canCancel = true`, `canModify = true`, and `modifiableFields = ["delivery_address"]` for `placed` Orders; overdue processing additionally enables cancellation and one-time preparation extension, never modification.
- [x] Current read endpoints are Customer-scoped and expose immutable Order snapshots, status history, and safe action capabilities.
- [x] Customer can cancel an owned eligible `placed` or overdue `seller_processing` Order through a transactional, idempotent endpoint.
- [x] Delivery-address correction creates a new authoritative `order_addresses.version` and never rewrites checkout history or the Address Book source.
- [x] Reservation release, duplicate retries, stale revisions, immutable events, and Customer scoping are covered by API tests; Seller-processing locking uses the same Order row lock.
- [x] The Customer UI provides accessible confirmation, validation, loading, conflict, offline/retry, and success states for the implemented actions.

## HOW

### Existing implementation and deferred interfaces

- Implemented read routes are `GET /api/v1/customer/orders`, `GET /api/v1/customer/orders/{order}`, and `GET /api/v1/customer/orders/{order}/tracking`.
- Laravel uses `OrderController`, `OrderTrackingService`, `CustomerOrderStatusMapper`, `CustomerOrderMutationService`, `OrderResource`, and `OrderTrackingResource`; the mapper combines status with the preparation policy for deadline-aware capabilities.
- Implemented mutation routes are `POST /api/v1/customer/orders/{order}/cancel` and `PATCH /api/v1/customer/orders/{order}/modification`; the quote route is described above. Mutations return the safe current Order projection and private/no-store headers.
- The Order response exposes the current delivery-address `version` for optimistic revision checks and nullable seven-decimal-string `latitude`/`longitude` for location-equivalence checks. It does not expose internal event, movement, or storage details.

### Implemented endpoint contract

| Method  | Path                                           | Auth            | Request                                                           | Success                              |
| ------- | ---------------------------------------------- | --------------- | ----------------------------------------------------------------- | ------------------------------------ |
| `POST`  | `/api/v1/customer/orders/{order}/cancel`       | active Customer | `Idempotency-Key`; optional `reason` (free text, max 500) | committed cancelled Order projection |
| `PATCH` | `/api/v1/customer/orders/{order}/modification` | active Customer | `Idempotency-Key`; `address_id`; `expected_revision` and `quote_id` for reviewed changes (legacy contact-only omits quote) | committed versioned delivery-address projection |

- Both routes must use JSON responses with a stable error code, field errors where applicable, and private/no-store cache headers.
- Cancellation and address-modification requests are safe to retry with the same key. Each request persists a deterministic request hash so a changed retry cannot reuse an old result.
- The server must return `409` for an already-processed key with different details, a Seller-processing race, a stale revision, or an unavailable downstream regeneration.
- A `404` must not reveal whether an Order exists for another Customer. `422` must identify only the submitted field or reason problem, never hidden account data.

### Transaction and data flow

- Resolve the authenticated Customer and scoped Order → lock and reload → validate status/idempotency → validate the named address change when present → release the Order reservation for cancellation → write snapshot revision or status event plus mutation history/idempotency result → commit → dispatch after-commit notifications.
- Reuse `Order`, `OrderAddress`, `OrderItem`, `OrderStatusEvent`, `InventoryMovement`, `CheckoutService`, and `CustomerOrderStatusMapper` where their boundaries fit. Do not make Order Status read code perform mutations.
- Additive migration `2026_09_10_000009_create_customer_order_mutations` adds cancellation/modification history, Customer-scoped idempotency records, and versioned Order address snapshots. Enum-like columns remain strings with PHP enum casts; executed migrations are never edited.
- Preserve one Order per Shop, the server-owned COD `placed`/pending-payment rule, immutable checkout snapshots, and the approved first-mile inventory boundary.
- The status event, mutation history, and inventory movement are written in the same transaction and are correlated by the Order and persisted Customer-scoped idempotency record. If any write fails, the transaction rolls back and no notification is dispatched.
- After commit, notification delivery is retried independently; a failed queue/email provider is observable but cannot restore `placed` or reapply released stock.

### Verification, rollout, and open decisions

- API tests cover Customer scoping, exact `placed` eligibility, duplicate/replayed keys, reservation release once, stale address revisions, immutable snapshot history, COD separation, and safe no-store responses. Seller acceptance and Customer mutation serialize on the locked Order row.
- The storefront labels the action **Change delivery address**, lists saved shipping rows, marks the current row, and requires **Review delivery total** then **Confirm address change**. Review displays the server-returned recipient/destination, unchanged provider and current/new shipping fee, saving and COD. Cancelling does not mutate the Order. Quotes and confirmation are separate requests.
- Failed reads/quotes retain clear loading/error/empty states and selected drafts. Confirmation freezes address, quote, revision and key through uncertain retries; editing/closing stays blocked until reconciliation. Late replies after account departure cannot repopulate state. Dialogs contain focus, support safe Escape, restore focus and fit narrow/short viewports.
- Additive migration `2026_11_04_000001_version_order_address_pricing` adds short-lived modification quote metadata and pricing `version`/`address_version`. Reversal refuses to collapse committed pricing history; use a forward migration after the first revision. Deploy the migration before the API, then the storefront; legacy contact correction remains compatible. No backfill reprices existing Orders.
- Regression coverage includes ownership, shipping eligibility, stale/expired review, source edits/deletion, exact replay, repeated changes, frozen catalog facts, capped App/Shop savings, rollback and PostgreSQL races. Runtime evidence is recorded separately; this change does not establish external Flutter adoption.
- Open decisions: variant/quantity changes, voucher/provider selection or merchandise repricing adjustments, cancellation reason codes, and post-pickup cancellation, delivery-failure, return, refund, and partial-fulfillment policy.
- Until those decisions close, keep item and financial facts immutable and do not add broader Order edits.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Buyer.md`, Customer Checkout, Customer Order Status, Address Book, Seller Order Approval, Seller Prepare Orders, and Seller Inventory.

Runtime checks: [2026-11-04 verification](verification-2026-11-04.md).

### Required delivery pin — 2026-11-05

- Address Book saves may remain unpinned. Shipping options, checkout quotes/placement, and Order destination-change preview/confirmation require a saved finite coordinate pair within latitude -90..90 and longitude -180..180.
- Reject missing/invalid pins with `422 ADDRESS_PIN_REQUIRED`, field `address_id`, before purchase or modification effects. Successful exact-key placement replays remain available after Address Book changes.
- Offer address editing and explicit map/manual coordinate confirmation; text edits invalidate the pin. Preserve entered fields on provider failure and never fabricate coordinates.

### Preparation extension — 2026-11-12

- `POST /api/v1/customer/orders/{order}/preparation-extension` requires active Customer/consent, UUID `Idempotency-Key` and an empty JSON body. Return `200 {data:Order}`, private/no-store; exact replay returns the current Order without restarting the deadline. Unsupported fields/key return `422`, foreign Orders `404`, ineligible/used extension `409 ORDER_PREPARATION_NOT_EXTENDABLE`, and reused keys for another Order `409 IDEMPOTENCY_KEY_REUSED`.
- Persist one extension per Order with Customer, approval/deadline UTC times, event link and replay hash/key. Append `preparation_extended` timeline history without changing Order/payment/Inventory or sending another acceptance notification. Serialize extension/cancellation/pickup on the Order lock; cancellation releases reserved stock once.
- Read/list projections add `preparation` (acceptance, initial/current deadline, extension time/usage, active/overdue and server time) plus `actions.canExtendPreparation`. Missing original acceptance disables preparation actions. Existing accepted Orders use their original history, independent of the paginated timeline.
- Web and Buyer mobile detail show local deadlines, explicit confirmation and exact uncertain retry. One extension suppresses cancellation until its expiry; pickup readiness closes both actions. Seller may finish late until cancellation commits. Deploy the additive extension migration before clients; no expiry scheduler or automatic cancellation is needed.
