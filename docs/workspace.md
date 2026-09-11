# Workflows

Defines **HOW** the system behaves: step-by-step flows and state transitions per role.

# Authentication and Account Rules

## Shared Users Table

All roles live in the same logical users table.

Email addresses may be reused across different roles but not within the same role.

Required uniqueness rule:

unique(email, role)

`customer` is the canonical persisted/API role name. “Buyer” is the customer-facing marketplace term for that role; it must not be used as a second role value in routes, permissions, enums, or DTOs.

5.2 Registration and Approval Flow

Buyer

register → admin approval → email notification → sign in

Seller

register → admin approval → email notification → sign in

Logistics

register → admin approval → email notification → sign in → MVP access (subscription billing/enforcement deferred)

Courier

search/select Logistics company → automatically associate its sole hub → register under logistics → logistics approval → sign in

Admin

initial admin from environment credentials → create partners/admins → assign custom permissions

5.3 Web Authentication

React/Next.js web applications shall use stateful Laravel authentication with HttpOnly session cookies.

Flow:

Request /sanctum/csrf-cookie.

Submit credentials to /login.

Laravel returns an encrypted session cookie.

Browser sends the cookie automatically on authenticated requests.

5.4 Mobile Authentication

Flutter mobile applications shall use stateless bearer tokens.

Flow:

Submit credentials and device_name.

Backend creates a personal access token.

Mobile app stores the token using secure device storage.

Subsequent API requests send:

Authorization: Bearer <token>

5.5 Authorization

All protected functionality must validate:

Authenticated user.

Correct role.

Resource ownership.

Current workflow/status.

Logistics-to-courier relationship when applicable.

A Seller must not access another Seller's shop, products, inventory, or seller-scoped orders.

A Logistics account must not manage another Logistics company's couriers.

A Courier must only operate jobs that are available or assigned within their authorized Logistics relationship.

## 5.6 Logistics Organization and Hub Scope

For the MVP, each Logistics organization/company owns exactly one operational hub/sorting center. This is a deliberate scale-down of the real-world model, where a Logistics company may operate multiple hubs and sub-hubs.

- Sub-hubs, additional hubs, and multi-hub operations are out of scope for the MVP.
- For the MVP, the Logistics registration address represents the address of the organization's sole operational hub/sorting center. The Logistics account operates this hub through the Logistics dashboard. No separate hub address or sub-hub address is collected.
- If an exact hub pin is collected, reuse the Customer Address Book provider split: PSGC/manual fields are authoritative, Geoapify assists after **Pin location**, and Leaflet renders the pin with Geoapify tiles. No Mapbox dependency is used.
- Courier registration selects the Logistics company; its sole hub is associated automatically. A separate hub/sub-hub selector is not needed.
- Parcels, waybills, sorting, transfer, dispatch, Couriers, fleet records, zones, and capacity views are scoped to that Logistics organization's single hub.
- The transfer step does not represent movement between multiple hubs owned by the same Logistics organization. Any future multi-hub or inter-organization handoff requires a separate approved workflow.
- The MVP has one Logistics operating account per organization. Staff, dispatcher, and sub-account credentials are deferred to a later authorization decision and must not be implied by this workflow.

6. Buyer MVP Requirements

6.1 Guest Browsing

The system shall allow unauthenticated users to browse available products.

Authentication is required before placing an order.

6.2 Product Search and Selection

Buyer shall be able to:

Search products.

View product summary information.

Open a product detail page.

Select quantity.

Select available variations such as color or size.

Add the configured product to cart.

Buy the configured product immediately.

The system shall validate stock availability before accepting a purchase.

6.3 Browse Seller Shop

Buyer shall be able to:

Open a Seller's shop.

View products belonging to that Seller.

Filter the shop catalog using the Seller's available categories.

6.4 Cart and Checkout

Buyer shall be able to:

View cart contents.

Select items for checkout.

Review quantity and selected variants.

