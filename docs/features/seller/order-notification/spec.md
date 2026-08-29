---
feature: order-notifications
title: Seller Order Notifications
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Order Notifications
## WHAT
- **Purpose:** Alert a Seller when a new Seller-scoped Order becomes valid/actionable and provide the details needed to begin fulfillment.
- **Canonical role:** `SELLER`.
- User slug normalized:
```text
order-notification
→ order-notifications
```
- `Seller.md` defines Order Notifications as:
  - viewing new Orders
  - reviewing Order detail
  - realtime/polling alerts for incoming purchases
  - Buyer, variant, and transaction/status context required by the Seller. fileciteturn83file0
- Dedicated Seller flow defines:
```text
Checkout creates valid Seller Order
→ new-Order domain event commits
→ one idempotent Seller notification event
→ in-app notification stored
→ configured external channels queued
→ Seller inbox shows actionable Order
→ Seller opens Order detail
→ notification marked read
→ fulfillment state remains unchanged
→ Seller explicitly starts processing through permitted Order action
```
- **Critical distinction:**
```text
notification read state
≠
Order fulfillment state
```
- Opening an Order does not automatically move it to `SELLER_PROCESSING`.
- **Recommended routes:**
```text
/seller/orders
/seller/orders/{order}
```
- Optional notification entry point:
```text
/seller/notifications
```
- **Architecture:**
  - Next.js/React owns Order inbox/detail UI, unread badges, filtering, realtime refresh/polling, loading/error states, and deep links.
  - Laravel owns Seller scoping, valid-Order eligibility, Order snapshots, notification creation/read state, business authorization, idempotency, events, and safe Buyer/destination DTOs.
  - Order/Transaction records remain authoritative.
- **Feature boundaries:**
  - Buyer Checkout creates the Order and determines initial payment/order state.
  - Order Notifications alerts Seller and displays actionable details.
  - Prepare Orders owns the permitted fulfillment action/waybill preparation.
  - Confirm Delivery owns the later Seller delivery-confirmation notification.
  - Dashboard may display counts but does not own notification/Order state.
- **Non-goals:**
  - creating Orders
  - changing payment status
  - automatically starting fulfillment when Seller opens a notification
  - preparing/printing waybills
  - assigning Logistics/Courier
  - exposing unnecessary Buyer private data
  - duplicating notification records on retries
## MUST
### Seller authentication and scope
- Requires authenticated `SELLER`.
- Every Order/notification query must be scoped to the authenticated Seller/shop.
- Never trust client-submitted:
  - `seller_id`
  - Seller ownership
  - Order eligibility
  - payment status
  - fulfillment status
  - notification recipient
- Another Seller must not access the Order by guessing its ID.
- Use:
  - `401` unauthenticated
  - `403` forbidden
  - `404` Seller-scoped Order/notification missing
  - `422` invalid request
  - `409` invalid/stale Order transition where an action is attempted
### Trigger condition
- Notification is triggered only when Checkout/Order domain creates a Seller-scoped Order satisfying the configured payment/confirmation rule.
- Dedicated Seller flow calls this a **new paid/valid Order**.
- Exact trigger depends on the final payment model:
  - `PLACED`
  - another explicitly valid/confirmed state
- Do not notify Seller to fulfill an Order still considered payment-invalid.
- Exact payment/confirmation condition remains Open.
### Shared lifecycle
- AISLEY normalized lifecycle begins:
```text
PENDING_PAYMENT
→ PLACED
→ SELLER_PROCESSING
→ READY_FOR_PICKUP
→ ...
```
fileciteturn83file6
- Order Notifications does not invent its own persisted statuses.
- Seller inbox presentation groups map onto canonical states.
- State transition occurs only through validated domain actions.
### Source event
- Recommended domain event:
```text
SellerOrderBecameActionable
```
or equivalent source-defined event.
- Event originates from the authoritative Order/payment workflow.
- Recipient Seller is resolved from Order/Order Items server-side.
- Never derive recipient from frontend notification request.
### After-commit creation
- New-order notification must be dispatched only after Order/payment transaction commits.
- AISLEY shared rules explicitly require queued notifications after commit. fileciteturn83file6
- Laravel queued Notifications support `afterCommit()`; queue `after_commit` can delay notifications/events until commit. citeturn235241search0turn235241search1
- Rolled-back Order creation must not leave a normal actionable Seller notification.
### Idempotency
- One logical notification per Seller-scoped Order/new-order milestone.
- Recommended dedupe identity:
```text
seller_id
+ seller_order_id
+ event_type = ORDER_ACTIONABLE
```
- Retried Order/payment callbacks or queued jobs must not create:
  - duplicate Seller Orders
  - duplicate in-app notifications
  - duplicate external alerts
