---
feature: low-stock-alerts
title: Seller Low Stock Alerts
system: AISLEY
type: Feature Specification
version: 1.1
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Low Stock Alerts

## WHAT

- **Purpose:** Let an active Seller configure a per-SKU threshold and receive one persistent alert for each transition into low or out-of-stock availability.
- **Primary actor:** authenticated active Seller who owns exactly one Shop and its Inventory SKUs.
- **Existing foundation:** `inventory_balances.alert_threshold`, authoritative `on_hand`/`reserved`/`available` calculations, stock movements, threshold editing, low/out filters, and Seller inventory screens are implemented.
- **Canonical rule:**

```text
available = on_hand - reserved
threshold = null  → alerting disabled
available > threshold → available <= threshold
→ create one ACTIVE alert for that low-stock cycle
available > threshold again
→ resolve that alert; a later crossing starts a new cycle
```

- **Scopes:** one Inventory SKU/variant, never a Product aggregate. A Product with one default SKU uses that SKU.
- **Surfaces:** Inventory list/detail show current low/out state and threshold; `/low-stock-alerts` provides a paginated alert history. A future Seller notification bell may link to the alert.
- **Boundaries:**
  - Inventory owns balances, reservations, adjustments, and the committed availability value.
  - This feature owns threshold-trigger evaluation and alert lifecycle only; it never changes stock, Product visibility, pricing, or Orders.
  - A future Seller Notifications feature owns shared inbox/read state and optional external channels; this feature is its producer, not a provider integration.
- **Non-goals:** supplier purchasing, automatic restocking, repeated alerts while stock remains low, global Product thresholds, buyer restock notifications, or a hard-coded email/push/SMS provider.

## MUST

### Ownership and threshold

- Require `auth:sanctum`, active Seller status, and Shop-derived SKU scope. Never trust a submitted `seller_id`, `shop_id`, available quantity, or alert state.
- Return `401` unauthenticated, `403` inactive/forbidden, `404` Seller-scoped SKU/alert absent, `422` invalid threshold, and `409` stale/conflicting mutation.
- `alert_threshold` is an optional non-negative integer stored on the existing Inventory Balance; `null` disables new alert evaluation.
- `0` is valid and alerts when available reaches zero. A threshold applies to `available`, not `on_hand`, because reserved units are not sellable.
- Updating a threshold must lock/re-read the balance, save the threshold, and immediately evaluate the current availability.
  - If the new enabled threshold already covers current availability, create or retain one active alert.
  - Disabling a threshold resolves any active alert with resolution reason `threshold_disabled`; it does not alter stock history.

### Alert lifecycle

- A committed Inventory mutation or threshold update evaluates only the affected SKU after the balance transaction commits.
- Create an active alert only when alerting is enabled and current availability is `<= threshold`, with no active alert for the same SKU/threshold cycle.
- An active alert contains UUID, Seller/Shop/SKU references, threshold, availability snapshot, state, triggered time, resolved time/reason, and a safe triggering movement/reference ID when present.
- When availability rises above the active alert's threshold, resolve it automatically with reason `stock_recovered`; never delete the alert.
- A later fall to `<= threshold` creates a distinct alert cycle. Changes that remain at/below the threshold must not create duplicates.
- Threshold changes while an alert is active must be deterministic:
  - lower threshold and availability becomes above it → resolve;
  - threshold remains breached → retain the active cycle and update the current threshold/availability snapshot;
  - raise threshold above availability → retain/create one active cycle, never several.
- Low and out-of-stock are availability states, not separate alert types. The alert payload may label zero availability as `out_of_stock` for UI clarity.
- An archived Product or inactive SKU retains historical alerts but cannot create a new alert until it becomes eligible for Inventory mutations again.
- Seller suspension does not erase alert history; notification delivery and any Seller dashboard access continue to follow the account-status policy.

### Notification and history

- Persist the alert before any in-app, email, push, or broadcast attempt. Alert state remains authoritative when external delivery fails.
- Create one Seller-facing database/in-app notification after the alert transaction commits when the Seller notification infrastructure is available; it links only to the Seller-scoped alert/SKU.
- External delivery is optional, queued, after-commit, retryable, and idempotent per alert/channel. It must not change the alert, Inventory balance, or Order state.
- The alert list is newest-first, paginated, and Seller-scoped. Allow-list `active`/`resolved`, Product/SKU search, and date filters.
- An alert detail/list DTO includes Product/SKU label, threshold and availability snapshots, state/times, safe movement reference, and internal Inventory link; omit buyer PII, supplier data, and other Sellers' stock.
- Seller acknowledgement/read state, if later added, is independent from automatic `resolved` state. Reading an alert never resolves it or changes Inventory.
- A resolved alert must never be reactivated; a later breach is represented by a new alert record.
- An active alert may update its current availability snapshot after a later below-threshold mutation, but its original triggered time and trigger reference remain immutable.
- Resolved alerts remain visible in history with their final availability snapshot and resolution reason.

