---
feature: order-status
title: Customer / Buyer Order Status
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Order Status
## WHAT
- **Purpose:** Give authenticated Buyers a post-purchase interface for viewing their Orders and tracking fulfillment progress from placement through delivery.
- **Canonical role:** `BUYER`.
- **Source-defined Buyer labels include:**
  - To Ship
  - In Transit
  - Out for Delivery
  - Rate / Feedback after delivery
- **Source-defined behavior:** Buyers monitor lifecycle changes in real time as an Order moves from Seller processing through logistics/courier delivery to `DELIVERED`.
- **AISLEY canonical lifecycle:**
```text
PENDING_PAYMENT
→ PLACED
→ SELLER_PROCESSING
→ READY_FOR_PICKUP
→ ASSIGNED
→ PICKED_UP
→ IN_TRANSIT
→ OUT_FOR_DELIVERY
→ DELIVERED
```
- **Terminal / exceptional states:**
```text
CANCELLED
REJECTED
DELIVERY_FAILED
RETURN_REQUESTED
RETURNED
```
- **Important distinction:** Buyer-facing labels such as `To Ship` are presentation groupings, not necessarily database statuses.
- **Recommended route structure:**
```text
/orders
/orders/{order}
```
- **Architecture:**
  - Next.js/React owns order list/detail rendering, timeline UI, filters/tabs, loading/empty/error states, and real-time subscription behavior.
  - Laravel owns Buyer ownership, authoritative Order state, timeline/history projection, safe DTOs, and real-time events.
  - Seller, Logistics, and Courier workflows own the valid mutations that advance the Order lifecycle.
  - Order Status is primarily a read model; it does not arbitrarily advance fulfillment state.
- **Tracking source:**
  - AISLEY's internal Order state is authoritative.
  - Seller/Logistics/Courier actions update the shared state machine.
  - If a real external 3PL is integrated, verified partner events may map into the same internal states.
- **Non-goals:**
  - Seller fulfillment actions
  - Logistics dispatch
  - Courier pickup/delivery mutations
  - arbitrary Buyer status updates
  - live courier GPS tracking unless separately specified
  - inventing a third-party carrier integration when AISLEY internal logistics is used
  - returns/refunds implementation
  - review creation logic beyond handing off after delivery
## MUST
### Authentication and ownership
- Order Status requires authenticated `BUYER`.
- Every Order query must be scoped to the authenticated Buyer.
- Never trust client-supplied:
  - `buyer_id`
  - order owner
  - status
  - seller ID as ownership proof
- Another Buyer must not:
  - list the Order
  - view Order detail
  - subscribe to its private tracking channel
  - see its address/payment/delivery metadata
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden where appropriate
  - `404` Buyer-scoped Order not found
### Order list
- Buyer must be able to view their Orders in a paginated collection.
- Default ordering should be newest/recent activity first.
- Recommended safe list fields:
  - Order ID/reference
  - placed timestamp
  - seller/shop summary
  - product/item summary
  - authoritative status
  - Buyer-facing status label/group
  - total amount using fixed precision
  - currency
  - latest tracking timestamp
  - applicable Buyer action flags
- Do not expose:
  - unrelated Seller private data
  - Courier private contact data
  - internal Logistics notes
  - payment credentials
  - Admin/compliance notes
