---
model: Seller
type: Feature Specification
purpose: AI Vibe Coding Context
version: 1.0
---

# Seller Model Context

## Overview

This document provides a highly structured, hierarchical explanation of the Seller model features. It is designed to be ingested by AI agents for code generation and system architecture planning. Each feature is broken down from its core value into an expanded functional definition and implementation context.

---

## Core Features

### 1. Dashboard

- **Core Value**: Overview of sales, statistics, charts, etc.[cite: 3]
- **Expanded Definition**: A centralized merchant interface aggregating store performance metrics. It provides the seller with real-time visualizations of revenue, order volume, and shop traffic to enable data-driven business decisions.
- **System Context**: Requires data aggregation across `Orders` and `Analytics` tables. Needs charting libraries on the frontend to render statistics and time-series graphs based on the seller's specific data scope.

### 2. Order Management

- **Core Value**: add, update, archive products; set prices, discounts, vouchers; monitor stock levels[cite: 3]
- **Expanded Definition**: A comprehensive Product and Inventory Information Management system. Sellers can execute CRUD (Create, Read, Update, Delete) operations on their catalog, apply promotional pricing logic, and manage their inventory.
- **System Context**: Heavily interacts with the `Products`, `Inventory`, and `Promotions` schemas. Requires robust form validation for product attributes, price calculations, and stock constraint enforcement.

### 3. Order Notifications

- **Core Value**: View new orders, review order detail[cite: 3]
- **Expanded Definition**: A real-time alerting and viewing mechanism for incoming purchases. Sellers can immediately access comprehensive breakdowns of newly placed orders, including buyer details, purchased variants, and transaction statuses.
- **System Context**: Requires WebSocket or polling connections for real-time alerts. Integrates deeply with the `Orders` and `Transactions` database tables.

### 4. Prepare Orders

- **Core Value**: print waybill/shipping detail[cite: 3]
- **Expanded Definition**: A fulfillment processing module that facilitates the physical preparation of goods. It automatically generates standardized, printable shipping labels and packing slips required by third-party logistics (3PL) partners.
- **System Context**: Requires integration with a PDF generation library or a shipping carrier's API to fetch and render accurate, scannable barcode data and delivery manifests.

### 5. Confirm Delivery

- **Core Value**: seller will be notified once the customer receives the order[cite: 3]
- **Expanded Definition**: A post-fulfillment tracking system. It closes the loop on the order lifecycle by pushing a final notification to the seller confirming that the logistics provider has successfully handed over the parcel to the buyer.
- **System Context**: Relies on webhooks or API callbacks from integrated courier services to update the order status state machine to `DELIVERED` and trigger the subsequent seller notification.

### 6. Generate Report

- **Core Value**: financial and profit, has date picker as to from and to date; Sales and performance tracking[cite: 3]
- **Expanded Definition**: A financial analytics module tailored for merchant bookkeeping. Sellers can specify custom temporal parameters to export detailed ledgers of gross sales, net profits, platform fees, and overall shop performance.
- **System Context**: Involves complex aggregation queries on the `Transactions` table, filtered by a specific `seller_id` and timestamp ranges. Output typically requires background job processing for generating downloadable CSV/PDF files.

### 7. Chat/Messaging

- **Core Value**: Communicate with the users[cite: 3]
- **Expanded Definition**: A built-in customer relationship management (CRM) communication tool. Sellers can answer pre-sale product inquiries, provide post-sale support, and resolve minor issues directly with buyers in real-time.
- **System Context**: Requires a specialized chat schema linking `Seller` and `User` entities, supporting text and possibly image attachments. Must include real-time database syncing or webhooks.

### 8. Account Management

- **Core Value**: Update Seller information. Basically account settings[cite: 3]
- **Expanded Definition**: A self-service portal for managing the seller's storefront identity and internal settings. It handles updates to business names, payout details, store descriptions, and security credentials.
- **System Context**: Standard profile management, requiring strict validation for sensitive fields like banking or payout information.

### 9. Review Management

- **Core Value**: Read and reply to customer reviews and ratings on products to maintain shop reputation.[cite: 3]
- **Expanded Definition**: A reputation management interface where sellers monitor customer feedback. Sellers can publicly respond to both positive praises and critical reviews, demonstrating active customer service and brand accountability.
- **System Context**: Queries the `Reviews` table associated with the seller's products. Needs an interface to input and display a nested `seller_response` object linked to the parent review.

### 10. Low Stock Alerts

- **Core Value**: Set customized inventory thresholds and receive automated notifications when specific product variants need to be restocked.[cite: 3]
- **Expanded Definition**: A proactive inventory management utility. Sellers define minimum quantity limits per SKU, and the system automatically dispatches alerts when inventory dips below these thresholds to prevent stockouts.
- **System Context**: Requires a background worker or database trigger that evaluates stock quantities against the `alert_threshold` integer column every time an order is placed or inventory is adjusted.

### 11. Bulk Product Import/Export

- **Core Value**: Upload or download multiple products simultaneously via CSV/Excel templates to streamline inventory management.[cite: 3] Layman's term, bulk upload products using CSV file, if seller wants to bulk update their product, download the CSV file then edit it, then upload it[cite: 3]
- **Expanded Definition**: A mass-data manipulation tool designed for high-volume sellers. It enables offline editing by allowing the download of the current catalog to a spreadsheet, making mass modifications, and synchronizing those changes back to the database via bulk upload.
- **System Context**: Requires a highly resilient file parsing module (for CSV/XLSX). Must include strict validation logic and error-reporting mechanisms to handle malformed rows without failing the entire batch insertion/update process.

### 12. Vacation Mode

- **Core Value**: Allow sellers to temporarily pause new orders and hide their shop listings when they are away or unable to fulfill orders.[cite: 3]
- **Expanded Definition**: A master toggle switch for shop availability. When activated, the seller's products are temporarily removed from active search indices, and the checkout functionality for their items is disabled, preventing unfulfillable orders.
- **System Context**: Toggles a `is_on_vacation` boolean on the `Seller` record. This flag must act as a global filter across all product queries and cart validations on the buyer frontend.

### 13. Abandoned Cart Promotions

- **Core Value**: Automatically send targeted notifications or discounts to buyers who left items in their cart for an extended period.[cite: 3]
- **Expanded Definition**: An automated marketing and conversion recovery tool. It detects stalled buyer intents and automatically triggers personalized incentives (like percentage discounts or free shipping vouchers) to encourage checkout completion.
- **System Context**: Requires a CRON job or scheduled task that scans the `Carts` table for items older than a specified duration, subsequently cross-referencing user communication preferences to dispatch emails or push notifications.

