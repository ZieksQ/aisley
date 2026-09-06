---
feature: accept-order
title: Seller Accept Order
system: AISLEY
type: Feature Specification
version: 1.0
status: Implementation-ready draft
role: Seller
scope: Seller Web Application and Laravel API
---

# Seller Accept Order

## WHAT

- **Purpose:** Let an active Seller review a Seller-scoped Customer Order, accept responsibility for fulfillment, and hand a prepared parcel into Aisley Logistics.
- **Canonical action:** The UI may say **Accept Order**, but the domain action is `StartSellerOrderProcessing`; it performs `placed → seller_processing`. There is no persisted `accepted` Order status.
- **Integrated flow:**
  ```text
  Customer checkout
  → Seller new-order notification
  → Seller accepts / starts processing
  → Seller prepares and marks the package ready
  → Logistics is notified
  → first-mile Courier pickup, possibly in a bulk pickup run
  → Logistics receives the parcel and generates the waybill
  → Seller and Logistics can view the authorized waybill
  → remaining shipment, transfer, dispatch, and delivery flow belongs to Logistics/Courier
  ```
- **Payment decision:** COD is the only current payment method. A valid COD Order may be accepted while `payment_status = pending`; payment becomes `paid` only when delivery is completed by the downstream delivery/payment transition. Seller acceptance never changes payment state.
- **Waybill decision:** Seller does not generate or edit a waybill. Logistics generates it after receiving the parcel; Seller receives read-only access after generation.
- **Project boundary:** One Customer checkout creates one Seller/Shop Order per Shop. Seller reads and mutations are always scoped to the authenticated Seller's one Shop.
- **Non-goals:** payment collection, Seller-generated waybills, Courier assignment, Courier pickup mutation, Logistics scans/transfers, delivery completion, Buyer address editing, arbitrary Order edits, and direct Inventory balance writes.

## MUST

### Authentication, ownership, and data

- Require Sanctum authentication, active `SELLER` role, and the Seller's server-derived Shop.
- Resolve the target Order through the Shop relationship; never trust `seller_id`, `shop_id`, status, payment state, recipient, or submitted item data.
- Return `401` unauthenticated, `403` inactive/wrong-role, `404` for a non-Shop-scoped Order, `409` for a stale/invalid transition, and `422` only for malformed action input.
- Display immutable `order_items` snapshots, the immutable `order_addresses` snapshot, COD payment facts, totals, and current server-calculated capabilities. Current Product edits must not rewrite the purchased facts.

### Accept action

- The Order is acceptable only when all are true:
  - it belongs to the authenticated Seller's Shop;
  - `orders.status = placed`;
  - `payment_method = cod` and `payment_status = pending`;
  - it is not cancelled, rejected, delivered, or already in downstream fulfillment;
  - its Customer, Shop, item snapshots, address snapshot, and reserved inventory remain valid.
- Use `POST /api/v1/seller/orders/{order}/accept` with an `Idempotency-Key` header. The request must not accept an arbitrary target status.
- Inside one transaction, re-read and lock the Order, revalidate the Seller/Shop, COD state, current status, cancellation eligibility, and required inventory preconditions, then append the `placed → seller_processing` status event.
- Repeated submission of the same idempotency key returns the committed processing result. A competing or stale action returns `409` without duplicate history, notifications, or inventory effects.
- Opening an Order or marking its notification read must never start processing.

### Customer and Inventory boundaries

- Once `seller_processing` commits, normal Customer cancellation and modification are no longer available. A concurrent Customer cancellation and Seller accept action has one transactionally valid winner.
- Customer Order Status continues to map `placed`, `seller_processing`, and `ready_for_pickup` to **To Prepare**. Only Logistics receipt later changes the high-level Order to `assigned` / Customer **To Ship**.
- Accepting an Order must not consume reserved stock, decrement `on_hand`, or create a second inventory ledger path. Inventory fulfillment conversion remains owned by its approved downstream action.

### Prepare and Logistics handoff

- After acceptance, route the Seller to Prepare Orders. That feature owns item verification, package details, packing, and `seller_processing → ready_for_pickup`.
- Seller readiness must validate the immutable item quantities, package information, payment state, current Order state, and any approved fulfillment prerequisite before committing.
- A committed `ready_for_pickup` transition emits an after-commit `OrderReadyForPickup` event/notification to the authorized Logistics organization. It must not generate a waybill or assign a Courier.
- Logistics may combine multiple Seller-ready Orders into one first-mile pickup run or manifest. The batch is an operational grouping only: every Order keeps its own status, package identity, pickup evidence, history, and idempotency boundary.
- Before a waybill exists, Logistics/Courier must use an authorized pickup manifest or opaque Order/package reference. The final waybill is created only after Logistics receives the parcel.
- Waybill generation, receipt scans, `assigned`, hub processing, transfer, dispatch, final-mile assignment, and delivery belong to Logistics/Courier contracts. Seller may only view a generated waybill through an authorized read endpoint.

