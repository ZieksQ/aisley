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

search logistics hub → register under logistics → logistics approval → sign in

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

Buyer shall be able to view the lifecycle of an order, including user-facing states corresponding to:

Pending / placed.

Seller processing.

Packed / ready for pickup.

Picked up.

In logistics processing.

In transfer.

Dispatched.

Out for delivery.

Delivered.

Cancelled, when applicable.

Ready for rating/feedback after delivery.

Internal enum names may differ, but status transitions must follow the controlled order/logistics workflow.

6.7 Order Modification and Cancellation

Buyer shall be able to cancel or change eligible order details only before the Seller processes the order.

The MVP shall at minimum enforce this using order status, such as allowing changes only while the order is still PENDING.

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

8.1 Logistics Dashboard

Logistics shall be able to view Seller-confirmed orders that are ready to enter logistics processing.

8.2 Subscription

After Admin approval and sign-in, a Logistics company enters the platform subscription flow.

Business model:

Base subscription.

₱10 platform charge per order.

MVP decision required: subscription billing/payment provider is not specified in the source.

8.3 Door-to-Door Seller Pickup

A Courier shall pick up orders from Sellers as part of the first-party logistics flow.

The system shall connect pickup tasks to the corresponding order/parcel.

8.4 Waybill

Logistics shall be able to print order details as a waybill.

The waybill shall include a scannable or enterable identifier such as:

QR code, and/or

Reference number.

8.5 Receiving and Sorting

The logistics workflow shall support:

receive order → waybill → sort

The system shall persist the parcel's current logistics state.

8.6 Transfer

Logistics shall be able to move a parcel through transfer by:

Scanning its waybill identifier, or

Manually entering its QR/reference value.

A successful operation shall update the associated order/shipment status.

8.7 Dispatch

Logistics shall be able to dispatch a parcel by:

Scanning its waybill identifier, or

Manually entering its QR/reference value.

A successful dispatch shall update the associated order/shipment status.

8.8 Deploy Rider

Logistics shall be able to select a rider for an order based on operational suitability and distance.

Mapbox Matrix and Optimization are the specified APIs for route/distance optimization.

The P0 MVP may use route-assisted/manual rider selection rather than a fully autonomous optimization engine.

8.9 Update Status

Logistics shall be able to update an order/shipment status after rider pickup.

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

search logistics hub → select logistics → register → logistics approval → sign in

9.2 Courier Dashboard

Courier shall be able to:

View delivery notifications.

View available pickup requests.

View active delivery jobs.

9.3 Accept Delivery Request

Courier shall be able to:

Review pickup details.

Review delivery details.

Accept an eligible request.

Acceptance shall associate the task with the Courier.

9.4 Pick Up Order

Courier shall be able to:

Proceed to the Seller or sorting center.

Verify order/parcel information.

Scan the parcel/order identifier.

Confirm pickup.

Pickup confirmation shall update the shipment/order state.

9.5 Deliver Order

Courier shall be able to:

View destination information.

Access route/navigation context.

Deliver the parcel to the Buyer.

9.6 Complete Delivery

Courier shall be able to mark a delivery complete.

Completion shall update the order to DELIVERED and notify the Buyer and Seller.

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
Seller approves/processes order
        ↓
Seller packs order
        ↓
Courier door-to-door pickup from Seller
        ↓
Logistics receives parcel
        ↓
Waybill identified/generated
        ↓
Parcel sorted
        ↓
Transfer by waybill scan/manual reference
        ↓
Dispatch by waybill scan/manual reference
        ↓
Logistics assigns Courier for final delivery
        ↓
Courier picks parcel up for delivery
        ↓
Courier delivers to Buyer
        ↓
Order marked delivered
        ↓
Buyer may rate/review

11.2 Recommended MVP State Model

The source does not define exact enum names. The implementation should therefore use a controlled state machine equivalent to:

PENDING
SELLER_CONFIRMED
PACKED
READY_FOR_PICKUP
PICKED_UP
AT_LOGISTICS
SORTED
IN_TRANSFER
DISPATCHED
OUT_FOR_DELIVERY
DELIVERED
CANCELLED

This list is an implementation normalization of the source workflow, not a verbatim source enum.

11.3 Status History

Every important transition should record:

Previous status.

New status.

Actor.

Timestamp.

Optional waybill/scan reference.

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

Scanning or manual reference entry should automate status changes through transfer and dispatch.

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
