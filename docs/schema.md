# Database Schema — Multi-Tenant E-Commerce

## 1. Project Overview

This project is a **multi-tenant B2C e-commerce platform** similar to Shopee, Lazada, or Amazon.

The platform has four primary user roles:

* **Buyer** — purchases products from sellers.
* **Seller** — manages a store, products, inventory, and orders.
* **Courier** — accepts and delivers orders.
* **Admin** — manages users, sellers, compliance, disputes, commissions, and platform settings.

A seller represents a **tenant/store**. Buyers can purchase products from multiple sellers.

The MVP should prioritize a simple relational model and avoid unnecessary enterprise architecture.

---

# 2. Core Domain Model

```text
User
 ├── Buyer
 ├── Seller
 ├── Courier
 └── Admin

Seller
 └── Store
      └── Products
           ├── Product Variants
           ├── Inventory
           └── Product Images

Buyer
 └── Orders
      └── Order Items
           └── Products / Variants

Order
 ├── Payment
 ├── Shipment
 │    └── Courier
 ├── Voucher / Discount
 └── Reviews / Feedback

Admin
 ├── Registration Applications
 ├── User Management
 ├── Seller Compliance
 ├── Complaints / Disputes
 ├── Commission
 └── Platform Settings
```

---

# 3. Identity and Access

## 3.1 Users

The `users` table represents all people who can authenticate into the system.

Do not create separate authentication tables for buyers, sellers, couriers, and admins unless required by the implementation.

### `users`

| Column        | Type      | Constraints      | Description                                                 |
| ------------- | --------- | ---------------- | ----------------------------------------------------------- |
| id            | UUID      | PK               | User identifier                                             |
| email         | VARCHAR   | UNIQUE, NOT NULL | Login email                                                 |
| password_hash | VARCHAR   | NOT NULL         | Hashed password                                             |
| role          | ENUM      | NOT NULL         | `buyer`, `seller`, `courier`, `admin`                       |
| status        | ENUM      | NOT NULL         | `pending`, `active`, `suspended`, `deactivated`, `rejected` |
| created_at    | TIMESTAMP | NOT NULL         | Creation time                                               |
| updated_at    | TIMESTAMP | NOT NULL         | Last update                                                 |

A user cannot log in until their account has been approved and is `active`.

---

# 4. User Profile

## 4.1 Profiles

Personal information shared by buyers, sellers, and couriers should be stored separately from authentication credentials.

### `user_profiles`

| Column         | Type      | Constraints           | Description        |
| -------------- | --------- | --------------------- | ------------------ |
| id             | UUID      | PK                    | Profile identifier |
| user_id        | UUID      | FK → users.id, UNIQUE | User               |
| first_name     | VARCHAR   | NOT NULL              | First name         |
| last_name      | VARCHAR   | NOT NULL              | Last name          |
| middle_initial | VARCHAR   | NULL                  | Middle initial     |
| sex            | ENUM      | NOT NULL              | Sex                |
| contact_number | VARCHAR   | NOT NULL              | Contact number     |
| birthday       | DATE      | NOT NULL              | Birth date         |
| created_at     | TIMESTAMP | NOT NULL              | Creation time      |
| updated_at     | TIMESTAMP | NOT NULL              | Last update        |

### Age

Age should **not** be stored as a permanent database field.

Calculate age from `birthday`.

```text
age = current_date - birthday
```

This prevents the age value from becoming outdated.

---

# 5. Addresses

A user may have multiple addresses.

### `addresses`

| Column          | Type      | Constraints   | Description                    |
| --------------- | --------- | ------------- | ------------------------------ |
| id              | UUID      | PK            | Address identifier             |
| user_id         | UUID      | FK → users.id | Owner                          |
| province_id     | UUID      | FK            | Province                       |
| municipality_id | UUID      | FK            | Municipality                   |
| barangay_id     | UUID      | FK            | Barangay                       |
| street          | VARCHAR   | NULL          | Street                         |
| house_number    | VARCHAR   | NULL          | House/building number          |
| postal_code     | VARCHAR   | NULL          | Postal code                    |
| address_line    | VARCHAR   | NULL          | Additional address information |
| is_default      | BOOLEAN   | NOT NULL      | Default address                |
| created_at      | TIMESTAMP | NOT NULL      | Creation time                  |
| updated_at      | TIMESTAMP | NOT NULL      | Last update                    |