### Integrity and experience

- Inventory transaction + alert decision must be race-safe. Lock the balance, re-evaluate current availability, and enforce one active alert per SKU with a database constraint/index; return/refetch on conflict.
- Reservation, release, fulfillment, restock, manual increase/decrease, correction, return-in, and bulk import must all use the same post-commit evaluator. No frontend calculation may create alerts.
- Retried mutations and queued evaluator jobs must not duplicate active alerts or notifications. Use the committed movement/reference plus alert state as the idempotency boundary.
- Do not perform network delivery, cache rebuilding, or broadcasting while an Inventory balance row is locked.
- Evaluator failures must be observable with a safe request/reference ID and retried independently; they must not roll back a committed stock movement.
- Inventory shows threshold, `in_stock`/`low`/`out` state, active-alert indicator, and direct link to alert history. Low state must not rely on color alone.
- Alert list/detail provide loading, empty, error, retry, resolved, and stale/refetched states with keyboard-operable filters and links.
- The empty state explains that thresholds are configured from Inventory SKU details and distinguishes no configured thresholds from no alert history.
- Inventory history remains the source for adjustment reasons; the alert only references its triggering movement.
- [ ] A Seller cannot configure or view another Seller's SKU threshold or alert.
- [ ] Threshold `null`, `0`, and a positive integer follow the defined availability rule.
- [ ] One low-stock cycle produces one active alert despite repeated mutations, retries, or notifications.
- [ ] Restocking above threshold resolves the cycle; a later breach creates a new historical alert.
- [ ] Alerting does not alter authoritative balances, reservations, Product publication, or Orders.
- [ ] Failed/duplicate notification delivery cannot undo or duplicate the stored alert.
- [ ] Alert history remains available after the SKU recovers or its Product is archived.

## HOW

- Keep the existing `InventoryBalance.alert_threshold` and `PATCH /api/v1/seller/inventory/{inventorySku}/threshold` endpoint as the threshold owner. Add additive `low_stock_alerts` persistence with UUIDs, Seller/Shop/SKU foreign keys, availability/threshold snapshots, state, trigger/resolution metadata, and indexes for Seller/state/time.
- Store enum-like alert state/resolution values as strings with PHP enum casts; do not modify executed migrations. Use a PostgreSQL-safe partial unique index or equivalent constraint to permit at most one active alert per Inventory SKU.
- Add an `EvaluateLowStockAlert` domain service/event listener invoked after committed Inventory mutations and threshold updates. It reads the locked/current balance rather than recalculating from a client payload.
- Make evaluator input a persisted balance/SKU ID plus optional movement reference, not a serialized Eloquent model or browser-provided quantity.
- Use an explicit recovery transition rather than deriving active/resolved history only at read time, so prior alert cycles remain reportable.
- Add Seller-scoped APIs:

```http
GET /api/v1/seller/low-stock-alerts
GET /api/v1/seller/low-stock-alerts/{alert}
```

- Reuse existing Inventory list/detail threshold controls and add active-alert links/badges plus a paginated Seller alert-history page. Do not require a notification bell before the alert history is usable.
- API Resources must serialize decimal/integer stock snapshots consistently with the existing Inventory DTOs.
- Do not expose unbounded alert history or unrestricted client-provided sort columns.
- Rate-limit alert-list requests consistently with other Seller operational endpoints.
- Keep route parameters UUID-constrained and generate all notification destinations server-side from the authenticated Seller's SKU/alert.
- When the notification domain is added, send a safe `inventory.low-stock` database notification after commit; use a stable destination such as `/inventory/{skuId}` or `/low-stock-alerts/{alertId}`. Laravel supports queued after-commit events/listeners. [Laravel events](https://laravel.com/framework/docs/13.x/events#dispatching-events-after-database-transactions)
- Test Seller scope, threshold validation, every crossing/recovery/threshold-change path, reservation and checkout effects, duplicate/concurrent evaluation, history retention, notification failure, API filters/pagination, and Inventory UI accessibility.
- Include migration tests for the active-alert uniqueness constraint on both supported databases.
- Run API tests on SQLite and PostgreSQL, plus Seller lint, strict TypeScript, production build, and focused browser checks.
- Roll out with existing thresholds treated as enabled configuration: evaluate them once through a bounded backfill/job and avoid sending a burst of external alerts until notification preferences are decided.
- **Open questions:** maximum threshold, alert retention, whether resolved alerts may be dismissed/archived, Seller notification preferences/external channels, real-time transport, bulk-import notification summary policy, and whether threshold defaults are copied for new SKUs.