### Notifications and privacy

- A successful checkout creates at most one actionable Seller notification per Seller-scoped Order after the checkout transaction commits. COD does not wait for `paid`.
- Seller notification/read state, Seller processing state, Logistics readiness notification, and Courier pickup state are separate records/transitions.
- Notification or broadcast failure must not roll back a committed Order transition. Payloads contain safe IDs/references and no payment credentials, tokens, or unnecessary Buyer data.

### Acceptance criteria

- [ ] A Seller sees only Orders belonging to the Seller's Shop.
- [ ] A COD Order with `placed`/`pending` payment can be accepted exactly once.
- [ ] Accepting transitions only `placed → seller_processing` and appends immutable history.
- [ ] Notification read/open does not change Order status.
- [ ] Concurrent Customer cancellation and Seller acceptance cannot both commit incompatible transitions.
- [ ] Acceptance does not mark payment paid, generate a waybill, assign a Courier, or mutate Inventory balances.
- [ ] Seller readiness emits a committed Logistics handoff and supports downstream bulk pickup grouping without merging Orders.
- [ ] Logistics generates the waybill after receipt; Seller and Logistics can view it only through role-scoped endpoints.

## HOW

### Interfaces and data flow

```http
GET  /api/v1/seller/orders
GET  /api/v1/seller/orders/{order}
POST /api/v1/seller/orders/{order}/accept
POST /api/v1/seller/notifications/{notification}/read
GET  /api/v1/seller/orders/{order}/waybill
```

- Order list/detail responses expose `status`, `payment_method`, `payment_status`, immutable snapshots, `can_accept`, `can_prepare`, `can_view_waybill`, and safe notification references computed by Laravel.
- Implement a Seller-scoped `AcceptSellerOrder` action over the shared `OrderTransitionService`; use a Policy/scoped query, Form Request, API Resource, transaction, row lock, idempotency guard, and after-commit event listener.
- Reuse `Prepare Orders` for `/seller/orders/{order}/prepare`; do not duplicate package or readiness rules in the Accept action.
- Use `OrderReadyForPickup` as the downstream contract. Logistics owns bulk pickup task/manifest creation, Courier pickup confirmation, receipt validation, and post-receipt waybill generation.
- Seller frontend belongs in the React/Vite Seller SPA with shared `@aisley/ui` primitives. Provide loading, actionable, processing, stale/conflict, cancelled/rejected, unavailable, and retry states with keyboard-accessible actions.
- No new Order or payment enum is needed. Any future idempotency, pickup-manifest, or waybill read model uses additive migrations and string-backed enum-like columns with PHP enum casts.

### Verification and rollout

- API tests cover role/Shop isolation, COD pending acceptance, invalid states, duplicate/concurrent requests, cancellation races, immutable snapshots, no payment/Inventory/waybill side effects, after-commit events, and safe waybill visibility.
- Seller tests cover inbox/detail/deep-link behavior, Accept success, disabled capability, `409` refetch, notification read separation, navigation to Prepare Orders, and accessible error states.
- Roll out in dependency order: Seller order list/detail and notification → Accept action → Prepare readiness event → Logistics bulk pickup/receipt → Logistics waybill read/generation → remaining shipment flow.
- Log correlation ID, Seller/Shop/Order IDs, transition source, idempotency result, and event outcome; never log full address, payment secrets, or raw Buyer payloads.

### Research alignment and open decisions

- Shopee's seller flow separates **To Ship**, Arrange Shipment, pickup/drop-off selection, AWB printing, and mass pickup; late shipment/pickup can lead to system cancellation. See [Shopee seller fulfillment guide](https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/e68a7068c5423d45decff4573cd3fdef/How%20to%20fulfil%20an%20order%20in%20seller%20centre.pdf), [Shopee mass pickup guide](https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/6f01c96a4fa2e7feb8c441245ea98b4b/9.9%20Campaign%20Preparation.pdf), and [Shopee COD guidance](https://help.shopee.ph/portal/4/article/135541-How-do-I-choose-Cash-on-Delivery-(COD)-as-a-payment-option-(TAG)).
- Lazada's official fulfillment APIs separate Pack, PrintAWB, ReadyToShip, and pickup operations; some document endpoints accept multiple packages. See [Lazada fulfillment API](https://open.lazada.com/apps/doc/doc?docId=120984&nodeId=30764) and [Lazada Pack/PrintAWB/ReadyToShip guide](https://open.lazada.com/apps/doc/doc?docId=121328&nodeId=43453).
- Aisley intentionally keeps Seller acceptance and readiness separate from Logistics waybill ownership, and keeps bulk pickup as a downstream per-Order operational grouping.
- Open: exact pickup-manifest/scan artifact before waybill creation, Seller processing deadline/SLA, notification channel/polling, and the owner of the final `pending → paid` payment update at delivery completion.
