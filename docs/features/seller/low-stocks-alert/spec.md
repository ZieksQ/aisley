---
feature: low-stock-alerts
title: Seller Low Stock Alerts
system: AISLEY
type: Feature Specification
version: 1.3
status: Implemented foundation
role: Seller
scope: Seller Web Application
---

# Seller Low Stock Alerts

## WHAT

- **Purpose:** Let an active Seller configure a threshold per SKU and see one persistent alert for each transition into low/out-of-stock availability.
- **Authority:** Inventory owns `on_hand`, `reserved`, and `available`; this feature owns threshold evaluation, alert lifecycle, and Seller alert history. Notifications are a delivery channel, not the stock authority.
- **Scope:** one Shop-owned Inventory SKU/base SKU at a time, never a Product-wide guess. `available = on_hand - reserved`.
- **Implemented foundation:** UUID alerts, one active cycle per SKU, trigger/recovery snapshots, Seller-scoped list/detail APIs, Inventory indicators, database notifications, and bounded backfill exist.
- **Canonical lifecycle:**

```text
threshold = null → no new alert
available > threshold → available <= threshold → one `active` cycle
available > threshold again → resolve cycle
later breach → new historical cycle
```

- **Non-goals:** automatic replenishment, supplier orders, buyer restock notifications, repeated alerts while a breach remains active, Product-wide thresholds, or a hard-coded email/push/SMS provider.

## MUST

### Ownership and thresholds

- Require `auth:sanctum` and active Seller middleware. Derive Seller/Shop/SKU from the session; never trust client Seller IDs, balances, alert state, notification destinations, or another Shop's UUID.
- Return `401` unauthenticated, `403` inactive/forbidden, `404` out-of-scope SKU/alert, `409` stale/unique conflict, and field-addressable `422` validation errors.
- Store an optional non-negative integer `alert_threshold` on the Inventory Balance. `null` disables evaluation; `0` is valid and alerts when available reaches zero.
- Evaluate against current committed `available`, not `on_hand`. Threshold updates must lock/re-read the balance and deterministically create, retain, resolve, or update the current cycle. The route must invoke the same evaluator used by Inventory mutations.
- Disabling a threshold resolves an active cycle with `threshold_disabled`; it does not delete movement or alert history.

### Alert lifecycle and integrity

- Evaluate after committed restock, manual increase/decrease, checkout reservation, cancellation/rejection release, future `picked_up_from_seller` fulfillment, and approved future correction/return actions. Evaluation never changes the balance.
- An active alert stores UUID, Seller/Shop/SKU, trigger threshold/available, current threshold/available, state, trigger/resolution timestamps, resolution reason, and an optional safe movement reference.
- One active alert per SKU is enforced by transaction locking plus a database uniqueness constraint/active marker. Repeated below-threshold mutations, retries, or concurrent evaluators update the current snapshot instead of creating duplicates.
- Recovery above the current threshold resolves the alert with `stock_recovered`; a resolved record is immutable history and a later breach creates a new record.
- An archived Product or inactive SKU cannot start a new cycle; existing alerts remain visible. Product publication/compliance and Seller account status govern whether the Seller can act on the SKU.

### Notifications and privacy

- Persist the alert before notification delivery. Create one Seller database notification after commit for each newly created cycle, with a server-generated Seller alert destination.
- Email/push/SMS/broadcast delivery is optional, queued, retryable, and idempotent per alert/channel. A provider failure cannot roll back, resolve, or duplicate the stored alert or Inventory movement.
- List/detail responses are paginated, newest-first, deterministic, and Seller-scoped. Allow-list state, SKU/Product search, and date filters; keep a bounded page size.
- DTOs include safe Product/SKU labels, threshold/availability snapshots, state/times, and movement references only. Omit Buyer PII, supplier data, raw paths, credentials, and other Sellers' stock.
- Reading/acknowledging an alert (if added later) is separate from automatic recovery and never changes Inventory.

### UX and acceptance

- Inventory shows threshold, textual `in_stock`/`low`/`out` state, active-alert indicator, and a link to history. Alert pages provide loading, empty, error, retry, resolved, stale/refetch, and keyboard-accessible filter states.
- [x] Seller cannot configure or view another Seller's SKU threshold or alert.
- [x] `null`, `0`, and positive thresholds follow the availability rule in the evaluator.
- [x] One low-stock cycle produces one active alert despite repeated mutations/evaluations and notification attempts.
- [x] Recovery resolves a cycle and a later breach creates a new historical alert; archived-product history remains visible.
- [x] Alerting does not alter authoritative balances, reservations, Product publication, or Orders.
- [x] Failed/duplicate notification delivery cannot undo or duplicate the stored alert.
- [ ] The HTTP threshold-update route and every future release/fulfillment/return writer invoke the shared post-commit evaluator.