- Database uniqueness/idempotency is authoritative.
- Queue uniqueness may supplement it.
### Multi-Seller Order boundary
- AISLEY may support mixed-Seller checkout, but final partitioning is not fully defined.
- Order Notifications must operate on the **Seller-scoped Order/suborder responsibility**, not expose a Buyer parent Order containing another Seller's lines.
- If checkout creates one Order per Seller:
  - notify each relevant Seller once for their Order.
- If a parent/suborder model is selected:
  - Seller DTO contains only their suborder/items.
- Exact checkout partitioning remains an upstream Open Question.
### In-app notification
- Recommended minimum channel:
```text
database / in-app
```
- In-app notification is persistent even if external delivery fails.
- Notification contains safe references, not full Order payload.
- Recommended fields:
```text
notification_id
type = NEW_ORDER
seller_order_id
safe order reference
created_at
read_at
```
- Deep link opens the matching Seller-scoped Order.
### External notification channels
- Configured channels may include email, push, or broadcast/realtime.
- Provider is not source-defined; do not hard-code one.
- Laravel Notifications support queued channel delivery. citeturn235241search0
- External failure must not remove/duplicate the in-app Order.
### Seller inbox
- Seller can open a paginated Order inbox.
- Recommended fields: Order reference, placed time, current/actionable status, payment summary, item count, safe amount/currency, unread state, authoritative deadline when defined.
- Default newest-first; exact columns are Open.
### Inbox filters
- Dedicated source requires actionable status and unread-state filtering.
- Recommended filters:
```text
unread
read
new/actionable
processing
ready for pickup
```
- Exact presentation groups must map to canonical Order states.
- Allow-list filters/sorts in Laravel.
- Do not pass arbitrary client column names into database order clauses.
### Pagination
- Inbox must be paginated.
- Use bounded page size.
- Do not return unbounded Seller Order history.
- Detailed historical Order views may use a separate Seller Order/history surface.
### Notification unread state
- Persist Seller notification read state.
- Opening the relevant notification/Order may mark the notification read according to UI policy.
- Read action is idempotent.
- Seller can modify only their own read state.
- Read state must not alter Order fulfillment.
### Read vs fulfillment
Mandatory invariant:
```text
notification.read_at changes
→ Order.status unchanged
```
- Seller opening a notification must never automatically:
```text
PLACED → SELLER_PROCESSING
```
- Fulfillment begins only through a separate permitted Order action.
- Dedicated source explicitly requires this separation.
### Order detail
- Seller opens only Seller-scoped Orders.
- Show item/SKU snapshots, quantities, payment status, shipping method, safe Buyer/destination data, and defined deadlines.
- Use historical Order Item snapshots where required rather than current Product data.
### Order Item snapshots
- Display purchased facts from Order snapshot:
  - Product/variant/SKU description
  - quantity
  - unit price/line financial facts where Seller is authorized
- Later Product edits must not rewrite the Order detail.
- This aligns with the shared historical-snapshot rules.
### Buyer data minimization
- Expose only fulfillment/support-needed Buyer data.
- Never expose auth data, verification documents, payment credentials, unrelated saved addresses, or unrelated Orders.
- Exact contact/display fields are Open.
### Destination data
- Use the Order's immutable shipping-address snapshot, not the Buyer's current Address Book default.
- Display only the destination fields needed by Seller fulfillment.
- Seller cannot edit the Buyer address through Order Notifications.
- Any allowed pre-processing Buyer address change belongs to Buyer Order Modification/Cancellation.
### Payment status
- Show safe authoritative payment state needed for fulfillment.
- Seller cannot modify payment state from Order Notifications.
- Do not expose gateway secrets/raw payment credentials.
- Payment-failed Orders cannot be processed as ordinary valid Orders.
### Cancelled/rejected Orders
- `CANCELLED`/`REJECTED` are terminal/exception states in the shared lifecycle. fileciteturn83file6
- If an Order becomes cancelled/rejected before Seller starts processing:
  - update inbox/task state
  - prevent ordinary fulfillment action
- A previously delivered notification may remain in historical notification records.
- Do not delete audit/history simply because Order state changed.
### Payment failure
- If async payment fails before the configured Seller-actionable condition:
  - do not issue ordinary new-Order notification.
- If an Order was previously actionable and later enters a legitimate failure/reversal flow:
  - display the authoritative new state
  - block invalid processing
- Exact payment reversal behavior depends on payment design.
### Start processing
- Dedicated flow allows Seller to acknowledge/start processing through a **permitted Order action**.
- Recommended domain transition:
```text
PLACED
→ SELLER_PROCESSING
```
when project rules define that as the valid Seller action.
- Order Notifications may expose the action button/deep link, but the transition belongs to the Order fulfillment/Prepare Orders domain.
- Laravel must:
  - re-scope Order
  - revalidate current status
  - reject cancelled/payment-invalid/stale Orders
  - transition transactionally