---

# 6. Philippine Location Data

The registration form requires:

```text
Province
    ↓
Municipality / City
    ↓
Barangay
```

These should be represented using reference tables.

### `provinces`

```text
id
name
code
```

### `municipalities`

```text
id
province_id FK → provinces.id
name
code
```

### `barangays`

```text
id
municipality_id FK → municipalities.id
name
code
```

The frontend should load the values dynamically rather than hardcoding the dropdown options.

---

# 7. Registration Applications

Registration requires administrator approval.

Instead of immediately creating an active account, the registration process should create an application.

### `registration_applications`

| Column           | Type               | Description                       |
| ---------------- | ------------------ | --------------------------------- |
| id               | UUID PK            | Application                       |
| user_id          | UUID FK            | Applicant                         |
| application_type | ENUM               | `buyer`, `seller`, `courier`      |
| status           | ENUM               | `pending`, `approved`, `rejected` |
| reviewed_by      | UUID FK → users.id | Admin reviewer                    |
| reviewed_at      | TIMESTAMP          | Review time                       |
| rejection_reason | TEXT               | Reason if rejected                |
| created_at       | TIMESTAMP          | Submission time                   |
| updated_at       | TIMESTAMP          | Last update                       |

Basic workflow:

```text
Registration
      ↓
Create User
status = pending
      ↓
Create Registration Application
status = pending
      ↓
Admin Review
      ↓
 ┌───────────────┐
 │               │
Approve        Reject
 │               │
 ↓               ↓
active         rejected
```

The applicant should receive an email after the administrator makes a decision.

---

# 8. Uploaded Documents

IDs, business permits, OR/CR, and driver's licenses should not be stored directly inside user records.

### `documents`

| Column        | Type               | Description                                                    |
| ------------- | ------------------ | -------------------------------------------------------------- |
| id            | UUID PK            | Document                                                       |
| user_id       | UUID FK            | Owner                                                          |
| document_type | ENUM               | `government_id`, `business_permit`, `or_cr`, `drivers_license` |
| file_url      | TEXT               | Storage location                                               |
| status        | ENUM               | `pending`, `verified`, `rejected`                              |
| verified_by   | UUID FK → users.id | Admin                                                          |
| verified_at   | TIMESTAMP          | Verification time                                              |
| created_at    | TIMESTAMP          | Upload time                                                    |

Actual files should be stored in object/file storage.

The database stores metadata and the file location.

---

# 9. Sellers and Stores

A seller is a tenant of the platform.

A seller owns one store for the MVP.

### `stores`

| Column        | Type                       | Description                          |
| ------------- | -------------------------- | ------------------------------------ |
| id            | UUID PK                    | Store                                |
| seller_id     | UUID FK → users.id, UNIQUE | Store owner                          |
| business_name | VARCHAR                    | Business name                        |
| category_id   | UUID FK                    | Registered business category         |
| status        | ENUM                       | `active`, `suspended`, `deactivated` |
| created_at    | TIMESTAMP                  | Creation time                        |
| updated_at    | TIMESTAMP                  | Last update                          |

Relationship:

```text
User (Seller)
     │
     │ 1:1
     ↓
   Store
```

All seller-owned resources should ultimately be traceable to a `store_id`.

---

# 10. Product Categories

### `categories`

| Column      | Type                    | Description          |
| ----------- | ----------------------- | -------------------- |
| id          | UUID PK                 | Category             |
| parent_id   | UUID FK → categories.id | Parent category      |
| name        | VARCHAR                 | Category name        |
| description | TEXT                    | Description          |
| status      | ENUM                    | `active`, `archived` |
| created_at  | TIMESTAMP               | Creation time        |
| updated_at  | TIMESTAMP               | Last update          |

A self-referencing `parent_id` allows categories such as:

```text
Computer Parts
 ├── CPU
 ├── GPU
 ├── RAM
 └── Storage
```

---

# 11. Products

### `products`