Apply eligible vouchers and discounts.

Select a shipping address.

Checkout remains provider-neutral. The Seller selects one eligible Logistics organization when requesting pickup.

Use the current COD payment flow. Future online payment methods require a separate payment contract.

Review final order details.

Place the order.

The system must protect inventory from overselling when an order is finalized.

Successful COD placement skips `pending_payment`, creates the Order at `placed` with `payment_status = pending`, and reserves the requested inventory atomically. `pending_payment` remains available for a future online-payment flow.

The checkout schema does not persist a Logistics provider directly. The implemented Seller pickup-request transaction stores one server-validated eligible Logistics organization with its derived sole hub on the pickup/fulfillment records and must not silently replace it after commitment.

6.5 Address Book

Buyer shall be able to save and manage multiple shipping and billing addresses.

The address experience shall use the Customer Address Book flow: bundled PSGC Region → Province → City/Municipality → Barangay options, manual street/house/postal entry, optional Geoapify autocomplete or forward geocoding after **Pin location**, and a Leaflet map rendered with Geoapify tiles for click, drag, or GPS pin placement. Manual entry remains available when lookup or map services are unavailable. No Mapbox dependency, geocoding, or map rendering is used.

6.6 Order Status

Buyer shall be able to view the lifecycle of an order through a server-owned status mapper. Persisted/API values use lowercase `snake_case`; display labels are separate from machine values.

The current high-level `OrderStatus` values are:

`pending_payment` → `placed` → `seller_processing` → `ready_for_pickup` → `picked_up` → `in_transit` → `out_for_delivery` → `delivered`.

The exceptional values are `cancelled`, `rejected`, `delivery_failed`, `return_requested`, and `returned`.

`picked_up` means the assigned first-mile Courier explicitly confirmed physical possession from the Seller. `assigned` remains reserved for the later Logistics/final-mile assignment contract and is not written by current pickup scheduling. Detailed first-mile, hub, and assignment milestones belong to the Shipment/Delivery Task state described in section 11.2.

Only the owning domain may advance a status, and every transition must be validated and recorded in status history. A Customer can read these states but cannot mutate them.

6.7 Order Modification and Cancellation

Buyer shall be able to cancel or change eligible order details only before the Seller processes the order.

The MVP shall at minimum enforce this using canonical order status, allowing changes only while the Order remains `placed` and before Seller processing begins.

When an eligible cancellation or rejection is committed before `picked_up_from_seller`, the Inventory service releases only that Order's reserved SKU quantities once and transactionally. Post-pickup cancellation, delivery failure, returns, refunds, and partial fulfillment remain deferred.

6.8 Reviews and Ratings

After delivery, Buyer shall be able to:

Rate a purchased product.

Leave text feedback.

Submit review media if media upload is included in the MVP build.

Reviews must be restricted to verified purchases.

6.9 Buyer Account

Buyer shall be able to update basic profile/account information.

7. Seller MVP Requirements

7.1 One Seller, One Shop

The system shall enforce a 1:1 relationship:

Seller Account ↔ Shop

A Seller cannot own multiple shops in the MVP.

Seller registration creates the one Shop in `pending` state. Admin approval activates that existing Shop atomically with the Seller account and accepted registration evidence; missing or invalid required evidence prevents approval. After approval, `SHOP_SETUP_REQUIRED` is used only when storefront setup is incomplete. Publishing requires an active approved Seller and Shop, a valid business/shop name, one active Shop Category, a valid business address, and the server-generated unique slug. No second Shop is created.

7.2 Product and Inventory Management

Seller shall be able to:

Add products.

Update products.

Archive products.

Set prices.

Configure product variations.

Set discounts where applicable.

Set seller vouchers where applicable.

Monitor stock levels.

Out-of-stock or unavailable variants shall not be purchasable.

7.3 Order Notifications

Seller shall be able to:

See new orders.

Review order details.

Receive an important-order notification.

7.4 Order Processing

