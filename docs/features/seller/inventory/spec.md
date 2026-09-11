---
feature: inventory
title: Seller Inventory System
system: AISLEY
type: Feature Specification
version: 1.1
status: Implemented foundation
role: Seller
scope: Seller Web Application
---

# Seller Inventory System

## WHAT

- **Purpose:** Give each Seller an authoritative, auditable stock balance for every purchasable SKU/base SKU in the Seller's one Shop.
- **Owned data:** `InventorySku`, `InventoryBalance`, and immutable `InventoryMovement` records; Seller adjustments, checkout reservations, release, first-mile fulfillment, and low-stock evaluation use this domain.
- **Canonical quantities:**

```text
on_hand   = physical units held by the Seller
reserved  = units committed to active Orders
available = on_hand - reserved
```

- **Implemented foundation:** Shop-scoped SKU list/detail, search and stock filters, on-hand/reserved/available DTOs, restock/manual increase/decrease/return-in adjustments, thresholds, movement history, locking, idempotency, and Product/variant stock synchronization exist.
- **Boundaries:** Product/Catalog owns content, price, media, publication, and SKU configuration; Checkout owns placement; Order Approval/Prepare Orders owns Order transitions; Low Stock Alerts owns alert lifecycle; Logistics/Courier owns transport.
- **Non-goals:** a second Product balance, direct Buyer edits, multi-warehouse stock, automatic purchasing, or unapproved return/refund policy.

## MUST

### Ownership and balance authority

- Require `auth:sanctum` and active Seller status. Scope every SKU, balance, movement, threshold, and history query through the authenticated Seller's Shop; never trust submitted Seller/Shop IDs or resulting quantities.
- Use `401` unauthenticated, `403` forbidden/inactive, `404` out-of-scope SKU, `409` stale/idempotency/invariant conflict, and field-addressable `422` validation errors.
- Inventory is authoritative at SKU level. Products without variants use one base SKU; Product-level stock is derived for legacy storefront/cart compatibility.
- Enforce `on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand`, and `available = on_hand - reserved`. Buyer availability uses `available`, never raw `on_hand`.

### Adjustments and ledger

- Every accepted mutation appends one immutable movement with type, deltas, resulting balance, reason, actor/reference, idempotency key, and timestamp. Old movements cannot be edited or deleted; corrections are new movements.
- Seller-entered types are `restock`, `manual_increase`, `manual_decrease`, and (until return policy is approved) the existing `return_in` compatibility path. `reserve`, `release`, `fulfillment`, and future correction actions are system/domain operations, not arbitrary client values.
- Restock records physical replenishment; manual increase records a counted/additional increase. Both increase `on_hand` and require a reason. Manual decrease cannot make `on_hand < reserved`.
- A “set stock” control, if added, computes a delta and writes a correction movement; it never overwrites a balance. Archived/inactive SKUs cannot be manually adjusted.
- Duplicate idempotency keys return the original movement only for the same SKU/action; reusing one for different inventory returns `409`.

### Reservation, fulfillment, and release

- Checkout reserves requested quantities atomically at Order placement only when `requested <= available`; concurrent reservations lock balances in a deterministic order and cannot oversell.
- Reservation release decreases only `reserved` and leaves `on_hand` unchanged. An accepted cancellation or Seller rejection before `picked_up_from_seller` releases that Order's exact quantities transactionally and exactly once.
- The approved fulfillment boundary is first-mile pickup from the Shop: `picked_up_from_seller` converts each reservation to fulfilled stock by decreasing both `reserved` and `on_hand` exactly once. Prepare Orders and label generation must not duplicate this effect.
- After `picked_up_from_seller`, automatic release for delivery failure, returns, refunds, or partial fulfillment is not defined. Do not restock a return until an inspection/refund policy is approved.
- Each reservation/release/fulfillment event references the Order/SKU and movement ID; source-of-truth Order snapshots remain untouched.

### Low stock and consumers

- Low Stock Alerts evaluate committed `available` after adjustments, reservations, releases, fulfillment, and threshold changes; alert persistence never changes a balance.
- Product/Catalog may show read-only inventory summaries and create opening stock through this service. Cart, Checkout, Search, Browse Shop, Dashboard, and Wishlist consume returned authoritative values.
- Archive preserves balance and movement history. Product publication/compliance decides Buyer visibility; Inventory does not publish or unpublish Products.
- Events, notifications, and cache/search refresh run after commit. Delivery failure cannot undo a committed movement.

### UX and acceptance

- Inventory list/detail/history provide pagination, allow-listed search/stock filters, loading/empty/error/retry states, accessible adjustment forms, and textual low/out-of-stock labels.
- [x] Seller sees only Shop-owned SKU balances and movement history.
- [x] `available` is server-derived and nonnegative; reserved stock cannot be manually consumed.
- [x] Restock/manual increase/decrease, reasons, idempotency, row locks, and immutable movement history are implemented.
- [x] Checkout reservations and Seller rejection release use the same authoritative ledger and low-stock evaluator boundary.
- [x] Product/variant legacy quantities stay synchronized without becoming a second authority.
- [x] Explicit `picked_up_from_seller` confirmation and eligible Customer cancellation use the authoritative fulfillment/release ledger.
- [ ] Delivery failure, return/refund, partial fulfillment, correction/reconciliation, and multi-location stock have approved policies and implementations.

