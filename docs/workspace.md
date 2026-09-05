# Workflows

Defines **HOW** the system behaves: step-by-step flows and state transitions per role.

# Authentication and Account Rules

## Shared Users Table

All roles live in the same logical users table.

Email addresses may be reused across different roles but not within the same role.

Required uniqueness rule:

unique(email, role)

5.2 Registration and Approval Flow

Buyer

register → admin approval → email notification → sign in

Seller

register → admin approval → email notification → sign in

Logistics

register → admin approval → email notification → sign in → subscription

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
- Courier registration selects the Logistics company; its sole hub is associated automatically. A separate hub/sub-hub selector is not needed.
- Parcels, waybills, sorting, transfer, dispatch, Couriers, fleet records, zones, and capacity views are scoped to that Logistics organization's single hub.
- The transfer step does not represent movement between multiple hubs owned by the same Logistics organization. Any future multi-hub or inter-organization handoff requires a separate approved workflow.
- This cardinality rule does not by itself decide whether the Logistics organization may have multiple staff or dispatcher accounts; that is a separate account/authorization decision.
  - Supersede: The logistics should have one account.
  - Note: Sub account for staffs will be handled on a later date.

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

Select a mode of payment.

Review final order details.

Place the order.

The system must protect inventory from overselling when an order is finalized.

MVP decision required: the source specifies payment-method selection but does not name a payment gateway/provider.

6.5 Address Book

Buyer shall be able to save and manage multiple shipping and billing addresses.

The address experience shall support the specified Maps JavaScript Places integration for address completion.

6.6 Order Status

Buyer shall be able to view the lifecycle of an order through a server-owned status mapper. Persisted/API values use lowercase `snake_case`; display labels are separate from machine values.

The current high-level `OrderStatus` values are:

`pending_payment` → `placed` → `seller_processing` → `ready_for_pickup` → `assigned` → `picked_up` → `in_transit` → `out_for_delivery` → `delivered`.

The exceptional values are `cancelled`, `rejected`, `delivery_failed`, `return_requested`, and `returned`.

`assigned` means Logistics has received and accepted the Seller-ready parcel. It does not mean that a final-mile Courier has merely been proposed. `picked_up` represents the final-mile Courier taking the parcel from the Logistics hub. Detailed first-mile, hub, and assignment milestones belong to the Shipment/Delivery Task state described in section 11.2.

Only the owning domain may advance a status, and every transition must be validated and recorded in status history. A Customer can read these states but cannot mutate them.

6.7 Order Modification and Cancellation

Buyer shall be able to cancel or change eligible order details only before the Seller processes the order.

The MVP shall at minimum enforce this using canonical order status, allowing changes only while the Order remains `placed` and before Seller processing begins.

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

Buyer order → Seller approved → Seller packed → Logistics flow

7.5 Prepare Order and Waybill

Seller shall be able to print or access the waybill/shipping details needed for pickup.

The parcel must have a reference that Logistics can scan or manually enter.

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

After Admin approval and sign-in, a Logistics company enters the platform subscription flow.

Business model:

Base subscription.

₱10 platform charge per order.

MVP decision required: subscription billing/payment provider is not specified in the source.

8.3 Door-to-Door Seller Pickup

A first-mile Courier shall pick up prepared parcels from Sellers as part of the first-party logistics flow.

The system shall connect the `seller_pickup_assigned`, `seller_pickup_accepted`, and `picked_up_from_seller` task states to the corresponding Order/parcel.

8.4 Waybill

Logistics shall be able to print order details as a waybill.

The waybill shall include a scannable or enterable identifier such as:

QR code, and/or

Reference number.

8.5 Receiving and Sorting

The logistics workflow shall support:

receive order → waybill → sort

The system shall persist the parcel's current Shipment/Delivery Task state, including `received_at_hub` and `sorted_at_hub`.

8.6 Transfer

Logistics shall be able to move a parcel through transfer by:

Scanning its waybill identifier, or

Manually entering its QR/reference value.

A successful operation shall update the associated order/shipment status.

For the MVP, transfer does not mean movement between multiple hubs. It represents a controlled Logistics handoff or movement within the sole operational hub workflow and must use an explicit state such as `in_transfer`.

8.7 Dispatch

Logistics shall be able to dispatch a parcel by:

Scanning its waybill identifier, or

Manually entering its QR/reference value.

A successful dispatch shall update the associated order/shipment status.

The canonical dispatched state is `dispatched_from_hub`; it must not be confused with Courier acceptance or physical pickup.

8.8 Deploy Rider

Logistics shall be able to select a rider for an order based on operational suitability and distance.

Successful final-mile assignment records `delivery_assigned`; it is distinct from `delivery_accepted` and `picked_up_from_hub`.

Mapbox Matrix and Optimization are the specified APIs for route/distance optimization.

The P0 MVP may use route-assisted/manual rider selection rather than a fully autonomous optimization engine.

8.9 Update Status

Logistics shall be able to update an allowed Shipment/Delivery Task state after a validated scan or operational recovery action.

Scanning should automate state updates where possible.

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

9.2 Courier Dashboard

Courier shall be able to:

View delivery notifications.