Seller shall be able to process/approve an order and prepare it for fulfillment.

Core flow:

Customer places the Order → Seller processes and packs → Seller selects an eligible Logistics organization and confirms `ready_for_pickup` → selected Logistics organization creates the first-mile task.

Seller order processing does not assign a Courier; the later pickup-request transaction creates the shared waybill.

7.5 Prepare Order, Select Logistics, and Create Waybill

Seller shall pack each parcel, select an eligible Logistics organization, request pickup, and print the resulting shared waybill needed for first-mile pickup.

The shared-waybill identifier and QR must resolve the immutable Order/Parcel reference. Its server-owned snapshot uses the Shop pickup address and destination copied from Customer checkout; Seller cannot rewrite those facts.

The Seller's pickup transaction creates one immutable waybill snapshot per Order as `ready_for_pickup` is confirmed. Reprints reuse the same identity and snapshot.

The selected Logistics organization views and scans the same Seller-created waybill; it does not create a second hub waybill at `received_at_hub`.

7.6 Delivery Confirmation

Seller shall receive notification when the Buyer has received the order.

7.7 Seller Reporting

Seller shall have a basic report containing:

Sales.

Financial/profit information.

Performance totals.

From/to date filtering.

Advanced analytics and large exports are not required for P0 MVP.

7.8 Review Management

Seller shall be able to read and reply to reviews/ratings on Seller products.

7.9 Seller Account

Seller shall be able to update basic account information.

8. Logistics MVP Requirements

### Logistics organization and hub scope

The MVP uses one operational hub/sorting center per Logistics organization. The single-hub rule is intentional for project scale and does not claim that real-world Logistics companies are limited to one hub. Logistics features must not expose creation or selection of sub-hubs or additional hubs.

8.1 Logistics Dashboard

Logistics shall be able to view Seller-confirmed orders that are ready to enter logistics processing.

8.2 Subscription

Subscription billing, provider integration, subscription records, and subscription enforcement are deferred from the MVP. Admin approval and an active Logistics account are sufficient for currently approved Logistics access; subscription must not gate the current authentication/dashboard foundation or future operations until a separate Subscription policy is approved.

The previously described base subscription and ₱10 per-order charge remain future business rules and are not implemented by this workflow.

8.3 Door-to-Door Seller Pickup

A first-mile Courier shall pick up prepared parcels from Sellers as part of the first-party logistics flow.

After the Seller confirms `ready_for_pickup`, the selected Logistics organization creates at most one active first-mile task when none exists and offers or assigns it to an eligible Courier. Retried requests must return the existing task rather than create a duplicate. The Seller does not select the Courier.

The system shall connect the `seller_pickup_assigned`, `seller_pickup_accepted`, and `picked_up_from_seller` task states to the corresponding Order/Parcel.

If the offered Courier rejects the task, the task records `rejected`, the Order remains unchanged, and Logistics may offer the same task to another eligible Courier. An unfinished task may be shown as informationally `stale`; it is not automatically cancelled or reassigned in the MVP.

8.4 Waybill

Logistics shall be able to view, download, print, and scan the shared waybill created by the Seller pickup transaction.

The Seller-created shared waybill shall include a stable, system-generated, scannable or enterable identifier such as:

QR code, and/or

Reference number.

The shared waybill identifier, snapshot, selected Logistics organization, and Order/Parcel link are immutable from the Seller pickup-request transaction at `ready_for_pickup`. Routing and Courier assignments may change before physical handoff only through append-only events; after pickup, assignment and custody history cannot be overwritten. A Courier may submit a waybill QR/reference scan or handoff evidence through its assigned task; Logistics validates and records the authoritative event while preserving the performing Courier, recording Logistics account, and timestamp. Printing, reprinting, access, or scan submission does not independently advance an Order status.

8.5 Receiving and Sorting

The logistics workflow shall support:

receive order → waybill → sort