### Buyer-facing status groups
- The source uses broad labels such as `To Ship`, `In Transit`, `Out for Delivery`, and `Rate/Feedback`.
- Laravel or a shared presentation mapping must map normalized statuses consistently.
- Recommended conceptual mapping:
```text
TO_PAY
- PENDING_PAYMENT

TO_SHIP
- PLACED
- SELLER_PROCESSING
- READY_FOR_PICKUP

IN_TRANSIT
- ASSIGNED
- PICKED_UP
- IN_TRANSIT

OUT_FOR_DELIVERY
- OUT_FOR_DELIVERY

COMPLETED / RATE
- DELIVERED

EXCEPTION
- CANCELLED
- REJECTED
- DELIVERY_FAILED
- RETURN_REQUESTED
- RETURNED
```
- This mapping is a recommendation derived from the shared lifecycle; exact Buyer labels are Open.
- Do not rename the persisted Order status merely to match a UI tab.
- Exceptional states must not be falsely displayed as ordinary progress.
### Canonical status authority
- `orders.status` or the repository-equivalent Order lifecycle field is authoritative.
- React must not derive or persist fulfillment state independently.
- Seller, Logistics, Courier, payment, and exception workflows may transition the Order only through validated domain rules.
- Order Status consumes those committed transitions.
- Buyer tracking must never accept:
```json
{ "status": "DELIVERED" }
```
as a Buyer mutation.
### Valid lifecycle order
- Timeline/progress UI must respect the normalized lifecycle.
- Do not show impossible progress such as:
```text
OUT_FOR_DELIVERY
before
PICKED_UP
```
unless an approved exception/state mapping explicitly supports it.
- A state transition is valid only when the previous state allows it.
- Order Status should render the persisted truth even when an exception interrupts the normal path.
### Order detail
- Buyer must be able to open a Buyer-owned Order detail view.
- Recommended safe detail fields:
  - Order ID/reference
  - current status
  - Buyer-facing status text
  - ordered item/variant/quantity summaries
  - seller/shop summary
  - fixed-precision totals/currency
  - delivery-address snapshot, masked where appropriate
  - payment-method/status summary without secrets
  - timestamps
  - tracking timeline
  - allowed Buyer actions
- Do not expose full payment-provider payloads, Seller payout data, or internal operations notes.
### Tracking timeline
- Order Detail should expose an ordered tracking timeline.
- Minimum conceptual event fields:
```text
status
public label
occurred_at
optional safe location/hub label
```
- Timeline events should come from:
  - persisted Order status history/event records when available, or
  - a reliable projection from authoritative lifecycle timestamps
- Do not fabricate historical timestamps from the current status.
- If the schema stores only current status and no history, exact timeline-history requirements are an Open Question.
### Status history recommendation
- A dedicated status-history/event record is recommended because a single `orders.status` value cannot explain when each transition happened.
- Conceptual model:
```text
order_status_events
- id
- order_id
- from_status
- to_status
- occurred_at
- actor_type / source
- safe_public_metadata
```
- Do not expose private operational metadata directly to Buyers.
- Status history should be append-only for historical correctness.
- Exact schema may reuse an existing Order event/audit table.
### Real-time updates
- Buyer source explicitly expects real-time tracking.
- `README.md` assigns real-time Order Status delivery to Laravel broadcasting.
- Recommended flow:
```text
Seller / Logistics / Courier changes Order
→ validate transition
→ persist state + history
→ commit
→ broadcast OrderStatusUpdated
→ Buyer UI updates/refetches
```
- Database state remains authoritative.
- A missed WebSocket event must not cause permanent stale state.
- On reconnect or page focus/reload, refetch the Order.
### Private order channel
- Real-time Order events must use a Buyer-authorized private channel.
- Conceptual:
```text
private-orders.{orderId}
```
- Channel authorization must verify the authenticated account owns the Order or has another explicitly authorized operational role.
- Buyer must not subscribe to another Buyer's Order by guessing an ID.
- Laravel broadcasting documentation demonstrates private Order channels authorized against Order ownership. citeturn242293search5
### Broadcast payload
- Broadcast only safe fields needed to update tracking.
- Recommended:
  - Order ID
  - new status
  - Buyer-facing label
  - occurred timestamp
  - optional safe timeline event
- Do not broadcast:
  - entire raw Order model
  - buyer address unless necessary
  - payment-provider payloads
  - internal Seller/Logistics/Courier notes