| Column      | Type                    | Description                                |
| ----------- | ----------------------- | ------------------------------------------ |
| id          | UUID PK                 | Product                                    |
| store_id    | UUID FK → stores.id     | Seller/store                               |
| category_id | UUID FK → categories.id | Product category                           |
| name        | VARCHAR                 | Product name                               |
| description | TEXT                    | Product description                        |
| status      | ENUM                    | `draft`, `active`, `archived`, `suspended` |
| created_at  | TIMESTAMP               | Creation time                              |
| updated_at  | TIMESTAMP               | Last update                                |

Important rule:

> A product belongs to exactly one store.

```text
Store
 └── Product
```

---

# 12. Product Images

### `product_images`

```text
id
product_id FK → products.id
image_url
sort_order
created_at
```

A product can have multiple images.

```text
Product 1 ─── * ProductImages
```

---

# 13. Product Variations

Products may have variations such as:

```text
Color: Red
Color: Blue

Size: Small
Size: Medium
Size: Large
```

For an MVP, use a simple variation model.

### `product_options`

```text
id
product_id FK → products.id
name
```

Example:

```text
Color
Size
```

### `product_option_values`

```text
id
product_option_id FK → product_options.id
value
```

Example:

```text
Red
Blue
Small
Medium
Large
```

---

# 14. Product Variants

A variant represents an actual purchasable SKU.

### `product_variants`

| Column         | Type           | Description          |
| -------------- | -------------- | -------------------- |
| id             | UUID PK        | Variant              |
| product_id     | UUID FK        | Product              |
| sku            | VARCHAR UNIQUE | SKU                  |
| price          | DECIMAL        | Base price           |
| stock_quantity | INTEGER        | Available stock      |
| status         | ENUM           | `active`, `archived` |
| created_at     | TIMESTAMP      | Creation time        |
| updated_at     | TIMESTAMP      | Last update          |

Example:

```text
Product: T-Shirt

Variant 1
SKU: SHIRT-RED-M
Color: Red
Size: Medium
Price: 500
Stock: 20

Variant 2
SKU: SHIRT-BLUE-L
Color: Blue
Size: Large
Price: 550
Stock: 10
```

### `product_variant_values`

```text
variant_id FK → product_variants.id
option_value_id FK → product_option_values.id
```

This allows each variant to contain multiple attributes.

---

# 15. Discounts

### `discounts`

```text
id
store_id FK → stores.id
name
type
value
start_at
end_at
status
created_at
updated_at
```

Possible types:

```text
percentage
fixed_amount
```

A discount can be associated with a product or product variant.

---

# 16. Vouchers

### `vouchers`

```text
id
store_id FK → stores.id
code UNIQUE
name
discount_type
discount_value
minimum_order_amount
maximum_discount_amount
usage_limit
used_count
start_at
end_at
status
created_at
updated_at
```

For MVP, vouchers can be seller-specific.

A later version may introduce platform-wide vouchers.

---

# 17. Shopping Cart

Each buyer has a cart.

### `carts`

```text
id
buyer_id FK → users.id UNIQUE
created_at
updated_at
```

### `cart_items`

```text
id
cart_id FK → carts.id
product_variant_id FK → product_variants.id
quantity
created_at
updated_at
```

Important:

> The cart stores the selected product variant, not merely the product.

---

# 18. Orders

An order represents a buyer's checkout.

Because the system is multi-tenant, one checkout may contain products from multiple sellers.

Therefore, use an order hierarchy:

```text
Order
 └── Seller Orders
       └── Order Items
```

### `orders`

| Column                    | Type               | Description                 |
| ------------------------- | ------------------ | --------------------------- |
| id                        | UUID PK            | Order                       |
| buyer_id                  | UUID FK → users.id | Buyer                       |
| order_number              | VARCHAR UNIQUE     | Human-readable order number |
| status                    | ENUM               | Overall order status        |
| subtotal                  | DECIMAL            | Subtotal                    |
| discount_amount           | DECIMAL            | Discounts                   |
| shipping_fee              | DECIMAL            | Shipping                    |
| total_amount              | DECIMAL            | Final total                 |
| shipping_address_snapshot | JSONB              | Address at checkout         |
| placed_at                 | TIMESTAMP          | Order placement             |
| created_at                | TIMESTAMP          | Creation time               |
| updated_at                | TIMESTAMP          | Last update                 |