The system shall persist the parcel's current Shipment/Delivery Task state, including `received_at_hub` and `sorted_at_hub`, through the shared transition service after Logistics validates the supporting scan/evidence. The event must retain the Courier who performed a handoff when applicable and the Logistics account that recorded it.

8.6 Transfer

Logistics shall be able to move a parcel through transfer by:

Scanning its waybill identifier, or

Manually entering its QR/reference value.

A successful operation shall submit an event to the shared transition service, which validates the current Shipment/Delivery Task state and commits the associated detailed state and any permitted high-level Order projection. Scanning or manual entry alone is not an authoritative state change.

Internal transfer execution is deferred in the one-hub MVP. The operational path requires receipt, sorting, and dispatch without an `in_transfer` event; no inter-hub movement is authorized.

8.7 Dispatch

Logistics shall be able to dispatch a parcel by:

Scanning its waybill identifier, or

Manually entering its QR/reference value.

A successful dispatch shall submit an event to the shared transition service, which validates and commits `dispatched_from_hub` and any permitted high-level Order projection. Scanning or manual entry alone is not an authoritative state change.

The canonical dispatched state is `dispatched_from_hub`; it must not be confused with Courier acceptance or physical pickup.

8.8 Deploy Rider

Logistics shall be able to create/offer the first-mile task after `ready_for_pickup` and select an eligible Courier for the first-mile or final-mile task based on operational suitability and distance. A Courier rejection records task-level `rejected` without changing the Order; Logistics may re-offer the same task to another eligible Courier. An unfinished task may be informationally `stale` and is not automatically cancelled or reassigned in the MVP.

Successful first-mile assignment records `seller_pickup_assigned`. Successful final-mile assignment records `delivery_assigned`; both are distinct from `delivery_accepted` and `picked_up_from_hub`.

Route and distance assistance must use a separately approved provider-neutral Logistics/map contract. Authorized Courier projections may include `distance_km` and `estimated_duration_minutes`; these are advisory values, not client authority over assignment or status. The Customer address flow's PSGC, Geoapify, and Leaflet responsibilities must not be replaced by a routing provider, and no Mapbox dependency is used for address or map rendering.

The P0 MVP may use route-assisted/manual rider selection rather than a fully autonomous optimization engine.

8.9 Update Status

Logistics shall be able to update an allowed Shipment/Delivery Task state after validating a Courier-submitted scan/evidence or an operational recovery action. Logistics is the authoritative recorder of the event; the record preserves the Courier who performed the physical action, when applicable.

Scanning should request the applicable transition where possible, but the shared transition service—not the scan or access event itself—owns the state update.

Manual status update shall remain available as an operational fallback.

8.10 Courier Availability and Capacity

Courier availability shall use a flexible online/available model rather than fixed shift scheduling.

Logistics shall be able to see:

Online/available riders.

Pending order demand.

Basic active courier capacity.

8.11 Logistics Account

Logistics shall be able to update basic account information.

9. Courier MVP Requirements

9.1 Courier Registration

Courier registration shall follow:

search/select Logistics company → automatically associate its sole hub → register under logistics → logistics approval → sign in

Courier screens are delivered by the external mobile/Flutter application; this repository provides only the Laravel API consumed by that client.

9.2 Courier Dashboard

Courier shall be able to:

View delivery notifications.

View first-mile pickup and final-mile delivery requests created or offered by Logistics.

View active delivery jobs.

View the operational Order, parcel, waybill, pickup, destination, item, and delivery-instruction data required for an offered or accepted task, plus server-provided provider-neutral `distance_km` and `estimated_duration_minutes`. Secrets, private evidence, raw storage paths, and unrelated personal data remain excluded.

9.3 Accept Delivery Request

Courier shall be able to:

Review the task type and pickup details.

Review delivery details.

Accept an eligible request.

Reject an offered request. Rejection records task-level `rejected`, leaves the Order unchanged, and allows Logistics to offer the same task to another eligible Courier.