- Do not mutate state merely because notification was clicked.
### Prepare Orders handoff
- After an Order becomes Seller-processing/actionable, UI should route/hand off to Prepare Orders.
- Prepare Orders owns:
  - package preparation
  - waybill/shipping detail
  - fulfillment-specific operations
- Order Notifications remains the intake/inbox layer.
### Notification badge consistency
- Order state changes should refresh:
  - actionable counts
  - notification/task badges
  - inbox status
- Badge count must not become a separate persisted Order truth.
- Seller Dashboard may consume these counts from the same domain/read model.
### Realtime
- `Seller.md` requires realtime alerting via WebSocket or polling. fileciteturn83file0
- Use private Seller realtime when configured, with API refetch/polling as durable recovery.
- Do not mandate a broadcast provider.
### Private broadcast authorization
- Seller notification stream must be private/authenticated.
- Only that Seller receives their notification event.
- Broadcast payload should contain safe summary + Order reference, not complete Buyer/Order data.
- HTTP Order endpoint performs full authorization again.
### Polling fallback
- Bounded Seller-scoped polling may replace/supplement realtime; interval is Open.
- WebSocket and polling must share one notification/Order store.
### Queue failure
- External notification failure:
  - does not delete the Order
  - does not mark Order invalid
  - does not create a duplicate new Order
- In-app Order/inbox remains available.
- Retry policy belongs to queue/notification infrastructure.
- Laravel queue workers support retries/failure handling. citeturn235241search1
### Deep linking
- Notification deep link must resolve to the matching Seller-scoped Order.
- If Seller no longer has authorized access, return scoped `404/403`.
- Deep-link parameters do not grant authorization.
- If Order is now cancelled/changed, show current authoritative state.
### Deadlines
- Dedicated flow says Order detail may show deadlines.
- Display only deadlines defined by actual Seller fulfillment policy.
- Do not invent a packing deadline/SLA if none exists.
- Deadline timestamps use server-authoritative UTC and render in Seller locale.
### Financial values
- Use fixed-precision amounts and explicit currency.
- Seller Order detail must not recalculate totals in React.
- Exact Seller-visible financial fields depend on Order/Transaction schema.
- Generate Report remains the detailed financial analysis feature.
### Notification retention
- Notification/history retention is Open.
- Marking notification read does not delete the Order.
- Dismissing/archiving a notification must not remove Seller Order history.
- Operational Order history remains available according to Order-retention policy.
### Security / logging
- Log safe event/Seller/Order/notification IDs and channel outcomes, not Buyer destination/payment data or full Order payloads.
### Frontend states
- Inbox: loading, empty, loaded, filtered-empty, error.
- Notification: unread, read, realtime-arriving.
- Detail: loading, actionable, processing, cancelled/payment-invalid, forbidden/not-found, error.
- Start-processing: idle, submitting, success, stale/conflict.
### Accessibility
- Use textual unread/order states, keyboard-accessible rows/links, non-disruptive realtime announcements, and accessible Buyer/destination/financial labels.
### Acceptance criteria
- [ ] Each valid Seller Order appears once for the correct Seller.
- [ ] Another Seller cannot read the Order/notification.
- [ ] Notification is emitted only after the valid Order/payment transaction commits.
- [ ] Retry/duplicate source events do not create duplicate logical notifications.
- [ ] Seller inbox is paginated and supports actionable/unread filtering.
- [ ] Notification deep link opens the matching Seller-scoped Order.
- [ ] Order detail shows authoritative item/SKU snapshots, quantity, payment, shipping, safe destination, and defined deadlines.
- [ ] Buyer data is limited to fulfillment need.
- [ ] Opening/reading a notification does not change Order fulfillment state.
- [ ] Cancelled/payment-invalid Orders cannot be started as ordinary fulfillment.
- [ ] Start-processing uses a separately validated Order/fulfillment action.
- [ ] External notification failure does not lose or duplicate the in-app Order.
- [ ] Realtime/polling state always reconciles from authoritative API/Order records.
## HOW
### Project findings
- `Seller.md` defines Order Notifications as viewing new Orders and reviewing detailed incoming-purchase information, with realtime WebSocket/polling support and `Orders`/`Transactions` integration. fileciteturn83file0
- Dedicated Seller flow narrows the trigger to a new Seller-scoped Order meeting the configured payment/confirmation condition and explicitly separates notification read state from fulfillment state.
- Buyer Checkout spec/source establishes that successful Order placement should feed Seller-facing Order Notifications only after commit. fileciteturn83file1
- Shared AISLEY architecture requires validated canonical Order transitions, Seller scoping, pagination, idempotency, and after-commit notifications. fileciteturn83file6
- Sources do not define:
  - exact payment condition for "valid Order"
  - exact notification channels
  - Seller inbox columns/filter groups
  - packing deadlines
  - polling interval
  - multi-Seller Order partition model
