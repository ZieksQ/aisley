---
feature: low-stock-alerts
title: Seller Low Stock Alerts
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Low Stock Alerts
## WHAT
- **Purpose:** Let Sellers set a minimum stock threshold per SKU/variant and receive one actionable alert when authoritative sellable stock becomes low.
- **Canonical role:** `SELLER`.
- User slug normalized:
```text
low-stocks-alert
→ low-stock-alerts
```
- `Seller.md` defines customized per-SKU inventory thresholds plus automated notifications when stock needs replenishment. fileciteturn82file0
- **Core lifecycle from the Seller flow:**
```text
Seller sets threshold
→ Inventory change commits
→ evaluate current available stock

available crosses from > threshold to <= threshold
→ create one ACTIVE low-stock alert
→ notify Seller

still <= threshold
→ no repeated alert

available rises above threshold
→ RESOLVE alert

later drops to <= threshold
→ create a new alert cycle
```
- **Inventory boundary:**
  - Inventory System owns `on_hand`, `reserved`, `available`.
  - Low Stock Alerts owns threshold configuration, alert lifecycle, and notification trigger.
  - It never maintains a second stock balance.
- **Recommended route:** integrate primarily under:
```text
/seller/inventory
```
with optional filtered view:
```text
/seller/inventory?stock=low
```
- **Architecture:**
  - Next.js/React: threshold form, low-stock badges/list, notification settings, history.
  - Laravel: Seller/SKU authorization, threshold validation, evaluator, active/resolved state, dedupe, notifications.
  - Database/Inventory remains authoritative.
- **Integrations:** Inventory events, Seller Dashboard, Seller Notifications, Order/Product Management, Bulk Import.
- **Non-goals:** stock mutation, reservation, auto-restock, Product pricing/visibility, supplier purchasing, repeated alerts for every Order, hard-coded notification providers.
## MUST
### Seller authorization
- Requires authenticated `SELLER`.
- Every threshold/alert query resolves a Seller-owned SKU.
- Never trust client-submitted `seller_id`, SKU ownership, stock, or alert state.
- Another Seller cannot view/configure the SKU.
- Standard errors:
  - `401` unauthenticated
  - `403` forbidden
  - `404` scoped SKU/config missing
  - `422` invalid threshold/settings
  - `409` stale/concurrent conflict
### SKU-level threshold
- Threshold is authoritative per SKU/variant.
- Product-level stock totals do not replace SKU configuration.
- If a Product has only a base/default SKU, configure that SKU.
- Product-level defaults may prefill SKU values if later desired, but must not blur which SKU threshold is active.
### Threshold validation
- Source models `alert_threshold` as an integer.
- Enforce:
```text
alert_threshold >= 0
```
- `0` is valid:
```text
threshold = 0
→ alert when available == 0
```
- Exact maximum threshold is Open.
- Laravel owns validation.
### Enable/disable
- Recommended settings:
```text
enabled
alert_threshold
allowed_notification_channels
```
- Disabled monitoring creates no new alerts.
- Existing active-alert behavior on disable is Open.
- Recommended MVP: suppress monitoring/resolve operational active state while retaining historical record.
### Authoritative quantity
- Evaluate:
```text
available = on_hand - reserved
```
from Inventory.
- Do not use Product-level duplicated stock, stale React state, or raw `on_hand`.
- Buyer sellable availability and Seller low-stock state therefore share one source of truth.
### Low-stock boundary
- Use:
```text
available <= alert_threshold
```
- Exactly at threshold counts as low.
- Example:
```text
threshold 5
available 6 → normal
available 5 → low
available 4 → low
```
### Crossing semantics
- Create an alert when state transitions:
```text
normal → low
```
- Do **not** create another alert for:
```text
low → still low
```
- Resolve when:
```text
low → normal
```
- A later:
```text
normal → low
```
creates a new alert cycle.
### Mandatory sequence
```text
threshold 5
6 → 5 = CREATE
5 → 4 = KEEP ACTIVE
4 → 3 = KEEP ACTIVE
3 → 7 = RESOLVE
7 → 5 = CREATE NEW
```
- This sequence must be covered by automated tests.
### Threshold changes
- Saving a new threshold immediately re-evaluates current Inventory.
- Example:
```text
available 8
threshold 5 → normal
threshold changed to 10 → CREATE low-stock alert
```
- Lowering threshold below current stock resolves an active alert.
- Threshold update and alert-state change should remain transactionally consistent.
### Inventory event trigger
- Inventory System emits committed availability-change events.
- Low Stock Alerts consumes a shared event such as:
```text
InventoryAvailabilityChanged
```
- Changes may originate from:
  - reservation/sale
  - cancellation/release
  - fulfillment
  - return
  - manual adjustment
  - Bulk Import adjustment
