# Requirements
Defines **WHAT** the system must do.

## Product Overview
Aisley is a vertically integrated multi-vendor e-commerce marketplace. Independent sellers operate their own shops and inventory, buyers purchase products through the marketplace, and Aisley sits between participants while collecting platform fees.
Unlike a marketplace that depends on third-party logistics APIs, Aisley controls its own logistics infrastructure. The MVP must therefore support the marketplace transaction and first-party logistics lifecycle as one connected system.

The core MVP success path is:
Buyer discovers a product → selects an eligible Logistics organization offered for the Shop during checkout → places an order → Seller processes, packs, and marks it ready → the selected Logistics organization creates the first-mile task and assigns/offers it to an eligible Courier → that Courier picks it up from the Seller and transfers it to Logistics → Logistics receives, sorts, and dispatches it from its sole hub → Logistics assigns a final-mile Courier → that Courier picks it up from the hub and delivers it → Buyer receives and rates it.

## MVP Objectives

The MVP shall prove that Aisley can operate the complete marketplace and logistics flow with the following capabilities:

- Multi-role account registration and approval.
- Buyer product discovery, cart, checkout, and order tracking.
- Seller shop, product, inventory, and order fulfillment.
- Logistics parcel processing, waybill scanning, dispatch, and courier assignment.
- Courier pickup and final delivery through a mobile application.
- Admin oversight, approvals, user management, commission reporting, and support.
- Email notifications for important workflow events.
- Role-based authentication and authorization across web and mobile applications.
- Platform fee and shipping-fee tracking.

The Customer-selected Logistics organization is part of the Shop Order's downstream fulfillment context. The Seller may determine which providers are eligible for its Shop, but the Customer makes the checkout selection. The selected provider must not be silently replaced after placement.

# Roles

## Admin
Admin manages the overall platform flow.

MVP responsibilities:

- Approve or reject Buyer, Seller, and Logistics registrations.
- View and update user account status.
- Monitor seller/product compliance.
- Review complaints and disputes.
- View platform commission reports.
- Create platform-wide vouchers.
- Post announcements and maintain platform policies.
- Communicate with users.
- Manage own account.
- View audit logs for important administrative actions.
- Create additional admins with custom permissions.

## Buyer / Customer
Buyer is the core marketplace user.

MVP responsibilities:

- Browse products as a guest.
- Register and sign in after approval.
- Search products.
- View product details.
- Select quantity and product variations.
- Add products to cart or buy immediately.
- Apply vouchers/discounts.
- Use the current COD payment flow; future online payment methods require a separate payment contract.
- Select one eligible Logistics organization offered for each Shop Order.
- Manage shipping/billing addresses.
- Use the bundled PSGC Region → Province → City/Municipality → Barangay address data with manual fields; optional Geoapify suggestions/coordinates and a Leaflet pin assist when the Customer chooses **Pin location**. Mapbox is not used.
- Place orders.
- Track order status.
- Cancel or modify eligible orders before seller processing.
- Rate and review delivered products.
- Browse seller shops and categories.
- Manage account information.

## Seller
Each Seller account owns exactly one shop.

MVP responsibilities:

- Register with all required personal, business, address, ID, and permit information and wait for Admin approval.
- Registration creates one pending Shop; Admin approval activates that existing Shop atomically with the Seller account and evidence. After approval, incomplete storefront fields may show `SHOP_SETUP_REQUIRED`; no second Shop is created.
- Manage shop/account information.
- Add, update, and archive products.
- Set prices, discounts, and seller vouchers where supported.
- Monitor stock levels.
- Receive and review new orders.
- Process and prepare orders.
- Create or print the package label/shipping details needed for first-mile pickup. The Seller does not create the Logistics operational waybill or assign a Courier.
- Receive notification after successful delivery.
- View basic sales/profit reports.
- Communicate with users.
- Read and reply to product reviews.

## Logistics
Logistics represents the company responsible for shipment operations.

MVP responsibilities:

- Register and wait for admin approval.
- Sign in after approval.
- Own exactly one operational hub/sorting center per Logistics organization for the MVP. Sub-hubs, additional hubs, and multi-hub operations are out of scope as a deliberate simplification of the real-world model.
- For the MVP, the Logistics registration address represents the address of the organization's sole operational hub/sorting center. The Logistics account operates this hub through the Logistics dashboard. No separate hub address or sub-hub address is collected.
- If an exact operational-hub pin is collected, use the same PSGC/manual/Geoapify/Leaflet flow as the Customer Address Book; manual/PSGC fields remain authoritative and Mapbox is not used.
- Subscription billing and enforcement are deferred from the MVP; an approved active Logistics account is not subscription-gated until a Subscription policy exists.
- View Seller-confirmed Orders whose selected Logistics organization is this organization.
- Create the first-mile pickup task after the Seller marks the Order `ready_for_pickup`, then offer or assign it to an eligible Courier.
- Receive parcels transferred from Sellers by a first-mile Courier.
- Create and print the operational waybill after the parcel is received at the sole hub, linked to the Seller package label through an immutable Order/Parcel reference.
- Sort parcels.
- Transfer parcels by scanning or entering waybill QR/reference numbers.
- Dispatch parcels by scanning or entering waybill QR/reference numbers.
- View available couriers.
- Assign a final-mile rider based on delivery requirements and distance.
- Update shipment/order status.
- Monitor courier availability and active capacity.
- Communicate with users.
- Manage logistics account information.

## Courier / Rider
Courier accounts are registered under a selected Logistics company and approved by Logistics.

MVP responsibilities:

- Search/select an eligible Logistics company during registration. Its single operational hub is associated automatically; selecting a sub-hub is not supported.
- Register under that Logistics account.
- Sign in after Logistics approval.
- Use the external mobile application to view delivery notifications and first-mile pickup/final-mile delivery requests created or offered by Logistics.
- Review pickup and delivery details.
- Accept an eligible pickup or delivery request.
- Navigate to the Seller for first-mile pickup or the Logistics hub for final-mile pickup.
- Verify parcel/order information.
- Scan the parcel/order identifier.
- Confirm `picked_up_from_seller` or `picked_up_from_hub`, depending on the task leg.
- Deliver the order to the buyer.
- Complete delivery.
- Submit basic proof of delivery.
- View delivery history.
- View basic earnings/profit.
- Communicate with relevant users.
- Manage courier account information.

## Shared order and fulfillment rules

- Persisted and API status values use lowercase `snake_case`; UI labels and legacy uppercase source labels are not database values. Keep the existing high-level `OrderStatus` values for compatibility and use explicit Shipment/Delivery Task milestones for physical handoffs.
- Successful COD checkout skips `pending_payment`, creates each Shop Order at `placed` with `payment_status = pending`, and reserves the requested SKU quantities atomically. An accepted cancellation or rejection before `picked_up_from_seller` releases only that Order's reservation once; first-mile pickup commits the reservation once. Post-pickup returns, refunds, delivery-failure restoration, and partial fulfillment require a separately approved policy.
- Seller-created package labels and Logistics-created operational waybills are separate linked artifacts. The Seller label identifies the Order/Parcel, package details, Shop pickup address, and immutable Customer destination snapshot. It may be revised until `ready_for_pickup`, then freezes. Logistics creates the operational waybill at `received_at_hub`; its identifier and Order/Parcel link are immutable, while pre-`picked_up_from_hub` route/assignment changes are append-only events.
- First-mile and final-mile assignments are independent. Once the Seller confirms `ready_for_pickup`, the selected Logistics organization creates at most one active first-mile task and offers/assigns it to an eligible Courier; retried creation must be idempotent. Logistics separately assigns/offers final-mile work after hub dispatch. A Courier accepts only an offered task and cannot assign itself or another Courier.
- Shipment, Parcel, Waybill, Scan, Delivery Task, assignment, and proof-of-delivery writes must not begin until the reconciled shared operational schema and transition contract are approved and migrated. Subscription billing, provider integration, subscription records, and subscription enforcement are deferred from the MVP and do not gate current approved Logistics access.