Acceptance shall associate the task with the Courier.

Courier acceptance does not grant assignment authority. Logistics remains responsible for creating and assigning/offering tasks.

An unfinished task may become informationally `stale`; it is not automatically cancelled or reassigned in the MVP.

9.4 Pick Up Order

Courier shall be able to:

Proceed to the Seller for a first-mile pickup or the Logistics hub for a final-mile pickup.

Verify order/parcel information.

Scan the parcel/order waybill QR/reference identifier and submit the scan/evidence to Logistics for validation and authoritative recording.

Confirm pickup.

Pickup confirmation shall update the Shipment/Delivery Task to `picked_up_from_seller` or `picked_up_from_hub`, depending on the task leg.

9.5 Deliver Order

Courier shall be able to:

View destination information.

Access route/navigation context, including server-provided provider-neutral distance and estimated duration when available. These values are advisory and do not authorize assignment or status changes.

Deliver the parcel to the Buyer.

9.6 Complete Delivery

Courier shall be able to mark a delivery complete.

Completion shall update the Order to `delivered` and notify the Buyer and Seller.

9.7 Proof of Delivery

The MVP shall include a basic proof-of-delivery mechanism.

Supported source options include:

Photo.

E-signature.

QR scan.

For P0, at least one method must be implemented. QR/parcel verification plus delivery confirmation is sufficient for the core workflow; photo proof is recommended if implementation capacity permits. Courier-submitted QR/reference scans and evidence are validated and recorded authoritatively by Logistics, preserving both the performing Courier and recording Logistics account. Image/signature evidence remains subject to the shared upload policy and the approved operational schema.

9.8 Delivery History

Courier shall be able to view completed delivery requests.

9.9 Profit / Earnings

Courier shall be able to view basic earnings/profit derived from completed deliveries.

9.10 Courier Account

Courier shall be able to update basic account information.

10. Admin MVP Requirements

10.1 Dashboard

Admin shall have a platform overview with important notifications and pending actionable items.

10.2 Manage Account Registrations

Admin shall be able to:

View pending Buyer registrations.

View pending Seller registrations.

View pending Logistics registrations.

Approve an account.

Reject an account.

Approval/rejection shall update account status and trigger the corresponding email notification.

Courier approval belongs to the associated Logistics company.

10.3 Manage User Accounts

Admin shall be able to:

Search users.

View user profiles.

Update account status.

Suspend/deactivate an account.

Restore an eligible account.

10.4 Seller Compliance

Admin shall be able to:

Review Seller/product compliance.

Issue warnings.

Suspend violating Sellers.

Hide/remove violating products.

10.5 Complaints and Disputes

Admin shall be able to:

View complaints/reports.

Review relevant supporting evidence.

Record an administrative action or resolution.

10.6 Reports Overview

Admin shall be able to view basic commission reporting with date-based filtering.

The report shall account for the platform's defined Logistics per-order fee and other implemented platform commissions.

10.7 Platform-Wide Vouchers

As defined in `docs/requirements.md`, Admin owns platform-wide voucher management applicable at Customer checkout.

10.8 Platform Settings

Admin shall be able to:

Post announcements.

Add/update platform policies.

10.9 Customer Service / Messaging

Admin shall have a communication mechanism for user support.

10.10 Admin Account Management

Admin shall be able to update own account information.

The initial Admin shall be created from environment configuration.

Additional Admins may be created with custom permissions.

10.11 Audit Logs

The system shall log important administrative actions, including:

Actor.

Action.

Target/resource.

Timestamp.

11. Order and Logistics Workflow

11.1 Core Order Flow