- After receiving an event, the frontend may refetch full Order detail to avoid overloading broadcasts.
### After-commit behavior
- Broadcast/notification occurs only after the state transition commits.
- Rolled-back transitions must not appear in Buyer tracking.
- Laravel supports queued events/listeners/broadcast work that runs after database commit. citeturn242293search0turn242293search3
- Broadcast failure must not revert a successfully committed Order transition.
### Internal Logistics / Courier tracking
- AISLEY has internal Logistics and Courier roles.
- Logistics can update Order status and should trigger Buyer/Seller notifications when the physical state changes. fileciteturn41file1
- Courier pickup/delivery workflows advance the parcel through active transit and ultimately `DELIVERED`. fileciteturn41file3turn41file5
- Buyer Order Status must consume those shared Order transitions.
- Do not require an external 3PL webhook merely to represent AISLEY's own internal/simulated logistics process.
### External 3PL integration
- `Buyer.md` explicitly mentions 3PL API/webhook integration as its system context. fileciteturn41file4
- Treat this as an integration path when AISLEY uses a real third-party logistics provider.
- If external 3PL exists:
  - Laravel receives the provider callback/webhook
  - authenticate/verify provider request according to that provider's protocol
  - map provider event to an allow-listed AISLEY lifecycle transition
  - reject impossible/out-of-order transitions
  - persist provider event/reference for idempotency
  - commit internal state
  - broadcast internal `OrderStatusUpdated`
- Never expose provider webhook endpoints directly as Buyer-controlled status mutation.
- Exact carrier/provider and signature scheme are Open.
- Do not implement a generic unauthenticated "set status" webhook.
### External event idempotency
- Provider retries must not duplicate status history, notifications, or broadcasts.
- Persist a provider event ID/reference or equivalent idempotency key when available.
### Simulated Logistics progress
- If project logistics uses simulated transfer progress rather than real carrier telemetry:
  - simulated progress must not fabricate arbitrary lifecycle states outside the approved Logistics flow
  - only completion/approved milestones should update authoritative Order state
  - Buyer UI may display simulated progress only if that behavior is explicitly defined by the Logistics feature
- Order Status does not create or advance the simulation.
- The Logistics domain owns that process.
### Estimated delivery time
- Buyer source does not define ETA calculation.
- Do not invent:
  - guaranteed delivery dates
  - route duration
  - dynamic ETA
- ETA may be shown only when provided by an authoritative Logistics/Courier/carrier service.
- If absent, omit it or display neutral status text.
### Live courier location
- Courier source says delivery **may involve** live GPS tracking. fileciteturn41file5
- Therefore live map/GPS tracking is optional, not mandatory for Order Status.
- If later added:
  - scope location access to active authorized delivery
  - reduce location precision/exposure where appropriate
  - stop Buyer access when no longer operationally needed
- Do not infer location from unrelated Courier account data.
### Notifications
- Status notifications are supplementary to Order Status and must dispatch after commit.
- Notification failure does not roll back the Order transition.
- In-app/push/email channel selection belongs to notification preferences/integration policy.
### Cancellation integration
- `CANCELLED` is terminal/exceptional and remains visible in history.
- Order Modification/Cancellation owns eligibility; Order Status only renders backend capability flags/results.
### Delivery-failure / return states
- `DELIVERY_FAILED`, `RETURN_REQUESTED`, and `RETURNED` must render distinctly from normal progress.
- Recovery/refund actions belong to their owning features; never imply refund completion from status alone.
### Delivered / review handoff
- Buyer source says the lifecycle culminates in delivery and a prompt for product review. fileciteturn40file0
- When Order is `DELIVERED`:
  - show delivered state
  - Product Reviews & Ratings may expose a Rate/Review action
- Order Status must not create reviews itself.
- Review eligibility remains owned by Product Reviews & Ratings.
- Do not show a successful review action for an unverified/non-delivered purchase.
### Proof of delivery
- Courier e-POD is Order-linked evidence, but Buyer visibility is not source-defined. fileciteturn40file2
- If later exposed, use authorized/signed media access and safe fields.
### Order filters / tabs
- Recommended Buyer filters:
  - All
  - To Pay
  - To Ship
  - In Transit
  - Out for Delivery
  - Completed
  - Cancelled / Exceptions