- Evaluator re-reads current Inventory when correctness depends on current state.
### After-commit processing
- Never evaluate/notify from uncommitted Inventory state.
- AISLEY requires queued follow-up after commit. fileciteturn82file16
- Laravel queue `after_commit` delays jobs/listeners/notifications until commit and discards work for rolled-back transactions. citeturn577231search1
- Laravel events also support after-commit dispatch behavior. citeturn577231search2
### Single evaluator
- Recommended action:
```text
EvaluateLowStockForSku
```
- Used by:
  - Inventory availability events
  - threshold changes
  - monitoring enable/disable where needed
- Flow:
```text
load settings
→ read current Inventory
→ determine low/normal
→ compare active-alert state
→ create / keep / resolve
→ commit
→ notify only when newly created
```
### Concurrency and dedupe
- Multiple jobs may evaluate one SKU concurrently.
- Prevent duplicate active alerts using:
  - transaction
  - row lock/atomic state update
  - persistent dedupe/current-alert state
- Queue uniqueness may supplement but must not replace database dedupe.
- Retry of the same Inventory event must not create another logical alert.
### Alert lifecycle
- Recommended states:
```text
ACTIVE
RESOLVED
```
- Keep historical cycles.
- Recommended alert data:
```text
seller_id
sku_id
threshold_at_trigger
available_at_trigger
trigger_reference
triggered_at
resolved_at nullable
resolved_available nullable
```
- Historical trigger threshold must not change when Seller edits today's threshold.
### Active-alert uniqueness
- Recommended invariant:
```text
at most one unresolved ACTIVE alert per SKU
```
- If still low, do not add another active record.
- UI may show current Inventory quantity while keeping original trigger snapshot intact.
### Resolution
- Resolve only when:
```text
available > current threshold
```
or when explicit monitoring/archive policy intentionally ends monitoring.
- Reading/dismissing a notification does not resolve Inventory condition.
- Preserve:
```text
notification read state
≠
alert lifecycle state
```
### Notification creation
- New ACTIVE alert creates one logical Seller notification.
- Recommended safe payload:
```text
type = LOW_STOCK
alert_id
product_id
sku_id
safe Product/variant summary
available_at_trigger
threshold_at_trigger
created_at
```
- Link to exact Seller-owned SKU/Inventory view.
- Do not include Buyer/order private data.
### Notification channels
- Seller flow allows configured notification channels.
- Recommended minimum: database/in-app.
- Optional: broadcast, email, push.
- Do not hard-code SMTP/FCM/SMS/provider.
- Laravel Notifications supports database and queued configured channels. citeturn577231search0
### Queue behavior
- External notification delivery is asynchronous.
- Alert record is created once; channel retries must not create another alert.
- Notification dispatch happens after alert transaction commits.
- Laravel Notifications support `afterCommit()`. citeturn577231search0
### Stale queued notification
- Stock may recover before queued email/push executes.
- Recommended:
  - retain in-app historical alert
  - optional external channels may suppress stale delivery if alert already resolved
