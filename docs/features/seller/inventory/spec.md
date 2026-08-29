---
feature: inventory
title: Seller Inventory System
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Inventory System

## WHAT
- **Purpose:** Give Sellers an authoritative, auditable SKU-level stock system.
- **Canonical role:** `SELLER`.
- **Owns:** SKU balances, restocks/manual adjustments, reservations, releases, fulfillment stock-out, accepted return stock-in, immutable movement history, and anti-overselling rules.
- **Does not own:** Product content/media/category, pricing/promotions, Buyer Cart UI, Order status transitions, or Logistics/Courier tracking.
- **Boundary with Order Management:** Order Management owns catalog/Product/variant/pricing/publish/archive UI and may display stock summaries; every authoritative stock mutation delegates to Inventory.
- **Source-defined quantities:**
```text
on_hand   = physical units held by Seller
reserved  = units committed to active purchase/fulfillment
available = on_hand - reserved
```
- **Source-defined stock effects:**
```text
RESTOCK / MANUAL_INCREASE → on_hand +
RESERVE                   → reserved +
RELEASE                   → reserved -
FULFILLMENT               → reserved -, on_hand -
RETURN_IN                 → on_hand +
```
- **Recommended routes:**
```text
/seller/inventory
/seller/inventory/{sku}
```
- **Architecture:** Next.js/React owns inventory UI; Laravel owns Seller/SKU authorization, validation, balances, movements, locking, transactions, idempotency, and events; Eloquent/database is authoritative.
- **Consumers:** Order Management, Buyer Cart/Checkout, cancellation/payment expiry, Seller fulfillment, Low Stock Alerts, Search/Product Detail/Browse Shop, Wishlist restock alerts, Seller Dashboard, and Bulk Product Import/Export.

## MUST
### Authentication and Seller scoping
- Inventory requires authenticated `SELLER`.
- Scope every SKU/Inventory query through Products owned by the Seller/shop.
- Never trust client-submitted `seller_id`, SKU ownership, current/resulting balance, `reserved`, or `available`.
- Standard responses: `401` unauthenticated, `403` forbidden, `404` scoped record missing, `422` invalid adjustment, `409` stale/concurrent/invariant conflict.

### SKU-level authority
- Inventory is authoritative per purchasable SKU/variant; Product-level stock is derived.
- If Products have no explicit variants, use one repository-defined base/default SKU instead of a second stock model.
- Recommended relation:
```text
Seller → Product → SKU/Variant → InventoryBalance → InventoryMovement[]
```

### Balance invariants
- Always enforce:
```text
on_hand >= 0
reserved >= 0
reserved <= on_hand
available = on_hand - reserved
available >= 0
```
- Laravel returns authoritative balances; React must not derive final stock locally.
- Buyer-facing sellable quantity uses `available`, never `on_hand`.

### Recommended balance model
```text
inventory_balances
- id
- sku_id
- on_hand
- reserved
- alert_threshold nullable
- created_at
- updated_at
```
- `sku_id` is unique.
- Prefer deriving `available`; do not maintain three independent mutable quantities.
- `alert_threshold` may instead belong to Low Stock Alerts.

### Immutable movement ledger
- Every accepted mutation creates a movement.
```text
inventory_movements
- id
- inventory_balance_id / sku_id
- movement_type
- on_hand_delta
- reserved_delta
- reference_type/reference_id nullable
- reason nullable
- idempotency_key nullable
- actor_type/actor_id nullable
- created_at
```
- Never edit old movements to "fix" stock; corrections create new `CORRECTION` movements.
- Current balances must be reconcilable from movements plus any documented opening balance.
- Archive/deactivation preserves movements.

### Movement types
- Recommended allow-list:
```text
RESTOCK
MANUAL_INCREASE
MANUAL_DECREASE
CORRECTION
RESERVE
RELEASE
FULFILLMENT
RETURN_IN
```
- Do not accept arbitrary types.
- `RESERVE`, `RELEASE`, `FULFILLMENT`, and `RETURN_IN` are system/domain actions, not unrestricted Seller inputs.

### Inventory list
- Seller can browse paginated SKU balances.
- Recommended columns: Product, SKU/variant, `on_hand`, `reserved`, `available`, low/out state, threshold, last movement.
- Recommended filters: Product/SKU keyword, in stock, low stock, out of stock.
- Exact filters/sorts are Open; allow-list any client sort fields.