- Exact labels/tab set are Open.
- Filters must map to allow-listed internal statuses server-side.
- Never pass arbitrary status expressions directly into queries.
- Filtering does not change Order state.
### Pagination
- Order list must be paginated.
- Keep filter/sort query parameters allow-listed.
- Do not return a Buyer's entire lifetime Order history unbounded.
- Stable default sort: recent Order/activity descending.
- Laravel's project architecture requires pagination for collection views. fileciteturn40file12
### Timestamps
- Store UTC, return ISO 8601, render in Buyer locale/timezone, and order tracking by server-generated timestamps.
### Money and privacy
- Order totals use fixed-precision values and explicit currency; React must not recalculate historical totals.
- Return only Buyer-needed Order data and mask payment details, unnecessary contacts, evidence, operational notes, and private Courier/Seller fields.
- The owning Buyer may see their Order-address snapshot; Buyer-private responses must not use shared public cache.
### Frontend states
- Order list: loading, empty, loaded, filter-empty, error, unauthenticated.
- Detail: loading, loaded, not found, error, disconnected/reconnecting.
- Tracking: normal, completed, cancelled, rejected, delivery failed, return requested/returned.
- Disconnect must not imply fulfillment stopped.
### Accessibility
- Status/progress must have textual equivalents and not rely on color.
- Timeline events need labels/timestamps; filters/cards must be keyboard accessible.
- Real-time updates should be announced without stealing focus.
### Acceptance criteria
- [ ] Guest cannot access private Buyer Order Status.
- [ ] Buyer sees only their own Orders.
- [ ] Order list is paginated.
- [ ] Buyer-facing labels map consistently from canonical Order states.
- [ ] Normal lifecycle states render in valid sequence.
- [ ] Exceptional states do not appear as ordinary progress.
- [ ] Order detail uses safe DTOs and fixed-precision totals.
- [ ] Tracking timeline uses persisted/authoritative timestamps.
- [ ] Buyer cannot mutate Order status through tracking APIs.
- [ ] Private broadcast channel verifies Order ownership.
- [ ] Broadcast payload excludes sensitive raw Order data.
- [ ] Status broadcast occurs after the source transition commits.
- [ ] Missed real-time events recover through refetch.
- [ ] Internal Seller/Logistics/Courier transitions update Buyer tracking.
- [ ] External 3PL is not mandatory when AISLEY internal logistics is used.
- [ ] External webhook events, when enabled, are verified, mapped, and idempotent.
- [ ] Live GPS/ETA are not fabricated when unavailable.
- [ ] Cancelled Orders remain in history.
- [ ] `DELIVERED` enables handoff to Product Reviews & Ratings rather than creating a review directly.
- [ ] UI handles loading, empty, exception, not-found, and reconnect states.
## HOW
### Project findings
- `Buyer.md` defines View Orders' Status as real-time post-purchase tracking from Seller processing through logistics transit, out-for-delivery, delivery, and Rate/Feedback. fileciteturn40file0turn41file4
- It says the feature subscribes to `Orders` state changes and mentions 3PL webhooks mapped into internal statuses. fileciteturn41file4
- AISLEY's architecture already defines internal Logistics/Courier roles and a normalized shared Order lifecycle, with Laravel broadcasting explicitly responsible for real-time Order Status delivery. fileciteturn40file1turn41file10
- Logistics can mutate parcel status and trigger Buyer/Seller notifications; Courier pickup/delivery advances transit and `DELIVERED`. fileciteturn41file1turn41file3
- Therefore external 3PL integration should remain optional unless a real provider is selected; AISLEY's internal Order state remains the canonical Buyer-facing model.
- Sources do not define exact Buyer tab labels, status-history schema, ETA, live GPS, selected broadcast driver, or external carrier.
### Laravel API
Conceptual endpoints:
```http
GET /api/buyer/orders
GET /api/buyer/orders/{order}
GET /api/buyer/orders/{order}/timeline
```
- Timeline may be embedded in detail if small.
- Use authenticated Buyer query scope / `OrderPolicy`.
- Use allow-listed status-group filters.
- Return:
  - `OrderSummaryResource`
  - `OrderDetailResource`
  - `OrderStatusEventResource`
- Keep tracking endpoints read-only.
### Query / projection service
Recommended concepts:
```text
GetBuyerOrders
GetBuyerOrderDetail
GetOrderTrackingTimeline
MapOrderStatusForBuyer
```
- `MapOrderStatusForBuyer` maps normalized states to UI groups/labels.
- Keep mapping centralized so `/orders`, notifications, and Customer Homepage/order widgets cannot disagree.
- Do not duplicate state labels in multiple React components.
### Status event persistence
- When an owning workflow changes Order state:
  1. validate transition
  2. persist new state
  3. append status-history event when schema supports it
  4. commit
  5. broadcast/notify