The shipping address should be stored as a **snapshot** so that changing the user's address later does not modify historical orders.

---

# 19. Seller Orders

A single buyer checkout can contain products from several sellers.

Example:

```text
Order #1001

Seller A
 ├── Product X
 └── Product Y

Seller B
 └── Product Z
```

### `seller_orders`

```text
id
order_id FK → orders.id
store_id FK → stores.id
status
subtotal
discount_amount
shipping_fee
total_amount
created_at
updated_at
```

This is the main order entity that sellers manage.

---

# 20. Order Items

### `order_items`

```text
id
seller_order_id FK → seller_orders.id
product_id FK → products.id
product_variant_id FK → product_variants.id
product_name_snapshot
variant_name_snapshot
sku_snapshot
unit_price
quantity
discount_amount
subtotal
created_at
```

Important:

> Product information and price should be snapshotted when the order is placed.

This prevents historical orders from changing when a seller edits a product.

---

# 21. Payments

### `payments`

```text
id
order_id FK → orders.id
payment_method
status
amount
transaction_reference
paid_at
created_at
updated_at
```

MVP payment methods may include:

```text
Cash on Delivery
Online Payment
```

Actual payment gateway integration can be added later.

---

# 22. Shipments

A shipment belongs to a seller order.

### `shipments`

```text
id
seller_order_id FK → seller_orders.id
courier_id FK → users.id
tracking_number
status
pickup_at
picked_up_at
out_for_delivery_at
delivered_at
created_at
updated_at
```

Shipment statuses:

```text
pending
assigned
accepted
picked_up
in_transit
out_for_delivery
delivered
cancelled
```

---

# 23. Courier Delivery Requests

A seller order can become available for courier pickup.

### `delivery_requests`

```text
id
seller_order_id FK → seller_orders.id
status
available_at
accepted_by FK → users.id
accepted_at
created_at
updated_at
```

Courier workflow:

```text
Seller prepares order
       ↓
Delivery request created
       ↓
Available to couriers
       ↓
First courier accepts
       ↓
Courier assigned
       ↓
Pickup
       ↓
Delivery
       ↓
Completed
```

The backend must enforce the **first accepted courier wins** rule transactionally.

---

# 24. Courier Profile

### `courier_profiles`

```text
id
user_id FK → users.id UNIQUE
vehicle_type
plate_number
created_at
updated_at
```

Vehicle examples:

```text
Motorcycle
Car
Van
```

Courier documents are stored using the `documents` table.

---

# 25. Delivery History

Delivery history can primarily be derived from completed shipments.

Additional courier-specific records can be added if required.

### `courier_earnings`

```text
id
courier_id FK → users.id
shipment_id FK → shipments.id
amount
status
created_at
```

---

# 26. Reviews and Feedback

Buyers can rate products/sellers after receiving an order.

### `reviews`

```text
id
buyer_id FK → users.id
order_item_id FK → order_items.id
product_id FK → products.id
rating
comment
created_at
updated_at
```

Rating should be constrained:

```text
1–5
```

Only the buyer who purchased the order item should be able to review it.

---

# 27. Complaints and Disputes

### `complaints`

```text
id
order_id FK → orders.id
created_by FK → users.id
subject
description
status
resolution
resolved_by FK → users.id
resolved_at
created_at
updated_at
```

Possible statuses:

```text
open
under_review
resolved
rejected
closed
```

---

# 28. Complaint Evidence

### `complaint_evidence`

```text
id
complaint_id FK → complaints.id
uploaded_by FK → users.id
file_url
created_at
```

This allows buyers, sellers, or couriers to submit supporting evidence.

---

# 29. Seller Compliance

Admins must be able to monitor seller products.

### `compliance_actions`

```text
id
seller_id FK → users.id
product_id FK → products.id NULL
admin_id FK → users.id
action_type
reason
created_at
```

Possible actions:

```text
warning
product_suspended
seller_suspended
```

Examples:

```text
Product does not belong to registered category
Prohibited product
Inappropriate product
Repeated violation
```

---

# 30. Platform Commission

The platform takes a **10% commission**.

Commission should be calculated from completed/eligible seller sales.

### `commissions`

```text
id
seller_order_id FK → seller_orders.id
store_id FK → stores.id
order_amount
commission_rate
commission_amount
seller_amount
status
created_at
```