Buyer places order
↓
Seller begins processing and prepares the order
↓
Seller selects an eligible Logistics organization, requests pickup, creates each waybill, and confirms `ready_for_pickup`
↓
First-mile Courier accepts the Seller pickup task
↓
Courier picks up the parcel from the Seller (`picked_up_from_seller`)
↓
Courier transfers the parcel to the Logistics organization's sole hub
↓
Logistics receives and validates the parcel (`received_at_hub`)
↓
Logistics resolves the Seller-created shared waybill through its immutable Order/Parcel reference
↓
Logistics sorts the parcel (`sorted_at_hub`)
↓
Logistics dispatches the sorted parcel (`dispatched_from_hub`)
↓
Logistics assigns a final-mile Courier (`delivery_assigned`)
↓
Final-mile Courier accepts the task (`delivery_accepted`)
↓
Courier picks the parcel up from the hub (`picked_up_from_hub`)
↓
Courier transports and delivers the parcel (`in_transit` → `out_for_delivery`)
↓
Courier submits completion intent/proof; Logistics validates and the shared service commits `delivered`
↓
Buyer may rate/review

All Logistics processing in this MVP is performed within the owning Logistics organization's single hub/sorting center. There is no alternate sub-hub or multi-hub branch in this flow.

If a Courier rejects an offered first-mile or final-mile task, the task records `rejected`, the Order remains unchanged, and Logistics may offer the same task to another eligible Courier. An unfinished task is informationally `stale` only; no automatic cancellation or reassignment occurs in the MVP. First-mile and final-mile assignments remain independent.

Each future Delivery Task represents exactly one Order/Parcel for one leg. A pickup schedule may group Orders operationally, but it does not merge their tasks, waybills, snapshots, or histories.

11.2 Canonical Order and Shipment State Model

Use lowercase `snake_case` for persisted and API values, PascalCase for PHP enum cases, and human-readable labels only in the UI. Do not persist source-only uppercase labels such as `READY_FOR_PICKUP` or `AT_SORTING_CENTER`.

`OrderStatus` is the current high-level Order lifecycle and remains the Customer-facing source of truth:

```text
pending_payment
→ placed
→ seller_processing
→ ready_for_pickup
→ picked_up
→ in_transit
→ out_for_delivery
→ delivered
```

Current COD placement skips `pending_payment`: it creates `placed` with `payment_status = pending` and reserves inventory. `pending_payment` remains a future online-payment state.

The current Courier first-mile confirmation projects `ready_for_pickup → picked_up` while recording `picked_up_from_seller` as the authoritative detailed handoff. `assigned` remains reserved for the later Logistics/final-mile assignment contract. Customer labels map `placed`, `seller_processing`, and `ready_for_pickup` to **To Prepare**; `assigned`, `picked_up`, and `in_transit` to **To Ship**; `out_for_delivery` to **Out for Delivery**; and `delivered` to **Completed**.

The deferred `ShipmentStatus` / Delivery Task vocabulary should use explicit physical states:

```text
awaiting_seller_pickup
seller_pickup_assigned
seller_pickup_accepted
picked_up_from_seller
received_at_hub
sorted_at_hub
dispatched_from_hub
delivery_assigned
delivery_accepted
picked_up_from_hub
in_transit
out_for_delivery
delivered
```

Task-level `rejected` records an offered Courier's refusal and is not an `OrderStatus`. `stale` is an informational freshness condition for an unfinished task, derived or persisted only by the future task contract; it is not a new high-level Order status and does not automatically cancel or reassign work.

New physical Shipment/Parcel/Scan/custody, final-mile Delivery Task/assignment, and proof-of-delivery writes must not begin until this flow is reconciled with `docs/schema.md`, the affected domain documents, and feature specifications, and the complete shared operational schema has been approved and migrated additively. Existing Seller pickup requests, shared waybills, pickup schedules, first-mile assignment/acceptance, explicit pickup confirmation, and route manifests remain the implemented foundation. Detailed physical states must not be added to `orders.status` by an individual feature.