## HOW

- Current routes are `GET /api/v1/seller/inventory`, `GET /inventory/{inventorySku}`, `GET /inventory/{inventorySku}/movements`, `POST /inventory/{inventorySku}/adjustments`, and `PATCH /inventory/{inventorySku}/threshold` under `seller.active`.
- Current backend is `InventoryService`, `InventoryController`, `SellerShopService`, `InventorySku`, `InventoryBalance`, `InventoryMovement`, Checkout reservation code, Seller rejection release, and `LowStockAlertService`.
- Mutation pattern is transaction → lock balance → validate ownership/idempotency/invariants → append movement → update balance/legacy quantity → commit → schedule evaluator/events after commit. Never perform network work while a balance is locked.
- Keep enum-like migration columns as strings with PHP enum casts and never modify executed migrations. Additive migrations are required for future reservation/fulfillment references, reconciliation metadata, or multi-location support.
- Existing Courier confirmation invokes the Inventory fulfillment path transactionally. Future Shipment/DeliveryTask transitions must reuse its exactly-once effect and preserve existing movement references. Do not infer fulfillment from `ready_for_pickup` or final delivery.
- Tests cover Shop isolation, all adjustment rules, oversell races, duplicate keys, reservation/release/fulfillment idempotency, movement immutability, archive history, low-stock evaluator retries, and after-commit behavior. Run API tests on SQLite/PostgreSQL plus Seller lint, TypeScript, and build.
- Keep return/refund, reservation expiry, reconciliation cadence, quantity limits, and multi-location semantics as explicit decisions before implementation.

### Movement effect table

| Movement | `on_hand` | `reserved` | Current actor |
| --- | ---: | ---: | --- |
| `restock` / `manual_increase` | `+quantity` | unchanged | Seller |
| `manual_decrease` | `-quantity` | unchanged | Seller, reason required |
| `reserve` | unchanged | `+quantity` | Checkout/Order |
| `release` | unchanged | `-quantity` | cancellation/rejection policy |
| `fulfillment` | `-quantity` | `-quantity` | first-mile pickup event |
| `return_in` | `+quantity` | unchanged | deferred inspection policy |

- Product and variant legacy stock fields are synchronized from the committed balance for existing storefront/cart code; they are not safe write targets.
- A low-stock evaluator may update an alert snapshot after a movement, but it never changes movement deltas or balance columns.
- A Seller may see movement actor/reason/reference metadata only when it is safe; Customer PII and payment details never appear in inventory history.

### Transaction checklist

- Normalize and validate all requested SKU quantities before locking.
- Lock balances in deterministic SKU order, re-read current values, and reject any unavailable or reserved-stock violation.
- Append movements and update balance inside the same transaction. If any SKU fails, roll back the whole reservation/fulfillment operation.
- Use a stable Order/event/idempotency reference so retries return the committed result rather than append a second movement.
- Dispatch low-stock evaluation, cache refresh, and notifications after commit; a worker failure is retried independently.

### Deferred policy gates

- Migrate the existing first-mile fulfillment trigger to the future Logistics-validated transition service only with an explicit compatibility plan; never fulfill an already-confirmed pickup again.
- Define how Buyer cancellation windows, delivery failure, return inspection, refund approval, partial fulfillment, and reservation expiry affect exact SKU quantities before adding writers.
- Approve correction/reconciliation controls, quantity limits, audit evidence, and whether a future warehouse/location model is needed; the MVP remains one Seller Shop stock pool.

### API and DTO rules

- Inventory list responses are paginated and include SKU UUID/code, Product/variant labels, status, `on_hand`, `reserved`, `available`, threshold, and stock state. They never accept a client-supplied balance projection.
- Movement history is append-only and can show type, deltas, resulting quantities, safe reason/reference, actor, and timestamp. Do not include complete Order address, Buyer contact, payment, or private evidence.
- Adjustment requests require positive quantity, an allow-listed type, a reason, and (when supplied) a UUID/idempotency key. Return the committed movement and balance so the Seller UI can reconcile without local arithmetic.
- Threshold changes are configuration, not stock adjustments. They must not create a movement or alter `on_hand`/`reserved`; Low Stock Alerts owns their lifecycle.

### Operational observability

- Record balance/movement/reference IDs, actor role, conflict type, lock/transaction failure, and evaluator result without logging Order payloads or Buyer PII.
- Monitor invariant violations, duplicate idempotency hits, reservation conflicts, deadlocks/timeouts, low-stock evaluator failures, and reconciliation mismatches.
- Any invariant mismatch is an explicit correction/reconciliation task. Never silently “repair” a balance from a Product field or frontend total.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`, Seller Low Stock Alerts, Checkout, Order Approval, and Prepare Orders.