### SKU detail / movement history
- Show Product/variant summary, current balances, threshold/status, manual adjustment action, and paginated movement history.
- Movement rows may show type, deltas, safe reason/reference, source/actor, timestamp, and resulting balance where available.
- Never expose unrelated Buyer PII through Order references.

### Restock / manual increase
- Seller may increase physical stock for an owned SKU.
- Conceptual endpoint:
```http
POST /api/seller/inventory/{sku}/adjustments
```
- Example:
```json
{ "type": "RESTOCK", "quantity": 20, "reason": "New shipment" }
```
- Laravel: authenticate/scope → validate → transaction → lock balance → compute deltas → validate invariants → append movement → update balance → commit → after-commit events.
- Client submits a delta, not trusted resulting `on_hand`.

### Manual decrease
- Manual decrease requires a reason.
- Reject any decrease causing:
```text
on_hand < reserved
```
- Reserved units belong to active Order/payment/fulfillment flows; Seller must resolve those through their owning Order workflow.
- Return `409` plus current safe balance when useful.

### Absolute "set stock"
- If UI offers "set physical count to X", Laravel computes:
```text
delta = desired_on_hand - current_on_hand
```
and records a `CORRECTION`.
- Never overwrite balance without a movement.
- Correction must still satisfy `on_hand >= reserved`.

### Reservation
- Reservation is a system/domain action for checkout/order placement:
```text
requested <= available
reserved += requested
```
- Append `RESERVE`, lock/recheck before applying, and prevent two concurrent reservations from consuming the same final unit.
- Cart's displayed stock is not a reservation.

### Reservation timing
- Source Inventory flow says Order placement increases `reserved`.
- Exact trigger relative to `PENDING_PAYMENT` vs `PLACED` remains Open until payment/checkout semantics are finalized.
- Whatever trigger is selected must call this Inventory action.

### Release
- Cancellation/payment expiry releases reserved units:
```text
reserved -= quantity
on_hand unchanged
```
- Append `RELEASE`.
- Release is idempotent and cannot make `reserved` negative.

### Fulfillment
- At the selected Seller fulfillment boundary:
```text
reserved -= quantity
on_hand  -= quantity
```
- Append `FULFILLMENT`.
- Exact triggering Order state is Open and must align with Prepare Orders.
- Retries must not consume stock twice.

### Returns
- Returned goods are not automatically sellable.
- `RETURN_IN` happens only after the owning return/inspection workflow accepts items for restock.
- Accepted quantity increases `on_hand`.
- Damaged/non-sellable return handling remains Open.

### Concurrency / overselling
- Use a transaction plus row lock or equivalent atomic strategy for competing stock mutations.
- Recalculate balances after locking.
- Laravel 13 documents `lockForUpdate()` and recommends pessimistic locks inside transactions. citeturn519469search2
- React button state is not concurrency control.
- `available` must never become negative.

### Multi-SKU reservation
- Lock multiple SKU balances in deterministic order, e.g. SKU ID ascending.
- Revalidate all quantities after locks are acquired.
- If checkout is all-or-nothing and one SKU is insufficient, roll back all reservations.
- Multi-Seller checkout grouping remains owned by Checkout.

### Atomic ledger + balance
- Movement and balance mutation must commit together.
- Never allow a changed balance without a movement or a movement without its balance change.
- Keep lock-held transactions short and free of slow external network calls.

### Idempotency
- Require stable idempotency/reference protection for reserve, release, fulfillment, return-in, and bulk-import adjustments.
- Retry of the same logical event must not double-adjust stock.
- Recommended uniqueness: `movement_type + source_reference` or explicit idempotency key.
- Manual Seller submissions should also use duplicate-submit protection where useful.

### Order Management integration
- Order Management may show balances, link to Inventory, and initiate adjustments.
- It must not maintain independent authoritative stock, directly change `reserved`, or bypass movements.
- Inventory remains the stock authority.

### Buyer Cart / Checkout integration
- Checkout must reserve/revalidate through Inventory, not through an unprotected `product.stock` check/update.
- Buyer Cart requirements already establish overselling prevention at Place Order. fileciteturn61file10
- Inventory owns the atomic stock mutation.

### Low Stock Alerts
- Seller source defines per-SKU low-stock thresholds evaluated when Orders/adjustments affect stock. fileciteturn61file0
- Low Stock Alerts consumes committed `available`.
- Recommended condition:
```text
available <= alert_threshold
```
- Threshold-crossing/repeat notification semantics belong to Low Stock Alerts.

