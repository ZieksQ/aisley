# Requirements
Defines **WHAT** the system must do.

## Product Overview
Aisley is a vertically integrated multi-vendor e-commerce marketplace. Independent sellers operate their own shops and inventory, buyers purchase products through the marketplace, and Aisley sits between participants while collecting platform fees.
Unlike a marketplace that depends on third-party logistics APIs, Aisley controls its own logistics infrastructure. The MVP must therefore support the marketplace transaction and first-party logistics lifecycle as one connected system.

The core MVP success path is:
Buyer discovers a product and places an order → Seller processes and packs it → Seller selects an eligible Logistics organization, requests pickup, and prints the shared waybill → selected Logistics schedules/assigns a first-mile Courier → Courier picks it up and transfers it to Logistics → Logistics receives it through offline-capable scanning and sorts it → Logistics creates a delivery schedule for up to 15 sorted parcels and one final-mile Courier → Courier delivers it → Buyer receives and rates it.

This is the implemented P0 cross-role flow. The foundation includes Seller pickup requests, the immutable shared waybill, pickup schedules, first-mile assignment/acceptance and confirmation, inventory fulfillment, and Courier route manifests. The additive Shipment/Parcel/Delivery Task contract provides Logistics hub milestones, one atomic final-mile dispatch-batch acceptance, QR/reference hub-pickup evidence, private photo POD, retryable failed doorstep attempts, Logistics-confirmed delivery, and advisory Geoapify batch routing. Signature proof, live location telemetry, returns, and exceptional recovery remain deferred.

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