## HOW

- Current APIs are `GET /api/v1/seller/low-stock-alerts` and `GET /low-stock-alerts/{alert}` plus Inventory's threshold/list/detail routes under `seller.active`.
- Current backend is `LowStockAlertService`, `LowStockAlertController`, `LowStockAlert`/enum models, `InventoryService`, checkout/Seller order inventory hooks, and `LowStockAlertNotification`. The CLI `inventory:evaluate-low-stock-alerts` performs bounded notification-suppressed backfill.
- Keep enum-like columns as strings with PHP enum casts. Use additive migrations only; preserve resolved cycles and enforce at most one active marker per SKU on SQLite/PostgreSQL.
- Evaluator pattern: after source transaction commit → lock current balance → read current availability → apply one lifecycle transition → commit → notify after commit. Do not perform network work while a balance is locked.
- Seller UI reuses Inventory threshold controls and the `/low-stock-alerts` history page. API resources generate all destinations from authenticated ownership; no client path is trusted.
- Tests cover threshold boundaries/change paths, each inventory/order reservation effect, ownership, uniqueness/concurrency/idempotency, archive history, evaluator failure, notification failure, filters/pagination, and accessibility. Run API tests on SQLite/PostgreSQL plus Seller lint, TypeScript, and build.
- Before enabling external channels or alert preferences, approve retention, per-channel deduplication, scan/queue retry, real-time transport, and notification policy.

### Transition examples

| Event | Availability | Result |
| --- | ---: | --- |
| threshold enabled, already breached | `<= threshold` | create one active cycle |
| repeated reservation/adjustment below threshold | `<= threshold` | update current snapshot only |
| release/restock recovers stock | `> threshold` | resolve with `stock_recovered` |
| threshold disabled | any | resolve with `threshold_disabled` |
| later breach after resolution | `<= threshold` | create a new historical cycle |

- Low and out-of-stock are presentation labels of the same lifecycle; zero is not a second alert type.
- A threshold change must be serialized with the balance read. Lowering a threshold can resolve immediately; raising it can create/retain one cycle, never two.
- The alert's original trigger time, trigger threshold, and trigger movement stay immutable even when current availability snapshots change.

### DTO and delivery contract

- List/detail responses expose alert ID/state/type, Product/SKU labels, trigger/current threshold and availability, trigger/resolution times/reason, a safe movement reference, and an Inventory destination generated by the server.
- Notification data contains only the Seller-owned alert/SKU reference and a stable `/low-stock-alerts/{alert}` destination. It does not copy Buyer data or storage paths.
- If an after-commit evaluator fails, operators can retry it with the balance/SKU ID and movement reference. A successful retry reconciles the alert without replaying a notification for an existing cycle.
- Backfill is bounded and notification-suppressed; it evaluates configured thresholds without sending a burst of external messages.

### Evaluator guardrails

- The evaluator accepts a persisted balance/SKU ID and optional committed movement reference, never a browser-supplied quantity or serialized stale model.
- Lock the current balance and active alert in one short transaction, apply one state transition, and release locks before notification, broadcasting, cache work, or network delivery.
- A unique active marker is an integrity backstop, not the only deduplication mechanism. On a uniqueness race, reload the committed active alert and return it without sending a second notification.
- If the Product is archived after an alert is active, resolve/recovery history remains readable while new cycles are suppressed until the SKU/Product becomes eligible again.

### Operational verification

- Test every source writer—manual adjustments, checkout reservation, Seller rejection release, future cancellation release, first-mile fulfillment, correction, return, and bulk import—against the same evaluator entry point.
- Test notification/database failures after the alert transaction commits and ensure retries do not alter alert state, Inventory balances, Orders, or notification count for an existing cycle.
- Test pagination, state/search/date filters, configured-threshold count, cross-Shop concealment, private movement references, and UI keyboard/retry/empty states.
- Keep external channel preferences and real-time delivery as separate contracts; a missing channel must never make an authoritative alert disappear.
- A Seller dashboard badge, Inventory filter, and notification may be stale; opening alert detail must refetch the authoritative alert state.
- Alert history is not a substitute for Inventory movement history and must not become an editable stock ledger.
- Alert list/detail cache entries, if introduced, must include Seller/Shop/SKU scope and alert schema version.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`, Seller Inventory, Checkout, Order Approval, and Prepare Orders.
