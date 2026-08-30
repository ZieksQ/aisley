---
feature: order-status
title: Customer Order Monitoring and Logistics Tracking
system: AISLEY
status: Revised draft
role: Customer
scope: Customer storefront and Laravel API
---

# Customer Order Monitoring and Logistics Tracking

## WHAT

- Let an authenticated Customer find, monitor, and open only their own Shop Orders after checkout.
- The feature is a read model: Customer actions never advance fulfillment, shipment, or courier status.
- An Order begins in the existing checkout lifecycle as `placed`, then Seller preparation owns `seller_processing` and `ready_for_pickup`.
- Aisley Logistics owns the parcel only after it receives/scans the Seller-ready parcel against its waybill.
- On that confirmed logistics receipt, the Customer-facing group becomes **To Ship**, as required for Aisley.
- This differs from Shopee’s customer grouping, where **To Ship** is paid but not yet shipped and shipped orders move to **To Receive**; Aisley deliberately uses its defined logistics-receipt boundary instead. [Shopee Help Center](https://help.shopee.sg/portal/4/article/76732-%5BOrder-Tracking%5D-How-do-I-check-the-status-of-my-order)
- Marketplace research supports separate high-level order groups plus a detailed shipment view: Shopee exposes shipment tracking for To Ship/To Receive, and Lazada’s official Philippines guide directs customers to its order-tracking methods. [Shopee tracking](https://help.shopee.com.my/portal/4/article/78777-%5BOrder%20Tracking%5D%20%20How%20can%20I%20track%20my%20order%20status%20and%20parcel%20delivery%3F), [Lazada PH guide](https://www.youtube.com/watch?v=SDqKMOJcBy0)
- **To Ship** is a customer label, not a new persisted `orders.status`; it represents a parcel Aisley Logistics has received and is moving through its network.
- The Logistics dashboard owns transfers, hub scans, dispatch, courier assignment, location updates, and exception handling.
- The Customer detail page mirrors a safe, read-only shipment timeline and an embedded map while the parcel is actively moving.
- The Orders page follows the familiar Shopee/Lazada-style purchase history pattern: one **All** list with status tabs that filter the same Customer-owned Orders.
- An order with multiple Shop Orders remains separately trackable; a checkout batch is not one shared shipment.
- Entry journey: sign in → select the account icon in the marketplace navbar → choose **Orders** in its dropdown → `/orders` → choose an Order → `/orders/{order}`.
- Guests who select Orders go to `/login?next=/orders`; non-Customer, inactive, or unapproved sessions receive no Order data.
- Non-goals: Seller packing UI, Logistics dashboard UI, Courier mobile UI, route optimization, customer-visible courier contact details, customer status mutations, returns/refunds, or a third-party carrier integration.

## MUST

### Access and navigation

- Require `auth:sanctum` and `customer.active` for every Customer Order endpoint and page.
- Add an **Orders** item to the existing signed-in `AccountMenu`; it must be keyboard-operable, close the menu on selection, and link to `/orders`.
- Keep the existing guest account icon as a sign-in link; do not show an Order dropdown to guests.
- Scope every list, detail, timeline, map, and private event query to the authenticated Customer’s `orders.customer_id`.
- Return `401` for no session, `403` for an invalid role/account state, and `404` for a non-owned Order; never reveal whether another Customer’s reference exists.

### Customer status model

- Keep `orders.status` as the typed `OrderStatus` source of truth and use its existing string-backed database column.
- Use one server-side `CustomerOrderStatusMapper` for tabs, labels, action flags, notifications, and API Resources.
- Map current statuses as follows:

| Customer group | Canonical statuses | Customer meaning |
| --- | --- | --- |
| To Pay | `pending_payment` | Payment is unresolved. |
| To Prepare | `placed`, `seller_processing`, `ready_for_pickup` | Seller still controls preparation or waits for handoff. |
| To Ship | `assigned`, `picked_up`, `in_transit` | Logistics has received the parcel; transfer progress is available. |
| Out for Delivery | `out_for_delivery` | Assigned courier is on the final delivery run. |
| Completed | `delivered` | Delivery is complete; review handoff may be offered. |
| Cancelled / issue | `cancelled`, `rejected`, `delivery_failed`, `return_requested`, `returned` | Render the exact exceptional outcome. |

- The Logistics receipt scan is the only normal transition into the Customer **To Ship** group: `ready_for_pickup → assigned`.
- `assigned` means Logistics accepted the waybill/parcel, not merely that a seller printed a label or a courier was proposed.
- Only the shared Logistics transition service may perform that handoff, after validating the parcel, current state, authorization, and idempotency.
- Normal delivery may continue `assigned → picked_up → in_transit → out_for_delivery → delivered`; reject skipped or backward transitions with `409`.
- A Customer tab must not be mistaken for a persisted status, and exceptional states must not appear as normal progress.
- Render tabs in this order: **All**, **To Pay**, **To Prepare**, **To Ship**, **Out for Delivery**, **Completed**, and **Cancelled / Issue**.
- **All** is selected by default and lists every Customer-owned Order, newest activity first; it is not a status and has no status filter value.
- Selecting a status tab filters the existing `/orders` collection server-side, resets pagination to page one, and preserves no results as an explicit filtered-empty state.

### Logistics timeline and embedded map

- Logistics appends one immutable `order_status_events` row for every customer-visible transition, using the existing `from_status`, `to_status`, `source`, `public_metadata`, and `occurred_at` structure.
- For **To Ship**, Logistics also appends safe transfer milestones such as received at hub, departed hub, arrived at hub, courier assigned, and pickup confirmed.
- Preserve the exact source timestamp in UTC; return ISO 8601 and render in the Customer locale. Do not manufacture past events from current status.
- Persist shipment/transfer events separately from a current location when repeated location updates are required; an event is not a substitute for a live-position stream.
- A safe Customer timeline event contains public label, occurred time, optional hub/city label, and optional event type; never expose internal notes, scans, employee IDs, or full hub addresses.
- Show the embedded map only for an active Logistics shipment (`assigned`, `picked_up`, `in_transit`, or `out_for_delivery`) and only when a current position or safe route geometry exists.
- The map is read-only and must show a clear textual status/timeline alternative; it must not reveal the Customer’s full address, an exact courier home/location outside the active task, or other deliveries.
- Use a server-issued map DTO with a rounded current coordinate or approved route segment, `captured_at`, and freshness/availability state; do not send raw courier GPS history to the browser.
- If no authorized current position exists, retain the timeline and show “Location is not available yet”; never simulate a moving pin, route, ETA, or transfer.
- Stop map updates and remove active location data from Customer responses once delivered, cancelled, returned, or a delivery task is no longer active; historical timeline remains.
- Select the map provider only in the Logistics/map integration feature; this feature must consume the provider-neutral DTO and required attribution.

### List, detail, and data safety

- `GET /api/v1/customer/orders` returns a paginated, newest-activity-first Customer-owned collection with allow-listed group filter values.
- Summary fields: Order reference, Shop summary, item preview/count, money/currency snapshots, canonical status, Customer group/label, latest tracking time, and server-calculated allowed actions.
- `GET /api/v1/customer/orders/{order}` returns the owned Order’s immutable item, address, payment-summary, totals, status, timeline, map availability, and action DTOs.
- A small timeline may be embedded in detail; a paginated `GET /api/v1/customer/orders/{order}/tracking` is allowed if the event history grows.
- Never return payment credentials, full provider data, Seller payout data, private courier contact/location history, raw operational metadata, or Admin/Logistics notes.
- Keep money as server-supplied fixed-precision strings with currency; the storefront must not recalculate historical totals.
- Current Customer cancellation/modification capability flags come from the existing authoritative eligibility rule and are rechecked by their mutation endpoints.

### Updates, consistency, and privacy

- Logistics/Courier mutation flow: authorize → lock/re-read shipment and Order → validate transition → persist status/event/location atomically → commit → broadcast/notify.
- Retries for a waybill scan, transfer, or partner callback must use an idempotency reference and must not duplicate timeline events, notifications, or broadcasts.
- Broadcast only after commit through a private Customer-authorized channel such as `orders.{orderId}`; channel authorization must verify ownership.
- Broadcast a minimal tracking change (Order ID, group/label, timestamp, and optional safe event); the browser refetches detail/timeline after reconnect, focus, or a missed event.
- Cache no Customer-specific response in a shared public cache. Apply retention, precision, and access rules for location data before implementation.
- External 3PL webhooks are optional; when introduced, verify origin/signature, deduplicate provider events, map allow-listed values through the same transition service, and never expose a customer-controlled update endpoint.

### Customer experience and acceptance

- `/orders` shows loading, empty, filtered-empty, error, and paginated states; `/orders/{order}` shows loading, not-found, disconnected, normal, and exception states.
- The detail view uses a status heading, accessible text timeline, item/order summary, delivery snapshot, and map panel where available; color alone cannot communicate progress.
- Map loading, stale-location, unavailable-location, and reconnect states must be explicit and must not block timeline access.
- [ ] A signed-in Customer reaches `/orders` from **Account icon → Orders**; a guest is redirected to sign-in with a safe return path.
- [ ] `/orders` opens on the **All** tab and lists every Customer-owned Order; every other visible tab applies only its mapped status-group filter.
- [ ] A Customer cannot retrieve, subscribe to, or infer another Customer’s Order or map data.
- [ ] A Seller-ready order stays **To Prepare** until Logistics confirms its waybill receipt; that receipt changes its group to **To Ship** exactly once.
- [ ] Logistics transfer scans appear in chronological Customer timeline order with persisted server timestamps.
- [ ] An active authorized shipment can display the safe embedded map; absent/stale data displays no fabricated location or ETA.
- [ ] Customer APIs cannot mutate fulfillment status; invalid/out-of-order Logistics transitions fail without a partial event.
- [ ] Delivered and exceptional Orders remain readable and are labelled accurately; only delivered Orders may expose a review handoff.

## HOW

### Project alignment

- Reuse the checkout-created `orders`, `order_status_events`, UUID models, `OrderStatus` enum, immutable Order snapshots, and `/api/v1/customer` convention.
- No Logistics implementation currently exists, so add Logistics/Courier mutations and any shipment/location schema only in their dedicated feature work; never modify the executed checkout migration.
- If new enum-like shipment/location fields are needed, migrate them as PostgreSQL `string` columns and cast them to PHP enums.
- Customer storefront remains Next.js/TypeScript/Tailwind; Logistics dashboard is isolated from the Customer app, and Courier remains mobile-only.

### Suggested contracts and flow

```text
Seller ready → Logistics receives/scans waybill → `assigned` / To Ship
→ hub transfer scans + safe position → `picked_up` / `in_transit`
→ final courier run → `out_for_delivery` → `delivered`
→ commit → private update → Customer refetches timeline/map
```

- Use Customer `OrderController`, `OrderResource`, `OrderTrackingResource`, `CustomerOrderStatusMapper`, and an `OrderTrackingService` for read projections.
- Use a shared domain `OrderTransitionService` for Seller, Logistics, Courier, and verified partner events; controllers must not write `orders.status` directly.
- Define a Logistics-owned shipment/transfer model keyed to the Order/waybill before adding location persistence; it supplies safe Customer timeline and map projections.
- Implement `/orders` and `/orders/[order]` as authenticated Next.js routes, with initial server-safe auth redirect and Client Components only for live refresh/map interaction.
- Update `src/webapp/src/components/marketplace/account-menu.tsx` with the Orders link and suitable order icon when implementation starts.

### Verification, rollout, and open questions

- Laravel tests: Customer ownership, role gates, pagination/filter allow-list, receipt-to-To-Ship mapping, transition ordering, duplicate scan idempotency, committed event/broadcast ordering, map DTO precision/access/expiry, and partner webhook verification.
- Storefront tests: Account-menu route, sign-in return path, tab mapping, timeline ordering, active/unavailable/stale map states, reconnect refetch, keyboard access, and non-color status text.
- Log correlation IDs, transition source, waybill/shipment ID, event time, and location freshness without logging raw address, GPS history, tokens, or payment details.
- Roll out in order: Customer read list/detail → Seller readiness → Logistics receipt/transfers → Courier delivery → location/map updates; hide map capability until Logistics supplies authoritative data.
- Open: final shipment schema and multi-parcel behavior; location precision/retention; chosen map provider; polling versus broadcasting driver; ETA policy; hub label granularity; and exact handling/retry policy for `delivery_failed`.