### Wishlist restock
- Inventory emits meaningful availability changes.
- Recommended restock signal:
```text
previous_available <= 0
→ current_available > 0
```
- Wishlist decides Product/variant alert semantics and notification delivery.

### Search / storefront availability
- Search/Product Detail/Browse Shop consume current sellable availability.
- Buyer-facing APIs do not need to expose Seller-internal `reserved`.
- Public display may be `in stock`, `low stock`, `out of stock`, or safe quantity if explicitly allowed.
- Search/cache/index state never becomes stock authority.

### Bulk Product Import/Export
- Bulk stock updates must call Inventory actions.
- Each accepted row authorizes SKU ownership, validates delta, creates a movement, includes batch/reference, preserves invariants, and is retry-safe.
- Bulk upload must not directly write balance columns.

### Product/SKU archive
- Archive/deactivation prevents new purchase/reservation but preserves balance, movements, reservations, and historical Order references.
- Deactivation does not zero stock.
- Existing reservations still release/fulfill normally.
- Manual correction of archived stock is Open.

### Events / after-commit work
- Recommended events: `InventoryAdjusted`, `InventoryReserved`, `InventoryReleased`, `InventoryFulfilled`, `InventoryReturned`, `InventoryAvailabilityChanged`.
- Consumers may include Low Stock Alerts, Search/Product Detail, Wishlist, Cart/read models, Seller Dashboard, and optional broadcasting.
- Shared AISLEY architecture requires queued follow-up after commit. fileciteturn61file16
- Laravel queue `after_commit` waits for successful commit and discards work from rolled-back transactions. citeturn519469search0

### Reconciliation
- Provide a service/job/test procedure verifying:
```text
balance implied by movements = stored InventoryBalance
```
- Never silently repair mismatches; correction must create an explicit movement.
- Reconciliation cadence is Open; mismatches should be observable.

### Optional adjustment evidence
- Source flow allows optional evidence; it is not mandatory.
- If implemented: authorize upload, validate type/size, malware scan, use configured object storage, and store an asset reference on the movement.

### Real-time UI
- Optional Seller real-time updates may consume Inventory events.
- API/database remains authoritative; missed broadcasts recover by refetch.
- Broadcast driver is project-configured.

### Frontend states
- List: loading, empty, loaded, filtered-empty, error.
- SKU detail: loading, loaded, movement-history loading, error.
- Adjustment: idle, validating, submitting, success, validation error, reserved-stock conflict, stale conflict.
- On `409`, refetch committed balance before retry.

### Accessibility
- Stock states require textual labels, not color only.
- Adjustment controls require labels; movement history must be keyboard readable.
- Success/conflict/error feedback should be announced.

### Acceptance criteria
- [ ] Seller sees only their own SKU Inventory.
- [ ] `available = on_hand - reserved`; all quantities remain valid/nonnegative.
- [ ] Every stock mutation creates an immutable movement.
- [ ] Manual decrease cannot consume reserved stock.
- [ ] Reservation cannot make `available` negative.
- [ ] Concurrent reservations cannot consume the same final unit.
- [ ] Release, fulfillment, return, and retry effects happen exactly once.
- [ ] Fulfillment decreases both `reserved` and `on_hand`.
- [ ] Return stock-in happens only after accepted inspection/workflow.
- [ ] Movement + balance commit atomically.
- [ ] Buyer-facing availability uses Inventory `available`.
- [ ] Order Management, Low Stock, Wishlist, Bulk Import, and Checkout reuse this domain.
- [ ] Archive preserves Inventory history.
- [ ] Follow-up events/jobs run after commit.
- [ ] Ledger can be reconciled against current balance.

## HOW
### Project findings
- `Seller.md` defines Order Management as Product/Inventory information management and includes stock monitoring. fileciteturn61file5
- It separately defines Low Stock Alerts per SKU with threshold evaluation after Orders or stock adjustments. fileciteturn61file0
- The dedicated Seller `inventory-system.md` adds `on_hand`, `reserved`, `available`, immutable movements, reservation/release/fulfillment/return effects, locking/idempotency, and downstream events.
- Therefore Inventory remains a distinct stock domain rather than being replaced by Order Management.
- Shared architecture requires Seller scoping, Laravel authority, pagination, row locks/atomic stock updates, transactions, and after-commit work. fileciteturn61file16

