# Requirements
Defines **WHAT** the system must do.

## Product Overview
Aisley is a vertically integrated multi-vendor e-commerce marketplace. Independent sellers operate their own shops and inventory, buyers purchase products through the marketplace, and Aisley sits between participants while collecting platform fees.
Unlike a marketplace that depends on third-party logistics APIs, Aisley controls its own logistics infrastructure. The MVP must therefore support the marketplace transaction and first-party logistics lifecycle as one connected system.

The core MVP success path is:
Buyer discovers a product → places an order → Seller processes and packs it → Courier picks it up → Logistics sorts/transfers/dispatches it → Courier delivers it → Buyer receives and rates it.

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
- Select a payment method.
- Manage shipping/billing addresses.
- Place orders.
- Track order status.
- Cancel or modify eligible orders before seller processing.
- Rate and review delivered products.
- Browse seller shops and categories.
- Manage account information.

## Seller
Each Seller account owns exactly one shop.

MVP responsibilities:

- Register and wait for admin approval.
- Manage shop/account information.
- Add, update, and archive products.
- Set prices, discounts, and seller vouchers where supported.
- Monitor stock levels.
- Receive and review new orders.
- Process and prepare orders.
- Print waybill/shipping details.
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
- Maintain required logistics subscription status.
- View seller-confirmed orders.
- Receive parcels into the logistics workflow.
- Generate/print waybills.
- Sort parcels.
- Transfer parcels by scanning or entering waybill QR/reference numbers.
- Dispatch parcels by scanning or entering waybill QR/reference numbers.
- View available couriers.
- Assign riders based on delivery requirements and distance.
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
- View delivery notifications and available pickup requests.
- Review pickup and delivery details.
- Accept a delivery request.
- Navigate to the pickup point.
- Verify parcel/order information.
- Scan the parcel/order identifier.
- Confirm item pickup.
- Deliver the order to the buyer.
- Complete delivery.
- Submit basic proof of delivery.
- View delivery history.
- View basic earnings/profit.
- Communicate with relevant users.
- Manage courier account information.