For the current MVP:

```text
commission_rate = 10%
```

Formula:

```text
commission_amount = seller_order_amount × 0.10

seller_amount = seller_order_amount - commission_amount
```

The commission rate should still be stored with the transaction so historical records remain correct if the platform commission changes later.

---

# 31. Notifications

The platform needs notifications for:

* Registration approval/rejection
* New seller orders
* Courier delivery requests
* Order status changes
* Complaints/disputes
* Admin announcements

### `notifications`

```text
id
user_id FK → users.id
type
title
message
reference_type
reference_id
is_read
created_at
```

---

# 32. Chat / Messaging

The MVP requires messaging between users.

Use conversations and messages.

### `conversations`

```text
id
created_at
updated_at
```

### `conversation_participants`

```text
conversation_id FK → conversations.id
user_id FK → users.id
joined_at
```

### `messages`

```text
id
conversation_id FK → conversations.id
sender_id FK → users.id
message
created_at
read_at
```

For MVP, messaging can support text messages first.

Real-time WebSocket functionality can be added without changing the core domain model.

---

# 33. Platform Announcements

### `announcements`

```text
id
title
content
status
published_at
created_by FK → users.id
created_at
updated_at
```

---

# 34. Platform Settings

### `platform_settings`

```text
id
key UNIQUE
value
updated_by FK → users.id
updated_at
```

Example:

```text
commission_rate = 10
```

However, financial transactions should store their actual commission rate instead of relying on the current setting.

---

# 35. Order Status Model

The order lifecycle should be explicit.

```text
PENDING_PAYMENT
      ↓
PAID
      ↓
PROCESSING
      ↓
READY_FOR_PICKUP
      ↓
COURIER_ASSIGNED
      ↓
PICKED_UP
      ↓
IN_TRANSIT
      ↓
OUT_FOR_DELIVERY
      ↓
DELIVERED
```

Possible terminal states:

```text
CANCELLED
FAILED
RETURNED
```

The MVP does not need to implement every possible marketplace status immediately.

---

# 36. Seller Order Lifecycle

```text
NEW
 ↓
PROCESSING
 ↓
PACKED
 ↓
READY_FOR_PICKUP
 ↓
PICKED_UP
 ↓
IN_TRANSIT
 ↓
OUT_FOR_DELIVERY
 ↓
DELIVERED
```

Seller responsibilities:

```text
NEW
  → Review order

PROCESSING
  → Prepare products

PACKED
  → Package order

READY_FOR_PICKUP
  → Request courier

PICKED_UP
  → Courier has collected order

DELIVERED
  → Customer received order
```

---

# 37. Main Relationships

```text
users
 │
 ├────────────── user_profiles
 │
 ├────────────── addresses
 │
 ├────────────── documents
 │
 ├────────────── registration_applications
 │
 ├── seller ─── stores
 │                 │
 │                 ├── products
 │                 │      ├── product_images
 │                 │      ├── product_options
 │                 │      │      └── product_option_values
 │                 │      └── product_variants
 │                 │             └── product_variant_values
 │                 │
 │                 └── vouchers
 │
 ├── buyer ─── carts
 │               └── cart_items
 │
 ├── buyer ─── orders
 │               ├── seller_orders
 │               │      ├── order_items
 │               │      ├── shipments
 │               │      ├── delivery_requests
 │               │      └── commissions
 │               │
 │               └── payments
 │
 ├── courier ─── courier_profiles
 │
 ├────────────── reviews
 ├────────────── complaints
 ├────────────── notifications
 └────────────── messages
```

---

# 38. Important MVP Business Rules

## Authentication

1. Email must be unique.
2. Passwords must be hashed.
3. Pending users cannot log in.
4. Rejected users cannot log in.
5. Suspended users cannot perform normal platform operations.
6. Deactivated users cannot log in.

## Buyer

1. A buyer can have multiple addresses.
2. A buyer can add product variants to a cart.
3. A buyer can only purchase active products.
4. Stock must be checked during checkout.
5. Product price must be snapshotted when the order is created.
6. A buyer can review an item only after successful delivery.

## Seller