The Seller selects an eligible Logistics organization when requesting pickup for prepared Shop Orders. A same-city/province/country provider is recommended first, then eligible providers are ranked by Geoapify road distance when coordinates and provider capacity are available. The committed provider must not be silently replaced.

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
- Select a Customer-owned shipping address at checkout; the Seller selects Logistics when requesting pickup.
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
- Manage multiple Seller-owned pickup addresses, keep one default, pin optional exact coordinates with Geoapify and Leaflet, and choose one saved address for each solo or bulk pickup request.
- Add, update, and archive products.
- Set prices, discounts, and seller vouchers where supported.
- Monitor stock levels.
- Receive and review new orders.
- Process and prepare orders.
- Pack each parcel, choose one pickup address shared by every Order in the solo or bulk request, select the Logistics organization, request pickup, and print/reprint the resulting shared waybill. The first committed provider becomes the Seller's default while remaining eligible, but another eligible provider may be chosen per request. The Seller does not assign a Courier.
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
- Implemented Logistics hub pinning: the operator may confirm the actual sole hub location during registration or in Account Settings using PSGC/manual fields, intentional Geoapify assistance, and a Leaflet click/drag pin. The API persists both latitude and longitude on the linked hub Address and records same-premises corrections. Manual registration remains available during map failure; unpinned is not an invented coordinate. Coordinate fingerprints affect future calculations only; historical snapshots remain unchanged. Physical relocation remains separately controlled. Mapbox is not used.
- Subscription billing and enforcement are deferred from the MVP; an approved active Logistics account is not subscription-gated until a Subscription policy exists.
- View Seller-confirmed Orders whose selected Logistics organization is this organization.
- Create the first-mile pickup task after the Seller marks the Order `ready_for_pickup`, then offer or assign it to an eligible Courier.
- Receive parcels transferred from Sellers on a dedicated page using the thin 1D Code 128 tracking ID, QR camera scanning, or manual tracking ID/waybill-reference entry. Persist captures locally with Dexie while offline, auto-post at ten scans, every five minutes, or reconnect, and provide an immediate post action.
- View/download the Seller-created shared one-page A6 waybill with the thin Code 128 tracking-ID barcode and QR compatibility identifier, and use it for pickup, hub, sorting, transfer, and dispatch operations.
- View a schedule-first pickup queue scoped to the authenticated Logistics organization, create a schedule from pending parcels ordered by Shop and request date, combine solo or bulk requests from multiple Sellers, assign one approved affiliated Courier, display remaining parcels, and limit each schedule to 30 Orders/parcels.
- Notify the Seller and assigned Courier of the committed pickup date/time and run idempotent scheduled reminders.
- If a Courier submits a waybill QR/reference scan or handoff evidence, validate it and record the authoritative event under this Logistics organization. Preserve the performing Courier, recording Logistics account, and event timestamp; the QR/reference scan, Courier identity, and timestamp are the minimum evidence.
- Sort received parcels from a dedicated compact **Sorting** workspace. Each Logistics organization creates sort plans on a separate **Sort plan** page, creates standard/exception lanes with printable Code 128 labels, and maps exact four-digit Buyer postal codes to active standard lanes. Sorting opens one bounded 100-parcel hub session and captures tracking IDs/QR/manual references into a Dexie outbox. Automatic sync resolves the tracking ID, Buyer postal code, and current active plan on the server; a match selects the mapped lane, while a missing plan, routing input, mapping, or usable lane selects the exception lane and records the reason. Standard-lane sync commits `sorted_at_hub`; exception lanes retain `received_at_hub` until resolved.
- Transfer parcels by scanning or entering tracking IDs, waybill references, or QR compatibility values.
- Show only `sorted_at_hub` parcels in a dedicated **Ready to dispatch** queue. Create one future delivery schedule for one approved affiliated Courier and at most 15 parcels; dispatch and all per-parcel final-mile offers commit atomically.
- Filter ready parcels by physical standard lane with counts and receipt-time pagination. Default to one lane per batch; combining lanes requires explicit opt-in and the same hub. Persist dispatch source-lane snapshots, reject stale parcel/lane assignments, and allow audited lane moves only before dispatch. An open sorting session does not block its ready parcels; exceptions remain held.
- Show a rejected Courier offer in the Logistics queue and re-offer the same task to another eligible Courier without changing the Order. An unfinished task may be shown as informationally `stale`; it is not automatically cancelled or reassigned in the MVP.
- View available couriers.
- Assign a final-mile Courier through the dispatch schedule. The Customer sees **Scheduled for delivery** plus that Courier's name and contact number; Courier acceptance and later delivery execution remain separate.
- Update shipment/order status.
- Monitor courier availability and active capacity.
- Manage a separate company-truck fleet with positive parcel capacities and approved truck-driver capability. Schedule route-aware outbound linehaul from Dispatch, require the receiving Logistics organization's approval before physical departure, receive inbound trips on a dedicated page, and schedule visiting trucks back to their owning hub with cargo or as an explicit empty return. Company-truck ownership and driver affiliation never transfer; confirmed operational events provide location state without claiming live GPS. Final-mile schedules retain the separate 15-parcel limit.
- Separate inbound truck arrival, verified per-parcel custody, and unloading closure. Support trip-scoped offline capture, partial sorting during unloading, damage inspection/release, unexpected-scan investigation, reasoned shortage closure, sender notifications, and late expected receipt after truck return. Missing parcels never become received merely because unloading closes.
- Communicate with users.
- Manage logistics account information.

## Courier / Rider
Courier accounts are registered under a selected Logistics company and approved by Logistics.

MVP responsibilities:

- Search/select an eligible Logistics company during registration. Its single operational hub is associated automatically; selecting a sub-hub is not supported.
- Register under that Logistics account.
- Provide exactly one vehicle per Courier with required vehicle type, plate number, and private OR/CR evidence for Logistics review. Maintenance, vehicle history, and vehicle capacity values/units or matching are deferred; existing operational history and schedule limits are unchanged.
- Implemented backend target: after approval, Courier may edit type, plate, optional make/model, and independently replace separate OR and CR images without Logistics reapproval. The associated Logistics account receives one durable informational notification per committed revision; failures/retries cannot undo changes or duplicate notifications. Ownership/status are not editable and initial registration approval remains required. External Flutter rollout remains separate.
- Sign in after Logistics approval.
- Use the external mobile application to view delivery notifications and first-mile pickup/final-mile delivery requests created or offered by Logistics.
- Review pickup and delivery details.
- View the operational Order, parcel, waybill, pickup, destination, item, and delivery-instruction data required for an offered or accepted task, plus server-provided provider-neutral distance and estimated duration. Secrets, private evidence, raw storage paths, and unrelated personal data remain excluded.
- Accept an eligible pickup or delivery request.
- Reject an offered request. Rejection marks the task `rejected`, leaves the Order unchanged, and allows Logistics to offer the same task to another eligible Courier.
- Navigate to the Seller for first-mile pickup or the Logistics hub for final-mile pickup.
- Verify parcel/order information.
- Scan the parcel/order waybill QR/reference identifier and submit the scan/evidence to Logistics for validation and authoritative recording.
- Confirm `picked_up_from_seller` or `picked_up_from_hub`, depending on the task leg.
- Deliver the order to the buyer.
- Complete delivery.
- Submit basic proof of delivery.
- View delivery history.
- View basic earnings/profit.
- Communicate with relevant users.
- View assigned company-truck linehaul trips and committed return schedules through the Courier API/mobile client. The Courier does not accept a Logistics-committed return trip and does not need to own a truck personally when authorized to drive a company truck.
- Manage courier account information.

## Shared order and fulfillment rules

- Persisted and API status values use lowercase `snake_case`; UI labels and legacy uppercase source labels are not database values. Keep the existing high-level `OrderStatus` values for compatibility and use explicit Shipment/Delivery Task milestones for physical handoffs.
- Successful COD checkout skips `pending_payment`, creates each Shop Order at `placed` with `payment_status = pending`, and reserves the requested SKU quantities atomically. An accepted cancellation or rejection before `picked_up_from_seller` releases only that Order's reservation once; first-mile pickup commits the reservation once. Post-pickup returns, refunds, delivery-failure restoration, and partial fulfillment require a separately approved policy.
- Aisley creates one immutable shared waybill/tracking ID per Order in the Seller's committed pickup-request transaction. Seller and selected Logistics may view/print it; an assigned Courier may resolve its opaque QR only through an authorized task. The primary barcode is a thin 1D Code 128 encoding of the tracking ID; QR remains a compatibility/fallback identifier. Document access and scanning never independently advance custody status.
- First-mile and final-mile assignments are independent. Once the Seller confirms `ready_for_pickup`, Logistics creates at most one active first-mile task. After receipt and sorting, Logistics atomically schedules 1–15 parcels with one final-mile Courier, recording dispatch plus one task/offer per parcel and projecting each Order to `assigned`. A Courier accepts its assigned dispatch schedule atomically; exceptional per-task rejection leaves the Order unchanged and permits Logistics re-offer.
- Each deployed Delivery Task represents exactly one Order/Parcel for one leg. A pickup schedule may group Orders operationally, but it must not merge their tasks, waybills, snapshots, or histories.
- Courier-submitted QR/reference scans and handoff evidence are validated and recorded authoritatively by Logistics while preserving both the performing Courier and recording Logistics account. A scan or waybill access event alone never advances custody; the shared transition service owns the physical state change. Authorized Courier task projections may include provider-neutral distance and estimated duration, but no map vendor is implied.
- New physical Shipment/Parcel/Scan/custody, final-mile Delivery Task/assignment, and photo proof-of-delivery writes use the reconciled shared operational schema and transition contract, deployed additively and copied into their owning documents. Existing Seller pickup requests, shared waybills, pickup schedules, first-mile assignment/acceptance, and explicit Courier pickup confirmation remain backward-compatible foundations. Confirmation records first-mile custody and inventory fulfillment; scheduling or scanning alone does not. Signature evidence, live location telemetry, returns, and exceptional recovery remain deferred. Subscription billing, provider integration, subscription records, and subscription enforcement are deferred from the MVP and do not gate current approved Logistics access.

**Current/future boundary:** `ConfirmFirstMilePickup` remains the compatibility writer for the accepted Courier's Seller handoff and Inventory fulfillment, then idempotently bridges the result into shared physical records without replaying stock. Hub and final-mile transitions use the Logistics-authoritative `FulfillmentTransitionService`; signature proof, live location telemetry, returns, and exceptional recovery remain future extensions; private photo POD and advisory final-mile routes are implemented.
