---
model: Courier
type: Feature Specification
purpose: AI Vibe Coding Context
version: 1.0
---

# Courier Model Context

## Overview
This document provides a highly structured, hierarchical explanation of the Courier (Rider/Driver) model features. It is designed to be ingested by AI agents for code generation and system architecture planning. Each feature is broken down from its core value into an expanded functional definition and implementation context, incorporating conditional requirements based on academic or system needs.

---

## Core Features

### 1. Dashboard
* **Core Value**: check delivery notifications; view available pickup requests[cite: 5].
* **Expanded Definition**: The central hub for courier operations. It displays real-time alerts for new job allocations and allows the driver to browse a queue of available packages waiting for pickup at sorting centers or seller locations.
* **System Context**: Requires polling or persistent connections (like WebSockets) connected to a logistics dispatch system to stream live request data.

### 2. Accept Delivery Requests
* **Core Value**: Review Pickup and Delivery Details; Accept Delivery Request[cite: 5].
* **Expanded Definition**: A job confirmation interface. It allows the courier to evaluate the logistical requirements of a task (such as distance, route, and package size) before officially committing to the delivery.
* **System Context**: Triggers an update to the specific delivery task record, changing its status to `ACCEPTED` and assigning the task to the specific `courier_id`.

### 3. Pick Up Order
* **Core Value**: Proceed to sorting center; Verify Order Information; Confirm Item Pickup[cite: 5].
* **Expanded Definition**: The physical handover phase. The courier navigates to the origin point, validates the physical parcel against digital manifests, and formally logs the successful possession of the item into the system.
* **System Context**: Integrates with device camera/barcode scanning modules to validate the `Order` or `Package` ID, subsequently updating the system state to `IN_TRANSIT`.

### 4. Deliver Order
* **Core Value**: Deliver order[cite: 5].
* **Expanded Definition**: The active transit phase. This provides the courier with task tracking and necessary navigational context as they transport the parcel to the buyer's final destination.
* **System Context**: Typically requires integration with mapping APIs (e.g., Google Maps or Mapbox) for routing, and may involve sending live GPS location tracking updates back to the platform.

### 5. Complete Delivery
* **Core Value**: Complete delivery[cite: 5].
* **Expanded Definition**: The finalization of the task. It marks the successful end of the logistics lifecycle for a specific parcel.
* **System Context**: Triggers the final state change in the core database (e.g., `Orders` table) to `DELIVERED`, which cascades automated notifications to both the Buyer and Seller.

### 6. Profit Dashboard
* **Core Value**: Displays profit[cite: 5].
* **Expanded Definition**: A financial overview tailored for the rider. It aggregates earnings derived from delivery fees, providing transparency on the courier's generated income over specific periods.
* **System Context**: Queries a dedicated ledger or earnings table, calculating sums of transaction values strictly tied to the courier's completed deliveries.

### 7. Delivery History
* **Core Value**: Views completed delivery requests[cite: 5].
* **Expanded Definition**: An archival log of all past jobs. It allows couriers to review previous routes, dates, and specifics of successfully fulfilled deliveries for personal record-keeping or dispute resolution.
* **System Context**: A read-only query against historical delivery tasks, filtered by the active `courier_id` where the status equals `COMPLETED`.

### 8. Chat/Messaging
* **Core Value**: Communicate with the users[cite: 5].
* **Expanded Definition**: A direct communication line. It enables the courier to contact the buyer (or seller/logistics team) for address clarifications, gate codes, or to report immediate delivery delays.
* **System Context**: Requires temporary, secure chat instances or masked calling features linked to active orders to facilitate communication while protecting user phone numbers/privacy.

### 9. Account Management
* **Core Value**: Update Courier information. Basically account settings[cite: 5].
* **Expanded Definition**: Profile management for the driver. Handles updates to vehicle details, license information, payout methods, and secure login credentials.
* **System Context**: Standard CRUD operations on the `Couriers` table. Sensitive updates (like changing vehicle types) may require middleware for administrative verification.

### 10. Proof of Delivery (e-POD)
* **Core Value**: Upload photos of the delivered parcel, collect e-signatures, or scan QR codes upon successful drop-off[cite: 5].
* **Expanded Definition**: A strict verification mechanism designed to prevent delivery disputes. It mandates that the courier captures undeniable digital evidence that the parcel was safely handed over or placed at the correct destination.
* **System Context**: Requires mobile device camera and storage permissions. Uploads media to secure cloud storage (e.g., AWS S3) and creates a permanent data link between the media asset URL and the `Order` record.

### 11. Incident Reporting
* **Core Value**: Flag vehicle breakdowns, accidents, or inaccessible delivery addresses to Logistics[cite: 5].
* **Expanded Definition**: An exception-handling system for logistics failures. It allows couriers to log blockers that prevent successful delivery, effectively pausing Service Level Agreements (SLAs) and immediately notifying the central dispatch team.
* **System Context**: Creates an `Incident` record tied to the active delivery task, which can trigger automated re-routing logic or alert support teams.

### 12. Performance Metrics
* **Core Value**: Track personal ratings, successful delivery rates, and average completion times to qualify for rider incentives[cite: 5].
* **Expanded Definition**: A quality assurance dashboard. It monitors the courier's efficiency and customer satisfaction scores. Even if specific incentive structures are currently undefined, this tracking forms the necessary data foundation for any future reward or tier programs[cite: 5].
* **System Context**: Aggregates and averages data across the `Reviews` table (for buyer ratings) and timestamps on delivery tasks (for speed and success rates).

### 13. Offline Mode
* **Core Value**: Download delivery routes and order details for offline access when delivering to areas with poor cellular network coverage[cite: 5].
* **Expanded Definition**: A resilience feature ensuring uninterrupted operations. It pre-caches necessary job data on the device so the courier can continue scanning and marking deliveries even when entering mobile dead zones.
* **System Context**: Utilizes local mobile databases (e.g., SQLite) to store task state locally, applying a synchronization queue that pushes payloads asynchronously to the main server once internet connectivity is restored.

### 14. Digital Tipping & Feedback
* **Core Value**: Receive and view monetary tips and specific compliments left by satisfied buyers after a successful delivery[cite: 5].
* **Expanded Definition**: A reward and morale-boosting interface. It highlights extra compensation and positive textual remarks received directly from buyers, distinct from standard delivery fees.
* **System Context**: Integrates with the platform's payment gateway for gratuity processing and queries the `Reviews` table specifically for feedback tagged to the courier.

### 15. SOS/Emergency Button
* **Core Value**: A quick-access safety feature that immediately alerts the Logistics team and local authorities in case of an accident or security threat on the road[cite: 5].
* **Expanded Definition**: A critical safety alert system. It provides a rapid way for drivers to signal distress. As noted, the primary utility lies in internal alerting (notifying the logistics/admin team) rather than complex direct integrations with local authorities[cite: 5].
* **System Context**: Triggers high-priority webhooks or push notifications to a centralized admin/dispatch dashboard, transmitting the courier's last known GPS coordinates and active task ID.

### 16. Earnings & Goal Tracker
* **Core Value**: A visual tracker where couriers can set daily or weekly income goals and monitor their progress based on completed runs and tips[cite: 5].
* **Expanded Definition**: A personal financial planning and motivation tool. It allows riders to set monetary targets and visually track their trajectory. This feature is modular and can be implemented or deprecated depending on specific academic or project requirements[cite: 5].
* **System Context**: A frontend-heavy visualization feature relying on simple database operations to store the `Goals` integers, plotting them against aggregation queries from the courier's daily/weekly earnings.