1. A seller owns one store in the MVP.
2. A seller can only manage products belonging to their store.
3. A seller cannot modify another seller's products.
4. A seller can only sell products belonging to their registered category.
5. Suspended sellers cannot create or manage new products/orders.

## Courier

1. Only approved couriers can accept delivery requests.
2. A delivery request can only be accepted once.
3. The first successful acceptance assigns the courier.
4. The backend must use a transaction/concurrency-safe operation for courier assignment.
5. A courier can only update shipments assigned to them.

## Admin

1. Only admins can approve registrations.
2. Only admins can suspend/deactivate users.
3. Only admins can perform compliance actions.
4. Only admins can resolve disputes.
5. Commission is 10% for the MVP.
6. Admin actions should be auditable.

## Orders

1. An order belongs to one buyer.
2. An order may contain multiple seller orders.
3. A seller order belongs to exactly one store.
4. A seller order contains one or more order items.
5. Historical order data must not depend on mutable product data.
6. Inventory must be updated atomically when an order is confirmed.

---

# 39. Multi-Tenant Rule

The application is multi-tenant at the **seller/store level**.

The important isolation rule is:

```text
Store A
 ├── Products
 ├── Orders
 ├── Discounts
 ├── Vouchers
 └── Reports

Store B
 ├── Products
 ├── Orders
 ├── Discounts
 ├── Vouchers
 └── Reports
```

A seller must never be able to access another seller's resources.

Every seller-owned query should ultimately be scoped through:

```text
store_id
```

Example:

```text
GET /seller/products
```

must internally resolve the authenticated seller's `store_id`.

Do not trust a client-provided `store_id` for authorization.

---

# 40. Reporting

Reports required by the MVP:

## Seller

```text
Sales Summary
Profit
Orders
Products Sold
Performance
```

Filter:

```text
from_date
to_date
```

## Admin

```text
Platform Sales
Commission
Seller Performance
```

Most reports can be calculated from:

```text
orders
seller_orders
order_items
commissions
payments
```

Do not create separate report tables unless performance requirements later justify them.

---

# 41. MVP Scope Boundaries

The following are intentionally kept simple for the school MVP.

### Include

* Registration and approval
* Authentication
* Role-based authorization
* Seller/store management
* Product CRUD
* Categories
* Product variations
* Inventory
* Cart
* Checkout
* Orders
* Seller order management
* Courier assignment
* Shipment tracking
* Reviews
* Vouchers
* 10% commission
* Basic reports
* Complaints/disputes
* Notifications
* Basic messaging
* Admin management

### Avoid initially

* Microservices
* Event-driven architecture
* Elasticsearch
* Recommendation engine
* Advanced analytics
* Complex payment infrastructure
* Multi-warehouse inventory
* International shipping
* Subscription system
* Loyalty points
* AI recommendations
* Complex tax engine
* Advanced marketplace settlement
* Distributed transactions

The goal is a **working relational monolith/API MVP**, not a production-scale Amazon clone.

---

# 42. Recommended Implementation Order

Implement the domain in this order:

```text
1. Authentication & Users
        ↓
2. Registration Approval
        ↓
3. Addresses & Documents
        ↓
4. Seller / Store
        ↓
5. Categories
        ↓
6. Products & Variants
        ↓
7. Inventory
        ↓
8. Cart
        ↓
9. Checkout
        ↓
10. Orders
        ↓
11. Seller Order Management
        ↓
12. Courier Delivery
        ↓
13. Payments
        ↓
14. Reviews
        ↓
15. Vouchers / Discounts
        ↓
16. Commission
        ↓
17. Admin Compliance / Disputes
        ↓
18. Notifications
        ↓
19. Messaging
        ↓
20. Reports
```

The implementation should follow the dependencies between domains rather than trying to implement all four user interfaces simultaneously.

---

# 43. Source of Truth

This file defines the intended **business/domain schema** for the project.

When implementing the application:

1. Do not introduce new entities without checking whether an existing entity can represent the requirement.
2. Do not duplicate user authentication data for different roles.
3. Keep seller-owned resources scoped to `store_id`.
4. Preserve historical order information using snapshots.
5. Keep business rules in the backend; the frontend must not be trusted for authorization.
6. Prefer simple relational tables over premature abstractions.
7. If implementation requirements conflict with this schema, update this document first before changing the domain model.