- Laravel queued Notifications support `shouldSend()` for final send-time validation. citeturn577231search0
- Exact suppression rule is Open.
### Preferences
- Effective channel selection may combine:
```text
SKU monitoring enabled
+ SKU allowed channels
+ Seller global notification preferences
+ platform-required rules
```
- Exact precedence is Open.
- Disabling an external channel should not silently erase historical in-app alert state.
### Low-stock list
- Seller can view active low-stock SKUs.
- Recommended fields:
  - Product
  - SKU/variant
  - current `available`
  - configured threshold
  - alert age
  - status
  - Inventory link
- Current quantity is loaded from Inventory.
- Paginate if large.
### Alert history
- Preserve prior cycles for audit; Dashboard needs only the active count.
- Retention/history UI is Open.
### Dashboard integration
- Dashboard may expose:
```text
active_low_stock_count
```
- It must consume the same alert/Inventory state.
- Clicking opens low-stock Inventory view.
- Dashboard must not independently recalculate thresholds.
### Order/Product Management integration
- Product/Order Management may display:
  - current low-stock badge
  - threshold
  - link to settings
- It must not own a second `is_low_stock` authority or evaluator.
### Inventory integration
- Inventory owns:
```text
on_hand
reserved
available
stock movements
```
- Low Stock Alerts owns:
```text
threshold
alert state/history
notification trigger
```
- Restock and adjustment still go through Inventory.
### Bulk Import integration
- If Bulk Import supports threshold edits, it must call the same threshold-setting action.
- It must not insert/resolve alert rows directly.
- Threshold column inclusion is Open.
### Archived/inactive SKU
- Archive/deactivation preserves alert history.
- Recommended: stop/suppress active monitoring for intentionally unsellable archived SKU while keeping history.
- Exact active-alert resolution policy is Open.
- Archiving does not zero Inventory.
### Vacation Mode
- Vacation Mode does not imply stock recovered.
- Do not resolve low-stock state solely because Seller is on vacation.
- Whether external reminder delivery pauses during Vacation Mode is Open.
### Realtime
- Optional broadcast may refresh notification bell, Dashboard count, and Inventory list.
- Database/API remains authoritative; missed events recover by refetch.
### API
Conceptual:
```http
GET /api/seller/inventory/low-stock
GET /api/seller/inventory/{sku}/low-stock-settings
PUT /api/seller/inventory/{sku}/low-stock-settings
GET /api/seller/inventory/{sku}/low-stock-alerts
```
- Exact route grouping may vary.
- Use Form Requests, Seller-scoped Policies/relations, API Resources.
### Recommended data model
```text
low_stock_settings
- id
- seller_id
- sku_id
- enabled
- alert_threshold
- channel_settings nullable
- timestamps

low_stock_alerts
- id
- low_stock_setting_id
- trigger_reference nullable
- threshold_at_trigger
- available_at_trigger
- triggered_at
- resolved_at nullable
- resolved_available nullable
```
- Add unique Seller/SKU settings constraint.
- Active-alert uniqueness enforcement depends on database strategy.
### Events
Recommended:
```text
LowStockAlertTriggered
LowStockAlertResolved
```
- Consumers:
  - Seller notification
  - optional broadcast
  - Dashboard refresh
