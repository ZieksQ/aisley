---
feature: order-modification-cancellation
title: Customer Order Modification and Cancellation
system: AISLEY
type: Feature Specification
version: 1.3
status: Implemented — cancellation and delivery-address correction; item changes deferred
role: Customer
scope: Customer storefront and Laravel API
---

# Customer Order Modification and Cancellation

## WHAT

- **Purpose:** Give an authenticated Customer a narrowly bounded way to correct or cancel a newly placed Shop Order.
- **Current implementation:** Customer Order list/detail/tracking remain snapshot-oriented, and `placed` Orders now expose cancellation plus delivery-address correction capabilities. Both mutations are authenticated, Customer-scoped, transactional, idempotent, and reflected in the Customer Order detail UI.
- **Canonical role:** `customer` is the API, authorization, and schema term. **Buyer** is the storefront term only.
- **MVP boundary:** The normal self-service window is open only while `orders.status = placed`, before Seller acceptance changes it to `seller_processing`. Seller approval closes both actions even when pickup has not been scheduled.
- No fixed five-, ten-, or fifteen-minute grace period is approved. A time deadline may be added only with a persisted server rule and UTC revalidation.
- Cancellation uses an optional free-text reason (maximum 500 characters); no enumerated reason policy, deadline, fee, or refund promise is implied.
- The first approved modification field is `delivery_address`, selected from the Customer's existing shipping Address Book. Variant, quantity, voucher, shipping, and repricing changes remain deferred until their policies are approved.
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
- In the MVP, only `placed` is eligible. `seller_processing`, `ready_for_pickup`, `assigned`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `cancelled`, `rejected`, and other exception states deny Customer self-service.
- The race between Customer mutation and Seller `placed → seller_processing` is resolved by the locked transition; only one valid transaction may win.

### Cancellation

- Cancellation must be a named action such as planned `POST /api/v1/customer/orders/{order}/cancel`; never accept `{status: "cancelled"}` or a generic Order patch.
- Accept an optional free-text cancellation reason up to 500 characters. Do not invent reason codes, deadlines, fees, or refund promises in the client.
- Lock the Customer-scoped Order, confirm `placed`, append an immutable `placed → cancelled` status event and cancellation history, and commit atomically.
- A committed cancellation or Seller rejection before `picked_up_from_seller` releases only that Order's reserved SKU quantities, exactly once and transactionally. The release must not reduce `on_hand`.
- After `picked_up_from_seller`, automatic inventory release is prohibited. Delivery failure, returns, refunds, and partial fulfillment remain deferred until their owning policies and line-level records are approved.
- Current COD Orders remain `payment_status = pending`; cancellation does not claim a payment reversal. Any future paid cancellation needs a separate payment contract.

### Modification

- The modification endpoint exposes the single named field `address_id`; it must not accept arbitrary Order columns, status, totals, payment state, ownership, or snapshots.
- `address_id` must reference a complete shipping-capable address already owned by the Customer. Selected-variant correction, quantity, vouchers, shipping fees, one-time address creation, and repricing remain deferred.
- The immutable checkout `order_addresses`, item, financial, voucher, and payment facts cannot be overwritten. An approved change must create a superseding version/history record through an additive migration, or be rejected until that schema exists.
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
- [x] Current Customer Order DTOs expose `canCancel = true`, `canModify = true`, and `modifiableFields = ["delivery_address"]` only for `placed` Orders; all later statuses return disabled actions.
- [x] Current read endpoints are Customer-scoped and expose immutable Order snapshots, status history, and safe action capabilities.
- [x] Customer can cancel only an owned `placed` Order through a transactional, idempotent endpoint.
- [x] Delivery-address correction creates a new authoritative `order_addresses.version` and never rewrites checkout history or the Address Book source.
- [x] Reservation release, duplicate retries, stale revisions, immutable events, and Customer scoping are covered by API tests; Seller-processing locking uses the same Order row lock.
- [x] The Customer UI provides accessible confirmation, validation, loading, conflict, offline/retry, and success states for the implemented actions.

## HOW

### Existing implementation and deferred interfaces

- Implemented read routes are `GET /api/v1/customer/orders`, `GET /api/v1/customer/orders/{order}`, and `GET /api/v1/customer/orders/{order}/tracking`.
- Laravel uses `OrderController`, `OrderTrackingService`, `CustomerOrderStatusMapper`, `CustomerOrderMutationService`, `OrderResource`, and `OrderTrackingResource`; the mapper enables only the implemented `placed` actions.
- Implemented mutation routes are `POST /api/v1/customer/orders/{order}/cancel` and `PATCH /api/v1/customer/orders/{order}/modification`. Both return the safe current Order projection and private/no-store headers.
- The modification response exposes the current delivery-address `version` for optimistic revision checks. It does not expose internal event, movement, or storage details.

### Implemented endpoint contract

| Method  | Path                                           | Auth            | Request                                                           | Success                              |
| ------- | ---------------------------------------------- | --------------- | ----------------------------------------------------------------- | ------------------------------------ |
| `POST`  | `/api/v1/customer/orders/{order}/cancel`       | active Customer | `Idempotency-Key`; optional `reason` (free text, max 500) | committed cancelled Order projection |
| `PATCH` | `/api/v1/customer/orders/{order}/modification` | active Customer | `Idempotency-Key`; `address_id`; optional `expected_revision` | committed versioned delivery-address projection |

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
- The storefront implements confirmation, field errors, loading, `409` refetch, offline/retry, keyboard focus, and truthful success states for the two available actions.
- Open decisions: variant/quantity changes, voucher/shipping/repricing adjustments, cancellation deadlines or reason codes, and post-pickup cancellation, delivery-failure, return, refund, and partial-fulfillment policy.
- Until those decisions close, keep item and financial facts immutable and do not add broader Order edits.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Buyer.md`, Customer Checkout, Customer Order Status, Address Book, Seller Order Approval, Seller Prepare Orders, and Seller Inventory.