### Recommended Laravel events/actions
```text
Order/payment domain:
SellerOrderBecameActionable

Notification:
NotifySellerOfNewOrder

Seller reads:
GetSellerOrderInbox
GetSellerOrderDetail
MarkSellerOrderNotificationRead

Fulfillment boundary:
StartSellerOrderProcessing
```
- `StartSellerOrderProcessing` belongs to fulfillment/Prepare Orders logic even if button is shown on Order detail.
### Recommended Laravel API
```http
GET  /api/seller/orders
GET  /api/seller/orders/{order}

GET  /api/seller/notifications
POST /api/seller/notifications/{notification}/read

POST /api/seller/orders/{order}/start-processing
```
- Exact notification routes may use Laravel's normal notification resource conventions.
- Use Form Requests where mutation input exists, Seller-scoped Policies/queries, and API Resources.
### Notification implementation
Recommended:
```text
NewSellerOrderNotification implements ShouldQueue
```
Channels:
```text
database
broadcast optional
mail/push optional
```
- Queue after commit. Laravel Notifications expose `afterCommit()`. citeturn235241search0
- Database notification remains independent of external delivery success.
### Idempotency implementation
Recommended persistent guard:
```text
notification_type = NEW_ORDER
seller_id
seller_order_id
source_event_id
```
- Add an appropriate uniqueness constraint or idempotent notification-event record.
- Laravel `ShouldBeUnique` jobs may reduce duplicate queued work, but queue uniqueness alone should not be the final business duplicate guard. citeturn235241search1
### Realtime pattern
```text
Order commit
→ SellerOrderBecameActionable
→ create database notification
→ optional private broadcast
→ React updates unread/new-order badge
→ API refetch supplies durable inbox/detail
```
- If broadcast is unavailable, bounded polling may provide freshness.
### Recommended DTO
- Inbox: Seller Order ID/reference, status, payment state, placed time, item count, currency/safe total, unread state.
- Detail: canonical status, payment/shipping, Seller-owned item snapshots, safe Buyer/destination snapshot, deadlines, timeline/action capabilities.
- Prefer server-computed `can_start_processing` over frontend status guessing.
### Start-processing transition
Recommended:
```text
Seller clicks Start Processing
→ Laravel loads Seller-scoped Order
→ checks canStartProcessing(order)
→ validates payment/current state
→ transaction
→ PLACED → SELLER_PROCESSING
→ commit
→ downstream badges/events
```
- Return `409` when Order changed between display and action.
- Never infer ability from notification `read_at`.
### Next.js / React
```text
/seller/orders
├── OrderInboxFilters
├── OrderInboxTable
└── UnreadOrderBadge

/seller/orders/[order]
├── OrderSummary
├── OrderItemSnapshots
└── StartProcessingAction
```
- Use the shared Laravel API client; realtime updates hints/badges, while irreversible actions refetch authoritative Order state.
### Tests
- **Laravel:** Seller isolation; valid trigger condition; after-commit notification; duplicate event idempotency; unread/read; safe detail DTO; cancelled/payment-failed block; start-processing stale-state conflict; pagination/filtering; external notification failure.
- **Cross-feature:** Buyer successful checkout yields exactly one Seller-visible actionable Order; Prepare Orders receives only a valid processing Order.
- **Frontend:** inbox empty/loaded/filter; unread badge; realtime/polling refresh; deep link; read-vs-processing distinction; cancelled/payment-invalid display; `409`; accessibility.
### Research-backed recommendations
- Queue external notifications so creating/returning an Order does not block on slow delivery channels. citeturn235241search0turn235241search1
- Dispatch queued notification work after commit so workers never notify Sellers about rolled-back Orders. citeturn235241search0turn235241search1
- Use persistent application-level idempotency even if Laravel queue uniqueness is also enabled.
### Risks
- **False fulfillment:** treating read/open as acceptance can silently advance Orders.
- **Duplicates/privacy:** retries or weak Seller scope can duplicate alerts or leak another Seller/Buyer data.
- **Stale/realtime drift:** Order state can change after notification and WebSocket-only state can miss events.
### Open questions
- Exact payment/Order condition for Seller-actionable.
- Multi-Seller Order/suborder structure.
- Notification channels and polling interval.
- Inbox fields/filters/history retention.
- Fulfillment deadlines and safe Buyer/destination fields.
- Explicit acknowledgment vs `Start Processing`.
- Notification archive/dismiss behavior.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller source: `Seller.md`
- Seller flow: `feature-system-flows/seller/order-notifications.md`
- Buyer View Cart/Checkout spec
- Laravel 12 Notifications: https://laravel.com/docs/12.x/notifications
- Laravel 12 Queues: https://laravel.com/docs/12.x/queues