View available first-mile pickup and final-mile delivery requests.

View active delivery jobs.

9.3 Accept Delivery Request

Courier shall be able to:

Review the task type and pickup details.

Review delivery details.

Accept an eligible request.

Acceptance shall associate the task with the Courier.

9.4 Pick Up Order

Courier shall be able to:

Proceed to the Seller for a first-mile pickup or the Logistics hub for a final-mile pickup.

Verify order/parcel information.

Scan the parcel/order identifier.

Confirm pickup.

Pickup confirmation shall update the Shipment/Delivery Task to `picked_up_from_seller` or `picked_up_from_hub`, depending on the task leg.

9.5 Deliver Order

Courier shall be able to:

View destination information.

Access route/navigation context.

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

For P0, at least one method must be implemented. QR/parcel verification plus delivery confirmation is sufficient for the core workflow; photo proof is recommended if implementation capacity permits.

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

Because app.md identifies platform-wide voucher creation as an Admin responsibility, Admin shall be able to create and manage vouchers applicable at Buyer checkout.

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
Seller confirms `ready_for_pickup`
↓
First-mile Courier accepts the Seller pickup task
↓
Courier picks up the parcel from the Seller (`picked_up_from_seller`)
↓
Courier transfers the parcel to the Logistics organization's sole hub
↓
Logistics receives and validates the parcel (`received_at_hub`)
↓
Logistics identifies or generates the canonical waybill/reference
↓
Logistics sorts the parcel (`sorted_at_hub`)
↓
Logistics transfers and dispatches the parcel (`in_transfer` → `dispatched_from_hub`)
↓
Logistics assigns a final-mile Courier (`delivery_assigned`)
↓
Final-mile Courier accepts the task (`delivery_accepted`)
↓
Courier picks the parcel up from the hub (`picked_up_from_hub`)
↓
Courier transports and delivers the parcel (`in_transit` → `out_for_delivery`)
↓
Courier submits proof of delivery and completes the task (`delivered`)
↓
Buyer may rate/review

All Logistics processing in this MVP is performed within the owning Logistics organization's single hub/sorting center. There is no alternate sub-hub or multi-hub branch in this flow.

11.2 Canonical Order and Shipment State Model

Use lowercase `snake_case` for persisted and API values, PascalCase for PHP enum cases, and human-readable labels only in the UI. Do not persist source-only uppercase labels such as `READY_FOR_PICKUP` or `AT_SORTING_CENTER`.

`OrderStatus` is the current high-level Order lifecycle and remains the Customer-facing source of truth:

```text
pending_payment
→ placed
→ seller_processing
→ ready_for_pickup
→ assigned
→ picked_up
→ in_transit
→ out_for_delivery
→ delivered
```

The existing `assigned` value means `received_at_hub` at the Logistics boundary, while the existing `picked_up` value means `picked_up_from_hub` for the final-mile movement. This preserves the current OrderStatus contract while making the physical handoffs explicit in the shipment/task record and timeline.

The deferred `ShipmentStatus` / Delivery Task vocabulary should use explicit physical states:

```text
awaiting_seller_pickup
seller_pickup_assigned
seller_pickup_accepted
picked_up_from_seller
received_at_hub
sorted_at_hub
in_transfer
dispatched_from_hub
delivery_assigned
delivery_accepted
picked_up_from_hub
in_transit
out_for_delivery
delivered
```

Waybill creation, scan, and reprint are document or event operations; they do not independently advance the OrderStatus. `cancelled`, `rejected`, `delivery_failed`, `return_requested`, and `returned` remain exceptional Order outcomes and require their own transition rules.

11.3 Status History

Every important Order or Shipment/Delivery Task transition should record:

Previous status.

New status.

Actor.

Timestamp.

Optional waybill/scan reference.

Order history records customer-visible high-level `OrderStatus` changes. Shipment/Delivery Task history records first-mile, hub, and final-mile states such as `picked_up_from_seller`, `received_at_hub`, `delivery_assigned`, and `picked_up_from_hub`. A scan, waybill print, or notification must not silently overwrite either history.

12. Waybill and Scanning Requirements

Waybill processing is a core operational capability.

The MVP shall support:

Generation/display of a parcel reference.

Printing of waybill/order details.

QR/barcode scanning where supported by the client device.

Manual reference entry as a fallback.

Validation that the parcel exists.

Validation that the requested transition is allowed.

Recording the scan/transfer/dispatch event.

Updating the shipment/order status.

Preventing duplicate or invalid transitions.

Scanning or manual reference entry should automate the applicable Shipment/Delivery Task transition: first-mile pickup records `picked_up_from_seller`, hub receipt/sort/transfer/dispatch use `received_at_hub`, `sorted_at_hub`, `in_transfer`, and `dispatched_from_hub`, and final-mile hub pickup records `picked_up_from_hub`.

Do not infer either physical pickup from the generic high-level Order value `picked_up`; the detailed task/scan event is authoritative for the handoff.

13. Fees and Commission Rules

13.1 Logistics SaaS

The source defines:

Base subscription + ₱10 per order

The platform shall track the ₱10 per-order Logistics SaaS charge.

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