- Events fire only on state change, not every low-stock Inventory movement.
### Frontend states
- Threshold: loading, loaded, saving, validation error, conflict.
- Low-stock list: loading, empty, active, error.
- SKU: normal, low, out-of-stock, monitoring-disabled.
- Notification: unread/read.
- Do not rely on color alone.
### Accessibility
- Label controls, provide textual stock/alert states, and keep tables/notifications keyboard usable without color-only meaning.
### Acceptance criteria
- [ ] Seller configures only their own SKU thresholds.
- [ ] Threshold is a nonnegative integer.
- [ ] Inventory `available` is the only stock value used for evaluation.
- [ ] `available == threshold` is low stock.
- [ ] Normal→low creates exactly one active alert.
- [ ] Staying low creates no repeated alerts.
- [ ] Restocking above threshold resolves the alert.
- [ ] A later downward crossing creates a new cycle.
- [ ] Threshold changes immediately re-evaluate current Inventory.
- [ ] Concurrent/retried evaluations cannot create duplicate active alerts.
- [ ] Notifications are emitted only from committed alert state.
- [ ] Read/dismiss state does not resolve low-stock state.
- [ ] Dashboard/Product Management reuse this domain.
- [ ] Historical alert cycles remain auditable.
## HOW
### Project findings
- `Seller.md` explicitly requires customized per-SKU thresholds and automated low-stock notifications. fileciteturn82file0
- Seller source says reevaluation occurs when Orders or Inventory adjustments affect stock.
- Dedicated Seller flow defines exact threshold crossing, no repeated alerts while continuously low, resolution above threshold, and later re-trigger.
- Seller Inventory System already owns `available = on_hand - reserved`, so Low Stock Alerts consumes Inventory rather than managing stock.
- AISLEY architecture requires Laravel authority, Seller scoping, and after-commit queued work. fileciteturn82file16
### Recommended Laravel actions
```text
UpdateLowStockSettings
EvaluateLowStockForSku
TriggerLowStockAlert
ResolveLowStockAlert
GetSellerLowStockAlerts
```
- All evaluation paths converge on `EvaluateLowStockForSku`.
### Evaluation transaction
```text
InventoryAvailabilityChanged after commit
→ EvaluateLowStockForSku
→ transaction
→ lock settings/current alert state
→ read current Inventory available
→ compare threshold/state
→ create / keep / resolve
→ commit
→ notify/broadcast after commit if state changed
```
- Laravel queues/events/notifications provide after-commit behavior for this boundary. citeturn577231search1turn577231search2turn577231search0
### State table
```text
Active alert | is_low | Result
------------ | ------ | ----------------
none         | false  | nothing
none         | true   | create ACTIVE
ACTIVE       | true   | keep ACTIVE
ACTIVE       | false  | RESOLVE
none after recovery | true | create new ACTIVE
```
### Notification implementation
Recommended:
```text
LowStockNotification implements ShouldQueue
```
- Database/in-app is a sensible minimum.
- Use `afterCommit()` for queue safety. citeturn577231search0
- Optional external channels may use `shouldSend()` to suppress already-resolved alerts. citeturn577231search0
### Next.js / React
```text
/seller/inventory
├── InventoryTable
│   └── LowStockBadge
├── LowStockFilter
└── SKU Detail
    ├── BalanceSummary
    ├── LowStockThresholdForm
    └── LowStockAlertHistory
```
- React sends settings intent and renders Laravel-returned state.
### Tests
- **Laravel:** Seller isolation; negative/zero threshold; equality boundary; threshold-change create/resolve; crossing sequence; continuous-low dedupe; concurrent evaluation; retry idempotency; disable/archive policy; after-commit notification.
- **Inventory integration:** reservation, release, adjustment, fulfillment, return, and restock transitions produce correct alert lifecycle.
- **Frontend:** threshold form; normal/low/active/resolved; read-vs-resolution distinction; errors/accessibility.
### Risks
- **Spam/duplicates:** naïve threshold checks or concurrent retries can over-notify.
- **Wrong/stale state:** duplicated stock sources or delayed external messages can mislead Sellers.
- **Tenant/state confusion:** weak scoping or treating notification-read as stock recovery can corrupt behavior.
### Open questions
- Maximum threshold and disable-monitoring behavior.
- Notification channels/preference precedence and mandatory in-app behavior.
- Archived-SKU/Vacation Mode policies.
- History retention/UI and Bulk Import threshold column.
- Product-level defaults and any extra cooldown beyond threshold-cycle dedupe.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller source: `Seller.md`
- Seller flow: `feature-system-flows/seller/low-stock-alerts.md`
- Seller Inventory flow: `feature-system-flows/seller/inventory-system.md`
- Laravel 12 Notifications: https://laravel.com/docs/12.x/notifications
- Laravel 12 Queues: https://laravel.com/docs/12.x/queues
- Laravel Events: https://laravel.com/docs/events
