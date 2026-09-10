---
feature: order-modification-cancellation
title: Customer Order Modification and Cancellation
system: AISLEY
type: Feature Specification
version: 1.2
status: Deferred — contract clarified; mutation API and UI not implemented
role: Customer
scope: Customer storefront and Laravel API
---

# Customer Order Modification and Cancellation

## WHAT

- **Purpose:** Give an authenticated Customer a narrowly bounded way to correct or cancel a newly placed Shop Order.
- **Current implementation:** Customer Order list/detail/tracking are read-only. There is no mutation route or UI; `CustomerOrderStatusMapper::actions()` returns `canCancel = false`, `canModify = false`, and no fields.
- **Canonical role:** `customer` is the API, authorization, and schema term. **Buyer** is the storefront term only.
- **MVP boundary:** The normal self-service window is open only while `orders.status = placed`, before Seller acceptance changes it to `seller_processing`. Seller approval closes both actions even when pickup has not been scheduled.
- No fixed five-, ten-, or fifteen-minute grace period is approved. A time deadline may be added only with a persisted server rule and UTC revalidation.
- Cancellation is the only action that can be specified without a further field-policy decision. Address or variant correction remains an allow-listed product decision, not a generic Order edit.
- One Customer checkout can produce separate Shop Orders; every mutation targets one Customer-owned Shop Order and never the whole checkout batch.
- **Non-goals:** arbitrary status/payment patches, Seller rejection, Seller preparation, Logistics/Courier actions, waybill/task changes, delivery failure, returns, refunds, disputes, online-payment reversal, and partial fulfillment.

```text
Customer opens an owned `placed` Order
→ server returns current capabilities (disabled until this feature ships)
→ future named cancel or approved modification request
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
- Validate the requested reason only if an approved reason policy exists. Do not invent reason codes, deadlines, fees, or refund promises in the client.
- Lock the Customer-scoped Order, confirm `placed`, append an immutable `placed → cancelled` status event and cancellation history, and commit atomically.
- A committed cancellation or Seller rejection before `picked_up_from_seller` releases only that Order's reserved SKU quantities, exactly once and transactionally. The release must not reduce `on_hand`.
- After `picked_up_from_seller`, automatic inventory release is prohibited. Delivery failure, returns, refunds, and partial fulfillment remain deferred until their owning policies and line-level records are approved.
- Current COD Orders remain `payment_status = pending`; cancellation does not claim a payment reversal. Any future paid cancellation needs a separate payment contract.

### Modification

- A future modification endpoint must expose named, allow-listed fields; it must not accept arbitrary Order columns, status, totals, payment state, ownership, or snapshots.
- Candidate fields are delivery-address correction and selected-variant correction. Quantity, vouchers, shipping fees, one-time address creation, and repricing rules remain open until explicitly approved.
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

- The current Order detail must keep both Customer actions disabled and must not render an unavailable control as functional.
- Future forms must show only server-returned capabilities and approved fields, with confirmation naming the Order reference and truthful COD wording.
- On `409`, refetch the Order detail, explain that Seller processing or another state change won, and remove stale actions. On `422`, retain accessible field-level errors.
- Guests are redirected to sign in with a same-origin return path and must intentionally retry after authentication; no guest mutation is stored locally.
- Do not optimistically claim success. Refresh the authoritative Order projection only after the API commits.
- [x] Current Customer Order DTOs expose `canCancel = false`, `canModify = false`, and `modifiableFields = []`.
- [x] Current read endpoints are Customer-scoped and expose immutable Order snapshots, status history, and safe action capabilities.
- [ ] Customer can cancel only an owned `placed` Order through a transactional, idempotent endpoint.
- [ ] Approved modification fields create a new authoritative snapshot/version and never rewrite checkout history or the Address Book source.
- [ ] Reservation release, Seller-processing races, duplicate retries, immutable events, and after-commit notification failure are covered by API tests.
- [ ] The Customer UI provides accessible confirmation, validation, loading, conflict, retry, and success states for implemented actions.

## HOW

### Existing implementation and unavailable interfaces

- Implemented read routes are `GET /api/v1/customer/orders`, `GET /api/v1/customer/orders/{order}`, and `GET /api/v1/customer/orders/{order}/tracking`.
- Laravel uses `OrderController`, `OrderTrackingService`, `CustomerOrderStatusMapper`, `OrderResource`, and `OrderTrackingResource`; the mapper deliberately disables mutations.
- Planned routes `POST /api/v1/customer/orders/{order}/cancel` and `PATCH /api/v1/customer/orders/{order}/modification` are unavailable. Do not copy them as working calls until their service, migration, tests, and deployment exist.
- A future response should return the safe current Order projection, status/group, updated snapshots when approved, and server capabilities. It must not expose internal IDs, private operational notes, or raw storage paths.

### Planned endpoint contract (unavailable)

| Method | Path | Auth | Request | Success |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/customer/orders/{order}/cancel` | active Customer | `Idempotency-Key`; approved reason and optional expected revision | committed cancelled Order projection |
| `PATCH` | `/api/v1/customer/orders/{order}/modification` | active Customer | `Idempotency-Key`; one approved named change only | committed versioned Order projection |

