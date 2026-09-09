---
feature: order-approval
title: Seller Order Approval
system: AISLEY
type: Feature Specification
version: 1.4
status: Implementation-ready draft
role: Seller
scope: Seller Web Application and Laravel API
---

# Seller Order Approval

## WHAT

- **Purpose:** Let an active Seller approve or reject a Seller-scoped Customer Order, monitor its lifecycle, and hand prepared Orders into Aisley Logistics.
- **Canonical action:** The UI calls this **Order Approval**. Approve performs `placed → seller_processing`; reject performs `placed → rejected` and releases only that Order's Inventory reservation. There is no persisted `approved` Order status.
- **Integrated flow:**
  ```text
  Customer checkout
  → Seller new-order notification
  → Seller approves / starts processing, or rejects before processing
  → Seller packs, selects Logistics, requests pickup, and prints each waybill
  → selected Logistics is notified
  → first-mile Courier pickup, possibly in a bulk pickup run
  → Seller and selected Logistics can view the same authorized waybill
  → remaining shipment, transfer, dispatch, and delivery flow belongs to Logistics/Courier
  ```
- **Payment decision:** COD is the only current payment method. A valid COD Order may be approved while `payment_status = pending`; payment becomes `paid` only when delivery is completed by the downstream delivery/payment transition. Seller approval never changes payment state.
- **Waybill decision:** Aisley creates one immutable shared waybill per Order in the Seller's pickup-request transaction; Seller and selected Logistics receive role-scoped access.
- **Project boundary:** One Customer checkout creates one Seller/Shop Order per Shop. Seller reads and mutations are always scoped to the authenticated Seller's one Shop.
- **Order navigation:** Seller Orders are separated into Monitoring, Approval, and Pickup sections. Monitoring provides status counts and sorting; Approval owns approve/reject decisions; Pickup owns multi-Order readiness requests.
- **Non-goals:** payment collection, editable/client-generated waybill data, Courier assignment, Courier pickup confirmation, Logistics scans/transfers, delivery completion, Buyer address editing, and arbitrary Order edits.

## MUST

### Authentication, ownership, and data

- Require Sanctum authentication, active `SELLER` role, and the Seller's server-derived Shop.
- Resolve the target Order through the Shop relationship; never trust `seller_id`, `shop_id`, status, payment state, recipient, or submitted item data.
- Return `401` unauthenticated, `403` inactive/wrong-role, `404` for a non-Shop-scoped Order, `409` for a stale/invalid transition, and `422` only for malformed action input.
- Display immutable `order_items` snapshots, the immutable `order_addresses` snapshot, COD payment facts, totals, and current server-calculated capabilities. Current Product edits must not rewrite the purchased facts.

### Approval actions

- The Order is acceptable only when all are true:
  - it belongs to the authenticated Seller's Shop;
  - `orders.status = placed`;
  - `payment_method = cod` and `payment_status = pending`;
  - it is not cancelled, rejected, delivered, or already in downstream fulfillment;
  - its Customer, Shop, item snapshots, address snapshot, and reserved inventory remain valid.
- Use `POST /api/v1/seller/orders/{order}/approve` or `POST /api/v1/seller/orders/{order}/reject` with an `Idempotency-Key` header. Neither request accepts an arbitrary target status.
- Rejection is available only while the Order is still `placed`. It appends immutable rejection history and releases the exact Order-linked reservation without reducing `on_hand`.
- Inside one transaction, re-read and lock the Order, revalidate the Seller/Shop, COD state, current status, cancellation eligibility, and required inventory preconditions, then append the `placed → seller_processing` status event.
- Repeated submission of the same idempotency key returns the committed processing result. A competing or stale action returns `409` without duplicate history, notifications, or inventory effects.
- Opening an Order or marking its notification read must never start processing.

### Customer and Inventory boundaries

- Once `seller_processing` commits, normal Customer cancellation and modification are no longer available. A concurrent Customer cancellation and Seller approval action has one transactionally valid winner.
- Customer Order Status continues to map `placed`, `seller_processing`, and `ready_for_pickup` to **To Prepare**. Only Logistics receipt later changes the high-level Order to `assigned` / Customer **To Ship**.
- Approving an Order must not consume reserved stock, decrement `on_hand`, or create a second inventory ledger path. Inventory fulfillment conversion remains owned by its approved downstream action.

### Prepare and Logistics handoff

- After approval, route the Seller to Pickup. Seller may review item snapshots and select up to 50 `seller_processing` Orders for one pickup request when they are physically ready.
- `POST /api/v1/seller/orders/pickup-requests` groups the selected Orders with one eligible Seller-selected Logistics organization, creates one waybill per Order, transitions each to `ready_for_pickup`, and notifies only that organization after commit. Pickup date/Courier remain null until Logistics schedules them.
- Seller readiness validates immutable item quantities, payment state, current Order state, Order-linked Inventory reservation, and Logistics eligibility before committing. Package measurements remain deferred for this MVP.
- A committed `ready_for_pickup` transition freezes the selected Logistics organization and waybill snapshots. It must not set a pickup date, assign a Courier, or claim physical custody.
- Each solo or multi-Order pickup request requires exactly one authenticated-Seller-owned pickup address. That same address applies to every Order in the request, and every waybill freezes its fields and coordinates so later address-book edits cannot rewrite committed pickup instructions.
- Before the first pickup request, the highest-ranked eligible provider remains the suggestion. The provider chosen for the Seller's first committed pickup request becomes the default while it remains eligible; choosing another provider for a later request does not silently replace that default.
- Logistics may combine multiple Seller-ready Orders into one first-mile pickup run or manifest. The batch is an operational grouping only: every Order keeps its own status, package identity, pickup evidence, history, and idempotency boundary.
- Logistics/Courier use the authorized shared waybill reference/QR for parcel verification; scanning alone does not advance custody.
- Receipt scans, `assigned`, hub processing, transfer, dispatch, final-mile assignment, and delivery belong to Logistics/Courier contracts. Seller retains read-only access to the immutable waybill.