Waybill creation, scan, and reprint are document or event operations; they do not independently advance the OrderStatus. A Courier submits a QR/reference scan or handoff evidence, and Logistics validates and records the authoritative event, preserving the performing Courier, recording Logistics account, and timestamp. The shared transition service—not the scan/access event—commits physical state. The pickup transaction creates one immutable shared waybill snapshot per Order at `ready_for_pickup`. Routing and Courier assignments may change before physical handoff only through append-only events. `cancelled`, `rejected`, `delivery_failed`, `return_requested`, and `returned` remain exceptional Order outcomes and require their own transition rules; task-level `rejected` is distinct from Order-level `rejected`.

Inventory reservations follow the same boundary: placement reserves the requested SKU quantity; an accepted cancellation or rejection before `picked_up_from_seller` releases that quantity once and transactionally; first-mile pickup commits it once. Post-pickup cancellation, delivery failure, returns, refunds, and partial fulfillment remain deferred until their policies and line-level records are approved.

### Accepted future transition ownership

These transitions describe the target operational contract. Today's first-mile task enum uses `assigned`, `accepted`, and `picked_up_from_seller`; future names below do not rename those stored values.

| Transition | Authority and precondition | Availability |
| --- | --- | --- |
| `awaiting_seller_pickup → seller_pickup_assigned` | Owning Logistics offers a task after readiness and provider/hub checks | Existing scheduling implements the first-mile foundation; shared task migration pending |
| `seller_pickup_assigned → seller_pickup_accepted` | Affiliated Courier accepts its own offer | Existing acceptance foundation; shared task migration pending |
| Offered task → `rejected` → new offer | Courier rejects; Logistics re-offers the same task to another eligible Courier; Order unchanged | Contract defined below; endpoint implementation deferred |
| `seller_pickup_accepted → picked_up_from_seller` | Target: Logistics validates Courier evidence before committing handoff/Inventory once | Direct Courier confirmation implemented; validation migration pending |
| `picked_up_from_seller → received_at_hub` | Owning Logistics validates sole-hub receipt | Deferred |
| `received_at_hub → sorted_at_hub → dispatched_from_hub` | Owning Logistics records receipt, sorting, and dispatch at its sole hub | Contract defined; internal transfer execution deferred |
| `dispatched_from_hub → delivery_assigned → delivery_accepted` | Logistics offers an independent final-mile task; affiliated Courier accepts | Deferred |
| `delivery_accepted → picked_up_from_hub` | Logistics validates Courier hub-handoff evidence | Deferred |
| `picked_up_from_hub → in_transit → out_for_delivery` | Courier performs movement through the approved transition contract | Deferred |
| `out_for_delivery → delivered` | Courier supplies proof; Logistics validates; server commits delivery | Deferred |

Each future transition requires tenant/role checks, locked current state, immutable events, idempotent result replay, and a conflict on incompatible concurrent changes. Notifications follow commit. Owning endpoint specs must supply exact request/response/evidence and transaction effects before implementation. Returns, refunds, partial fulfillment, and post-pickup cancellation remain deferred; unfinished tasks may be informationally stale without automatic reassignment.

### MVP re-offer, expiry, and internal transfer rules

- A Courier rejects only its currently offered, unaccepted assignment. Record rejection reason, actor, and UTC timestamp; leave the Order, Shipment custody, reservation, and physical milestones unchanged.
- Logistics re-offers the same task by appending a new offer for another eligible affiliated Courier. The task returns to `seller_pickup_assigned` for first mile or `delivery_assigned` for final mile; the rejected offer remains immutable.
- Lock the task and current offer together. Acceptance/rejection/re-offer races allow only one compatible commit; conflicting requests receive `409`. Matching retries return the original committed result.
- Automatic offer expiry and timed reassignment are deferred. MVP offers have no expiry deadline; unfinished tasks are not automatically cancelled or reassigned. A stale indicator is advisory and cannot authorize mutations.
- `in_transfer` execution is deferred in the one-hub MVP. Use `received_at_hub → sorted_at_hub → dispatched_from_hub`; dispatch requires a recorded sorting event. Do not create a dummy transfer event or an additional hub. The reserved `in_transfer` name is unavailable until a separately approved internal-transfer feature exists.