- Existing domain actions should call one shared transition service rather than writing `orders.status` ad hoc.
- If the repository already has an Order event/history table, reuse it.
### Laravel broadcasting
- Recommended event:
```text
OrderStatusUpdated
```
- Recommended channel:
```text
orders.{orderId}
```
as a private channel.
- Laravel's broadcasting docs specifically show private Order channels with authorization restricted to the Order's owner. citeturn242293search5
- If Customer Auth is implemented with Sanctum SPA sessions, Laravel documents private broadcast-channel authorization through authenticated Sanctum middleware. citeturn242293search2
- Use the repository-selected broadcast driver; do not hard-code Reverb/Pusher/Ably.
### Next.js / React
Recommended pages/components:
```text
/orders
├── OrderStatusTabs
├── OrderList
└── OrderCard

/orders/{order}
├── OrderSummary
├── OrderTrackingTimeline
├── OrderItems
├── DeliverySummary
└── BuyerOrderActions
```
- Order detail real-time listener is a Client Component.
- Fetch initial data through shared Laravel API client.
- On `OrderStatusUpdated`:
  - merge the safe event, or
  - refetch detail/timeline
- Refetch on reconnect/focus where appropriate.
- Do not depend on WebSocket receipt for correctness.
### External 3PL adapter
If later required:
```text
3PL webhook
→ ProviderWebhookController
→ verify provider authenticity
→ normalize provider event
→ deduplicate
→ Map3PLStatusToOrderStatus
→ shared OrderTransitionService
→ commit
→ OrderStatusUpdated
```
- Maintain an explicit allow-listed provider-status mapping.
- Unknown provider statuses should be recorded/observed safely rather than blindly applied.
- Preserve raw provider references only as needed for diagnostics/idempotency, with sensitive data minimized.
### Tests
- **Laravel:** ownership; pagination/filter groups; safe detail; label mapping; timeline; private-channel auth; after-commit/rollback broadcast; Logistics/Courier visibility; duplicate 3PL event handling when enabled.
- **Frontend:** tabs/filters; empty/detail/timeline; live refetch/reconnect; delivered review handoff; exception states; accessibility.
### Research-backed recommendations
- Use Laravel private channels for Order updates and authorize against Order ownership. citeturn242293search5
- Treat broadcasting as a real-time optimization over persisted Order state, not the sole source of truth.
- Dispatch broadcast/notification work after database commit to avoid presenting rolled-back status transitions. citeturn242293search0turn242293search3
- Keep the external 3PL adapter behind the same internal Order state machine instead of exposing provider statuses directly to React.
### Risks
- **Cross-Buyer leakage:** weak Order/channel scoping exposes private purchases and addresses.
- **Status divergence:** Seller, Logistics, Courier, and Buyer UI may use incompatible status mappings.
- **Fake progress:** simulated/external progress may be mistaken for authoritative physical milestones.
- **Broadcast loss:** relying only on WebSockets can leave clients stale after disconnect.
- **Out-of-order events:** external providers/retries can regress Order state without validation.
- **Duplicate events:** repeated provider callbacks can duplicate history/notifications.
- **Privacy:** raw delivery/payment/Courier metadata can leak through overly broad DTOs/broadcasts.
- **History gap:** current-status-only schemas cannot accurately reconstruct a timeline.
### Open questions
- Exact Buyer-facing tabs/status-group mapping.
- Whether status history already exists or needs a table.
- Whether external 3PL integration is actually implemented and its provider/signature scheme.
- Whether simulated Logistics progress, ETA, live Courier GPS, or e-POD are Buyer-visible.
- Safe hub/location labels and selected broadcast driver.
- Notification channels for status updates.
- Return-state tab mapping and completed-Order retention/history behavior.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- Logistics feature model: `Logistics.md`
- Courier feature model: `Courier.md`
- Seller feature model: `Seller.md`
- Laravel Broadcasting: https://laravel.com/docs/12.x/broadcasting
- Laravel Sanctum private-channel authorization: https://laravel.com/docs/12.x/sanctum
- Laravel Queues / after-commit: https://laravel.com/docs/12.x/queues
