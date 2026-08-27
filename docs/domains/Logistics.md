---
model: Logistics
type: Feature Specification
purpose: AI Vibe Coding Context
version: 1.0
---

# Logistics Model Context

## Overview
This document provides a highly structured, hierarchical explanation of the Logistics (Dispatch/Sorting Hub) model features. It is designed to be ingested by AI agents for code generation and system architecture planning. Each feature is broken down from its core value into an expanded functional definition and implementation context, tailored for a flexible, gig-economy rider workforce.

---

## Core Features

### 1. Dashboard
* **Core Value**: View seller confirmed orders[cite: 6].
* **Expanded Definition**: A centralized command and control interface for logistics dispatchers. It aggregates and displays a real-time queue of all parcels that have been processed by sellers and are currently awaiting assignment or sorting center processing.
* **System Context**: Requires real-time data fetching (polling or WebSockets) from the `Orders` table, filtered strictly by statuses such as `READY_FOR_PICKUP` or `AT_SORTING_CENTER`.

### 2. Deploy Rider
* **Core Value**: Select which rider to take the order depending on the distance of buyer to rider[cite: 6].
* **Expanded Definition**: An intelligent dispatch and routing mechanism. It evaluates the geographical coordinates of available couriers against the pickup/drop-off locations, allowing the logistics team to manually assign tasks or oversee automated algorithmic dispatching based on proximity optimization.
* **System Context**: Requires geospatial querying capabilities (e.g., PostGIS) to calculate distances between the rider's live GPS coordinates and the order's origin/destination points. 

### 3. Update Status
* **Core Value**: Update order status once rider pick up order[cite: 6].
* **Expanded Definition**: A state-management utility for tracking the physical parcel. It provides logistics personnel with the authority to manually advance an order's lifecycle state (e.g., marking it as transitioning from the hub to the rider) in cases where automated rider scanning fails.
* **System Context**: Interfaces directly with the order state machine in the database, triggering corresponding notifications to buyers and sellers when the status mutates.

### 4. Chat/Messaging
* **Core Value**: Communicate with the users[cite: 6].
* **Expanded Definition**: A tri-directional communication hub. It allows the centralized logistics team to interface directly with active couriers for routing assistance, with buyers for delivery address clarification, or with sellers regarding pickup delays.
* **System Context**: Requires an administrative view of the global messaging schema, enabling dispatchers to join or initiate threads related to specific active `order_ids`.

### 5. Account Management
* **Core Value**: Update Logistics information. Basically account settings (Adapted from source[cite: 6]).
* **Expanded Definition**: A profile management portal for the logistics hub or dispatcher identity. It handles updates to the logistics center's operational details, contact numbers, and security credentials.
* **System Context**: Standard profile management and authentication middleware for the `Logistics` or `Admin` user role.

### 6. Vehicle Fleet Management
* **Core Value**: Maintain a digital registry of assigned delivery vehicles, including plate numbers, maintenance schedules, and the specific couriers assigned to them[cite: 6].
* **Expanded Definition**: An asset tracking database. It ensures that all vehicles utilized on the platform meet regulatory and safety standards, linking specific vehicle capacities (e.g., motorcycle vs. van) to couriers to ensure they are assigned appropriately sized orders.
* **System Context**: Requires a `Vehicles` schema linked to `Couriers`. Used as a filter during the "Deploy Rider" phase to match the volumetric weight of an order to the assigned vehicle's capacity.

### 7. Waybill
* **Core Value**: Able to print order details[cite: 6].
* **Expanded Definition**: A document generation tool for internal hub operations. It synthesizes digital order data into standardized, scannable physical manifests and routing labels necessary for sorting center logistics.
* **System Context**: Involves a PDF or thermal printer formatting library to generate barcodes (Code 128 or QR) that map to the primary key of the `Orders` database record.

### 8. Zone/Territory Mapping
* **Core Value**: Define and assign specific geographic delivery zones to ensure riders are only deployed to areas they are familiar with[cite: 6].
* **Expanded Definition**: A geospatial configuration tool. It allows logistics managers to draw operational boundaries (polygons) on a map, clustering deliveries and filtering rider assignments to specific local territories to maximize efficiency and reduce transit times.
* **System Context**: Integrates with mapping APIs (like Google Maps or Mapbox). The drawn zones must be saved as geospatial data types in the database to filter available riders during dispatch.

### 9. Flexible Availability & Capacity Monitoring
* **Core Value**: Allow riders to pick their own schedules while providing logistics teams with data on active courier capacity (Replaces Rider Shift Scheduling[cite: 6]).
* **Expanded Definition**: A live-monitoring dashboard reflecting the gig-economy model. Instead of assigning shifts, this tool tracks which couriers have toggled their status to "Online/Available." It aggregates this data to forecast whether the current online fleet can handle the active order queue, allowing logistics to trigger surge pricing or incentives if demand outpaces available riders.
* **System Context**: Requires a real-time status flag (`is_online`) on the `Courier` entity. The dashboard visualizes the count of active riders versus pending orders to determine network health.