11.3 Status History

Every important Order or Shipment/Delivery Task transition should record:

Previous status.

New status.

Actor.

Timestamp.

Optional waybill/scan reference.

For physical events, the Courier who performed the action (when applicable), the Logistics account that validated/recorded it, the evidence reference or QR/reference value, timestamp, and location/context required by the transition.

Order history records customer-visible high-level `OrderStatus` changes. Shipment/Delivery Task history records first-mile, hub, and final-mile states such as `picked_up_from_seller`, `received_at_hub`, `delivery_assigned`, and `picked_up_from_hub`, plus task-level `rejected` or informational `stale` where supported. A scan, waybill print, or notification must not silently overwrite either history; each accepted event appends immutable history.

12. Waybill and Scanning Requirements

Waybill processing is a core operational capability.

The MVP shall support:

Generation/display of a system-owned Order/Parcel reference.

Seller and selected-Logistics printing of the same shared waybill.

QR/barcode scanning where supported by the client device.

Manual reference entry as a fallback.

Validation that the parcel exists.

Validation that the requested transition is allowed.

Submitting and recording the scan/transfer/dispatch event after Logistics validation, with performing-Courier and recording-Logistics actors preserved where applicable.

Updating the detailed Shipment/Delivery Task state and any permitted high-level Order projection through the shared transition service.

Preventing duplicate or invalid transitions.

The implemented first-mile confirmation resolves a QR/manual reference, requires explicit Courier confirmation, records `picked_up_from_seller`, projects the Order to `picked_up`, and fulfills Inventory once. Future Logistics-validated scan/evidence processing will replace that direct confirmation boundary only through an explicit API migration; existing confirmations and inventory effects must be preserved without replay. Hub receipt/sort/transfer/dispatch and final-mile hub pickup remain unavailable until their operational schema and endpoints exist.

Do not infer either physical pickup from the generic high-level Order value `picked_up`; the detailed task/scan event is authoritative for the handoff.

13. Fees and Commission Rules

13.1 Logistics SaaS

Subscription billing, the base subscription, and the ₱10 per-order Logistics SaaS charge are deferred. No subscription provider, subscription record, active-status check, or operational gate is part of the current MVP workflow. Revisit this section through a separate approved Subscription feature before charging or restricting Logistics operations.

13.2 Shipping Fee

Default shipping fee:

₱50

The source identifies this as the component where Logistics receives its commission.

The MVP may use these as default values. Future configurability is recommended but is not required to prove the workflow.

14. Notifications

Brevo is the specified email provider.

P0 transactional notification events shall include:

Account approved.

Account rejected.

New Seller order.

Important Seller order-status changes.

Parcel pickup/status changes where operationally necessary.

Out for delivery.

Delivery completed.

Seller delivery confirmation.

Relevant Admin/compliance/support notifications.

Real-time notification transport is not mandated by the source. Polling is acceptable for MVP dashboards if real-time infrastructure is not yet required.

15. Messaging

Role documents include communication capabilities for Admin, Buyer, Seller, Logistics, and Courier.

For the MVP, messaging may be implemented as a basic persisted conversation/thread system supporting operational communication.

Primary useful relationships include:

Buyer ↔ Seller.

Courier ↔ Buyer for delivery clarification.

Courier ↔ Logistics.

Seller ↔ Logistics.

Admin ↔ users.

Advanced chat functionality such as real-time typing indicators or complex media messaging is not required for P0.

**Current/future boundary:** `ConfirmFirstMilePickup` currently validates the accepted Courier task and commits Seller pickup, Order `picked_up`, and Inventory fulfillment without a separate Logistics review. The accepted target requires Courier evidence submission followed by Logistics validation and a server-owned transition. That target is not implemented. Its rollout must explicitly migrate the current confirmation contract, preserve existing confirmations and stock movements, and never replay pickup or fulfill stock twice.
