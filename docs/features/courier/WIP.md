---
role: Courier/Rider
system: AISLEY
type: Future Feature Plan
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Delivery Exception Handling
source_coverage: Courier.md, app.md
---

# Courier Future Feature Plan

- Features that seems useful but not necessary for now
- Will be implemented in the future if needed

## Performance Metrics

- **Core Value**: Track personal ratings, successful delivery rates, and average completion times to qualify for rider incentives[cite: 5].
- **Expanded Definition**: A quality assurance dashboard. It monitors the courier's efficiency and customer satisfaction scores. Even if specific incentive structures are currently undefined, this tracking forms the necessary data foundation for any future reward or tier programs[cite: 5].
- **System Context**: Aggregates and averages data across the `Reviews` table (for buyer ratings) and timestamps on delivery tasks (for speed and success rates).

## Offline Mode

- **Core Value**: Download delivery routes and order details for offline access when delivering to areas with poor cellular network coverage[cite: 5].
- **Expanded Definition**: A resilience feature ensuring uninterrupted operations. It pre-caches necessary job data on the device so the courier can continue scanning and marking deliveries even when entering mobile dead zones.
- **System Context**: Utilizes local mobile databases (e.g., SQLite) to store task state locally, applying a synchronization queue that pushes payloads asynchronously to the main server once internet connectivity is restored.

## Digital Tipping & Feedback

- **Core Value**: Receive and view monetary tips and specific compliments left by satisfied buyers after a successful delivery[cite: 5].
- **Expanded Definition**: A reward and morale-boosting interface. It highlights extra compensation and positive textual remarks received directly from buyers, distinct from standard delivery fees.
- **System Context**: Integrates with the platform's payment gateway for gratuity processing and queries the `Reviews` table specifically for feedback tagged to the courier.

## SOS / Emergency Button

- **Core Value**: A quick-access safety feature that immediately alerts the Logistics team and local authorities in case of an accident or security threat on the road[cite: 5].
- **Expanded Definition**: A critical safety alert system. It provides a rapid way for drivers to signal distress. As noted, the primary utility lies in internal alerting (notifying the logistics/admin team) rather than complex direct integrations with local authorities[cite: 5].
- **System Context**: Triggers high-priority webhooks or push notifications to a centralized admin/dispatch dashboard, transmitting the courier's last known GPS coordinates and active task ID.

## Earnings & Goal Tracker

- **Core Value**: A visual tracker where couriers can set daily or weekly income goals and monitor their progress based on completed runs and tips[cite: 5].
- **Expanded Definition**: A personal financial planning and motivation tool. It allows riders to set monetary targets and visually track their trajectory. This feature is modular and can be implemented or deprecated depending on specific academic or project requirements[cite: 5].
- **System Context**: A frontend-heavy visualization feature relying on simple database operations to store the `Goals` integers, plotting them against aggregation queries from the courier's daily/weekly earnings.