- Both routes must use JSON responses with a stable error code, field errors where applicable, and private/no-store cache headers.
- Cancellation is safe to retry with the same key. Modification requests must include a deterministic request hash so a changed retry cannot reuse an old result.
- The server must return `409` for an already-processed key with different details, a Seller-processing race, a stale revision, or an unavailable downstream regeneration.
- A `404` must not reveal whether an Order exists for another Customer. `422` must identify only the submitted field or reason problem, never hidden account data.

### Transaction and data flow

- Resolve the authenticated Customer and scoped Order → lock and reload → validate status/deadline/idempotency → validate named changes → recalculate affected inventory/price/shipping/payment consequences → write snapshot revision, status event, movement, and idempotency result → commit → dispatch notifications.
- Reuse `Order`, `OrderAddress`, `OrderItem`, `OrderStatusEvent`, `InventoryMovement`, `CheckoutService`, and `CustomerOrderStatusMapper` where their boundaries fit. Do not make Order Status read code perform mutations.
- Add only additive migrations for cancellation/modification history, snapshot revisions, reservation links, or idempotency. Enum-like columns remain strings with PHP enum casts; executed migrations are never edited.
- Preserve one Order per Shop, the server-owned COD `placed`/pending-payment rule, immutable checkout snapshots, and the approved first-mile inventory boundary.
- The status event and inventory movement must carry the same request/correlation ID. If any write fails, the transaction rolls back and no notification is dispatched.
- After commit, notification delivery is retried independently; a failed queue/email provider is observable but cannot restore `placed` or reapply released stock.

### Verification, rollout, and open decisions

- API tests must cover ownership and role denial, exact `placed` eligibility, Seller race, duplicate/replayed keys, reservation release once, snapshot independence, variant/stock validation, COD separation, immutable history, notification failure, and no-store safe responses.
- Storefront tests must cover sign-in return, disabled current actions, confirmation, field errors, loading, `409` refetch, offline/retry, keyboard focus, and truthful success states.
- Implement cancellation first only after its reason, history, idempotency, notification, and reservation records are approved. Add modification only after its field list and snapshot-versioning design are approved.
- Open decisions: approved modifiable fields; cancellation reasons and any server deadline; versioned address/item snapshot schema; quantity/variant reservation adjustments; and post-pickup cancellation, delivery-failure, return, refund, and partial-fulfillment policy.
- Until those decisions close, keep the current read-only Order Status contract and do not add disabled placeholder mutations to the storefront.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Buyer.md`, Customer Checkout, Customer Order Status, Address Book, Seller Order Approval, Seller Prepare Orders, and Seller Inventory.
