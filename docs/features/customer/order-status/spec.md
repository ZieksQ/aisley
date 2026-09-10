---
feature: order-status
title: Customer Order Monitoring and Logistics Tracking
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented read-only foundation; operational tracking deferred
role: Customer
scope: Customer storefront and Laravel API
---

# Customer Order Monitoring and Logistics Tracking

## WHAT

- **Purpose:** Let an authenticated Customer list, inspect, and track only their own Shop Orders after checkout.
- **Current implementation:** Paginated history, server-side group filters, Order detail, chronological tracking history, safe DTOs, private no-store responses, and the responsive `/orders` and `/orders/{order}` pages are implemented.
- This tracking projection is read-only. Customer pages never advance fulfillment, assign a Courier, scan a parcel, or choose a route; the narrowly scoped cancellation and delivery-address actions belong to Customer Order Modification and Cancellation.
- Checkout creates `placed`; Seller Order Approval/Prepare Orders owns `seller_processing` and `ready_for_pickup`. Logistics and Courier operations are future owners of detailed physical milestones.
- High-level `OrderStatus` values remain the compatibility contract. The Customer-facing **To Ship** tab is a label for Logistics-owned progress, not a new database status.
- An Order from each Shop remains independently trackable even when several Orders share one checkout batch.
- **Non-goals:** Seller packing, Logistics/Courier web UI, status mutation, route optimization, live courier contact/GPS, returns/refunds, and third-party carrier webhooks.

```text
Account menu → Orders → paginated Customer-owned list
→ status-group filter → Order detail
→ safe status events/timeline (and future map capability)
```

## MUST

### Access, scope, and navigation

- Require `auth:sanctum` and `customer.active` for every Order list, detail, and tracking request.
- Scope all queries through the authenticated Customer's `orders.customer_id`; do not accept a Customer ID, role, status, or ownership selector from the browser.
- A guest is sent to `/login?next=/orders`. Wrong-role, pending, rejected, suspended, or deactivated sessions receive no Customer Order data.
- Return `401` for no session, `403` for invalid role/status, and `404` for a non-owned Order without revealing whether another Customer's ID exists.
- The signed-in AccountMenu exposes **Orders** as a keyboard-accessible link. Public marketplace browsing remains available to guests.

### Canonical status and group mapping

- Keep `orders.status` as the typed `OrderStatus` source of truth in a string-backed database column. Do not add uppercase aliases or a Customer-only status column.
- Use one server-side `CustomerOrderStatusMapper` for tabs, labels, action flags, notifications, and Resources:

| Customer group | Canonical statuses | Meaning |
| --- | --- | --- |
| To Pay | `pending_payment` | Payment unresolved; future online-payment path. |
| To Prepare | `placed`, `seller_processing`, `ready_for_pickup` | Checkout/Seller preparation or handoff wait. |
| To Ship | `assigned`, `picked_up`, `in_transit` | Logistics has accepted the parcel or it is moving. |
| Out for Delivery | `out_for_delivery` | Final-mile movement is underway. |
| Completed | `delivered` | Delivery completed. |
| Cancelled / Issue | `cancelled`, `rejected`, `delivery_failed`, `return_requested`, `returned` | Exceptional or terminal outcome. |

- Current COD checkout skips `pending_payment` and starts at `placed`; retain the **To Pay** mapping for future payment methods.
- `ready_for_pickup → assigned` is the normal high-level handoff when Logistics receives and accepts the parcel at its sole hub. `assigned` does not mean a Seller merely printed a label or proposed a Courier.
- `assigned → picked_up → in_transit → out_for_delivery → delivered` is the compatibility sequence for final-mile progress. Invalid skipped/backward transitions belong to the owning transition service and return `409`.
- Detailed Shipment/Delivery Task milestones are separate: `picked_up_from_seller`, `received_at_hub`, `sorted_at_hub`, `dispatched_from_hub`, `delivery_assigned`, and `picked_up_from_hub`. Do not persist or infer these from generic `picked_up` until the shared operational schema exists.
- First-mile and final-mile assignments are independent; a first-mile Courier is not automatically the final-mile Courier.

### Customer notification boundary

- Create Customer Order notifications only for important decisions or outcomes: Seller approval (`seller_processing`), cancellation/rejection (`cancelled`, `rejected`), delivery milestones (`out_for_delivery`, `delivered`), and parcel/fulfillment issues (`delivery_failed`, `return_requested`, `returned`).
- Placement, payment-wait, routine preparation, and movement states (`placed`, `pending_payment`, `ready_for_pickup`, `assigned`, `picked_up`, `in_transit`) remain visible in the Order timeline but do not create Customer notifications.
- First-mile pickup schedules and Seller-origin collection reminders notify the Seller and assigned Courier, not the Customer.
- Apply the same allow-list when reading notifications so legacy routine-movement records no longer appear or become directly accessible in the Customer notification center.