### Recommended Laravel models
```text
InventoryBalance
- sku_id unique
- on_hand
- reserved
- alert_threshold nullable
- timestamps

InventoryMovement
- inventory_balance_id / sku_id
- movement_type
- on_hand_delta
- reserved_delta
- reference_type/reference_id nullable
- reason nullable
- idempotency_key nullable
- actor_type/actor_id nullable
- created_at
```
- Add database constraints where supported: `on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand`.
- Domain validation is still required.

### Recommended Laravel API
```http
GET  /api/seller/inventory
GET  /api/seller/inventory/{sku}
GET  /api/seller/inventory/{sku}/movements
POST /api/seller/inventory/{sku}/adjustments
```
- Internal actions need not be public endpoints:
```text
ReserveInventory
ReleaseInventory
FulfillInventory
ReturnInventory
```
- Use Form Requests, Seller-scoped Policies/relations, and API Resources.

### Recommended actions
```text
GetSellerInventory
AdjustSellerInventory
ReserveInventory
ReleaseInventory
FulfillInventory
ReturnInventory
ReconcileInventoryBalance
```
- No other feature should directly mutate Inventory balance columns.

### Mutation pattern
```text
DB transaction
→ load balance FOR UPDATE
→ verify context/ownership/idempotency
→ compute deltas
→ validate invariants
→ append InventoryMovement
→ update InventoryBalance
→ commit
→ dispatch InventoryAvailabilityChanged after commit
```
- Laravel 13 supports `lockForUpdate()` and recommends locks inside transactions. citeturn519469search2

### Multi-SKU reservation pattern
```text
sort SKU IDs
→ transaction
→ lock balances in same order
→ validate all availability
→ append RESERVE movements
→ update balances
→ commit
```
- Roll back as a group when checkout atomicity requires it.

### Events / queues
- `InventoryAvailabilityChanged` should include SKU ID, previous/current available quantity, and movement ID.
- Dispatch consumers after commit.
- Laravel supports `after_commit` for jobs/listeners/notifications. citeturn519469search0
- Consumers must tolerate retries.

### Next.js / React
```text
/seller/inventory
├── InventoryFilters
├── InventoryTable
└── Pagination

/seller/inventory/[sku]
├── BalanceSummary
├── AdjustmentForm
└── MovementHistory
```
- Use the shared Laravel API client.
- Refetch/use returned committed balance after mutation.
- Do not perform authoritative balance arithmetic in React.

### Tests
- **Laravel:** Seller isolation, balance invariants, restock/increase/decrease, reserved-limit rejection, movement immutability, reservation race, release/fulfillment/return idempotency, archive history, after-commit events, reconciliation.
- **Concurrency:** competing reservations for final stock must produce only valid successes.
- **Frontend:** list/detail/history, adjustment validation, low/out stock, `409` refetch, accessibility.

### Observability
- Log movement/reference IDs and failures without Buyer-sensitive Order payloads.
- Monitor invariant failures, reservation conflicts, duplicate idempotency hits, reconciliation mismatches, and repeated deadlocks/timeouts.

### Risks
- **Overselling:** weak locking lets concurrent Buyers reserve the same stock.
- **Double mutation:** retries without idempotency can release/consume twice.
- **Ledger drift:** direct balance writes break auditability.
- **Reserved-stock corruption:** manual decreases can invalidate active Orders.
- **Deadlocks:** inconsistent lock order can stall multi-SKU checkout.
- **Domain duplication:** Product Management, Cart, Bulk Import, or Low Stock may create competing stock logic.
- **Return ambiguity:** automatic restock of damaged returns can overstate sellable stock.

### Open questions
- Exact SKU/base-variant model.
- Whether threshold lives in Inventory or Low Stock Alerts.
- Reservation trigger relative to `PENDING_PAYMENT` / `PLACED`.
- Exact fulfillment state that consumes stock.
- Reservation expiry policy.
- Return inspection/damaged-stock workflow.
- Manual adjustment reason codes/evidence requirement.
- Archived SKU correction policy.
- Derived vs stored `available`.
- Reconciliation cadence.
- Inventory filters/sorts/page size.
- Real-time broadcasting requirement.
- Multi-warehouse/location stock; current source does not define it.

### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Seller source: `Seller.md`
- Seller flow: `feature-system-flows/seller/inventory-system.md`
- Seller flow: `feature-system-flows/seller/order-management.md`
- Laravel Query Builder / Pessimistic Locking: https://laravel.com/docs/13.x/queries
- Laravel Queues / After Commit: https://laravel.com/docs/12.x/queues