### Notifications and privacy

- A successful checkout creates at most one actionable Seller notification per Seller-scoped Order after the checkout transaction commits. COD does not wait for `paid`.
- Seller notification/read state, Seller processing state, Logistics readiness notification, and Courier pickup state are separate records/transitions.
- Notification or broadcast failure must not roll back a committed Order transition. Payloads contain safe IDs/references and no payment credentials, tokens, or unnecessary Buyer data.

### Acceptance criteria

- [ ] A Seller sees only Orders belonging to the Seller's Shop.
- [ ] A COD Order with `placed`/`pending` payment can be approved or rejected exactly once.
- [ ] Approval transitions only `placed → seller_processing`; rejection transitions only `placed → rejected`, releases its reservation, and both append immutable history.
- [ ] Notification read/open does not change Order status.
- [ ] Concurrent Customer cancellation and Seller approval cannot both commit incompatible transitions.
- [ ] Approval does not mark payment paid, generate a waybill, assign a Courier, or mutate Inventory balances.
- [ ] Seller readiness emits a committed Logistics handoff and supports downstream bulk pickup grouping without merging Orders.
- [ ] Pickup readiness creates immutable waybills; Seller and selected Logistics can view them only through role-scoped endpoints.
- [ ] The Seller can choose one owned saved pickup address for a solo or bulk pickup request, with the default address prefilled, and no foreign or missing address can be committed.
- [ ] Provider selection uses a searchable modal that exposes provider name, operational hub address, current distance evidence, and applicable Default/Suggested/Near-you tags without preventing another eligible selection.

## HOW

### Interfaces and data flow

```http
GET  /api/v1/seller/orders
GET  /api/v1/seller/orders/{order}
POST /api/v1/seller/orders/{order}/approve
POST /api/v1/seller/orders/{order}/reject
POST /api/v1/seller/orders/pickup-requests
POST /api/v1/seller/notifications/{notification}/read
GET  /api/v1/seller/orders/{order}/waybill
```

- Order list/detail responses expose `status`, payment facts, immutable snapshots, `can_approve`, `can_reject`, `can_prepare`, pickup state, `can_view_waybill`, safe notification references, and Shop-scoped status counts computed by Laravel.
- Pickup requests submit one `pickup_address_id` alongside `order_ids` and `logistics_organization_id`; Laravel verifies Seller ownership inside the transaction and applies that address to every selected Order and waybill snapshot.
- Implement a Seller-scoped approval action over the shared `OrderTransitionService`; use a Policy/scoped query, Form Request, API Resource, transaction, row lock, idempotency guard, and after-commit event listener.
- Keep Order approval separate from pickup readiness; opening either screen does not change Order status.
- Use `OrderReadyForPickup` as the downstream contract. Logistics owns bulk pickup scheduling/task creation, Courier assignment, pickup confirmation, and receipt validation; waybill creation remains inside Seller readiness.
- Seller frontend belongs in the React/Vite Seller SPA with shared `@aisley/ui` primitives. Provide loading, actionable, processing, stale/conflict, cancelled/rejected, unavailable, and retry states with keyboard-accessible actions.
- No new Order or payment enum is needed. Any future idempotency, pickup-manifest, or waybill read model uses additive migrations and string-backed enum-like columns with PHP enum casts.

### Verification and rollout

- API tests cover role/Shop isolation, COD pending approval/rejection, reservation release, invalid states, duplicate/concurrent requests, immutable snapshots, multi-Order pickup, after-commit Logistics notification, and no approval payment/Inventory/waybill side effects.
- Seller tests cover Monitoring/Approval/Pickup navigation, approve/reject actions, disabled capabilities, `409` refetch, notification read separation, pickup selection, and accessible error states.
- Roll out in dependency order: Seller order list/detail and notification → Approval → provider selection/pickup request/waybill → Logistics Pickups scheduling → Courier pickup/receipt → remaining shipment flow.
- Log correlation ID, Seller/Shop/Order IDs, transition source, idempotency result, and event outcome; never log full address, payment secrets, or raw Buyer payloads.

### Research alignment and open decisions

- Shopee's seller flow separates **To Ship**, Arrange Shipment, pickup/drop-off selection, AWB printing, and mass pickup; late shipment/pickup can lead to system cancellation. See [Shopee seller fulfillment guide](https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/e68a7068c5423d45decff4573cd3fdef/How%20to%20fulfil%20an%20order%20in%20seller%20centre.pdf), [Shopee mass pickup guide](https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/6f01c96a4fa2e7feb8c441245ea98b4b/9.9%20Campaign%20Preparation.pdf), and [Shopee COD guidance](https://help.shopee.ph/portal/4/article/135541-How-do-I-choose-Cash-on-Delivery-(COD)-as-a-payment-option-(TAG)).
- Lazada's official fulfillment APIs separate Pack, PrintAWB, ReadyToShip, and pickup operations; some document endpoints accept multiple packages. See [Lazada fulfillment API](https://open.lazada.com/apps/doc/doc?docId=120984&nodeId=30764) and [Lazada Pack/PrintAWB/ReadyToShip guide](https://open.lazada.com/apps/doc/doc?docId=121328&nodeId=43453).
- Aisley keeps Seller approval and pickup readiness separate, creates one shared waybill at readiness, and keeps bulk pickup as an operational grouping without merging Orders.
- Open: Seller processing deadline/SLA, Courier acceptance-versus-acknowledgement policy, and the owner of the final `pending → paid` payment update at delivery completion.