### List, detail, and timeline data

- `/orders` defaults to **All**, then uses the same server-side collection for the six status tabs. Filters reset pagination and reject unknown groups.
- Sort deterministically by latest status activity, placement time, and UUID tie-breaker. Bound `page` and `per_page` using the API request rules.
- List DTOs contain only Order reference, Shop summary, item preview/counts, fixed-precision totals, canonical status/group labels, latest activity, safe action flags, and detail URL.
- Detail DTOs contain immutable item/price/voucher snapshots, delivery-address snapshot needed by the Customer, COD/payment summary, totals, timeline, map capability, and action flags. Do not expose Seller/Admin/Courier private data, payment secrets, raw storage paths, or another Order's IDs.
- Timeline events are immutable, UTC/ISO-8601, chronological, and limited to safe public label, event type, optional hub/city label, and occurrence time. Internal notes, employee IDs, scan payloads, and full hub addresses are excluded.
- Historical cancelled/rejected Orders remain in the Customer's list and timeline.

### Map and freshness boundary

- The current API returns an explicit unavailable map state because Shipment/Delivery Task/location records are not implemented. Do not fabricate a position, route, ETA, or courier identity.
- Future map DTOs must be provider-neutral, read-only, authorization-checked, rounded/freshness-labeled, and limited to an active task (`assigned`, `picked_up`, `in_transit`, or `out_for_delivery`).
- Stop active location exposure after delivery, cancellation, return, or task completion; preserve safe historical events.
- Map rendering/provider choice belongs to the Logistics/location feature, not this Customer read model. The Customer Address Book's Geoapify/Leaflet pin is unrelated to parcel tracking.

### Refresh, privacy, and acceptance

- Responses are private and `Cache-Control: no-store`; never personalized-cache Order data.
- Initial load, pagination, filter, focus/reconnect refresh, and explicit retry must distinguish loading, authoritative empty, filtered-empty, stale/unavailable, `401`/`403`/`404`, and recoverable server/network failure.
- Broadcast or polling may be added only as a minimal change signal; the browser refetches the authoritative list/detail and never accepts a client status update.
- [x] `/orders` lists only the active Customer's Orders with All as the default and bounded server pagination.
- [x] Tabs and labels come from the canonical mapper and include exceptional statuses.
- [x] Detail and tracking endpoints enforce ownership and return safe immutable snapshots/events.
- [x] Current map/action DTOs truthfully report unavailable map and server-derived Customer action capabilities; `placed` mutation capabilities are defined by Customer Order Modification and Cancellation.
- [x] Responsive pages provide accessible loading, empty, error, retry, pagination, and status text states.
- [ ] Logistics receipt, Shipment/Parcel/Waybill, Delivery Task, scan, assignment, live map, and final-mile events are implemented.

## HOW

### Current interfaces and implementation

- API routes are `GET /api/v1/customer/orders`, `GET /api/v1/customer/orders/{order}`, and `GET /api/v1/customer/orders/{order}/tracking`.
- Laravel uses `OrderController`, `OrderTrackingService`, `CustomerOrderStatusMapper`, `ListOrdersRequest`, `ListOrderTrackingRequest`, `OrderSummaryResource`, `OrderResource`, and `OrderTrackingResource`.
- `OrderTrackingService` scopes by `customer_id`, eager-loads only safe relations, limits embedded timeline rows, and uses deterministic ordering. Controllers set private no-store headers.
- The Webapp implements `/orders`, `/orders/{order}`, AccountMenu navigation, tab query state, pagination, focus/reconnect refresh, and unavailable-map messaging.

### Future operational handoff

- When the shared schema is approved, Logistics owns the first-mile task after `ready_for_pickup`, hub receipt/sorting/dispatch, and final-mile assignment; Courier actions are API contracts for the external mobile app.
- The Customer projection may map authoritative Shipment/Delivery Task events to safe timeline entries, but it must not create or mutate those records.
- `assigned`/`picked_up` remain high-level compatibility values while detailed events carry physical custody. The Customer UI should show the detailed event label only when a committed event exists.

### Verification and references

- API tests cover role/status denial, IDOR-safe not-found behavior, group allow-lists, pagination, status mapping, event ordering, no-store headers, and map/action capability truthfulness.
- Storefront tests cover login return paths, default All tab, group filtering, loading/empty/error/retry states, timeline ordering, accessibility, and stale/unavailable map states.
- Do not add a shipment migration or provider-specific tracking field here. Follow `docs/workspace.md`, `docs/schema.md`, `docs/domains/Buyer.md`, `docs/domains/Logistics.md`, and `docs/domains/Courier.md` before operational work.
