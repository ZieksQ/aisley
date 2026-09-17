---
model: Logistics
type: Domain Context
purpose: Shared Logistics workflow and implementation context
version: 1.3
status: Revised — aligned with the approved order/Logistics flow and implemented foundation
---

# Logistics Model Context

## Overview

Logistics is Aisley's first-party parcel-operations role. It operates one organization and exactly one operational hub/sorting center in the MVP. The organization schedules first-mile pickup tasks for Seller-ready Orders addressed to it, views/scans their shared waybills, receives and sorts parcels, dispatches final-mile delivery, and monitors Courier tasks.

The Logistics web dashboard is separate from the Customer and Seller applications. Courier operations are consumed through the external mobile application; this repository does not build a Courier web UI.

## MVP organization and hub boundary

- Each Logistics organization has exactly one operational hub/sorting center.
- The Logistics registration address is the address of that sole operational hub/sorting center; no separate sub-hub address is collected. Where an exact pin is needed, the address follows the Customer Address Book flow: bundled PSGC cascading fields and manual fields are authoritative, optional Geoapify assists with suggestions/coordinates after **Pin location**, and Leaflet renders the interactive pin with Geoapify tiles. Mapbox is not used.
- The Logistics account operates the hub through the Logistics dashboard. The current foundation models one Logistics operating account per organization; staff/sub-accounts are deferred.
- Sub-hubs, additional hubs, hub selectors, and multi-hub transfers are out of scope for this MVP.
- Courier registration selects the Logistics organization. The server derives and scopes the Courier affiliation to that organization's sole hub; clients do not submit an arbitrary hub ID.

## Canonical status and lifecycle contract

Persisted and API status values use lowercase `snake_case`. PHP enum case names may use `PascalCase`, and UI labels are human-readable. Uppercase source terms such as `READY_FOR_PICKUP`, `AT_SORTING_CENTER`, and `IN_TRANSIT` are legacy/source wording, not canonical values.

The existing high-level `OrderStatus` remains the Customer-facing Order contract:

```text
pending_payment
→ placed
→ seller_processing
→ ready_for_pickup
→ picked_up
→ in_transit
→ out_for_delivery
→ delivered
```

Its Logistics-facing meanings are deliberately broad: `ready_for_pickup` is Seller preparation complete, `picked_up` projects explicit first-mile confirmation, and `assigned` projects a committed dispatch schedule/final-mile Courier offer. Detailed task events remain authoritative proof of custody.

Current COD placement skips `pending_payment`: the Order starts at `placed` with `payment_status = pending`. The Seller's selected eligible Logistics organization is retained in the future fulfillment context; Logistics may operate only Orders selected for its organization and may not silently replace the provider.

Detailed physical milestones belong to a separate Shipment/Delivery Task contract and must not be added to `orders.status` without an approved migration:

```text
awaiting_seller_pickup
→ seller_pickup_assigned
→ seller_pickup_accepted
→ picked_up_from_seller
→ received_at_hub
→ sorted_at_hub
→ dispatched_from_hub
→ delivery_assigned
→ delivery_accepted
→ picked_up_from_hub
→ in_transit
→ out_for_delivery
→ delivered
```

Task-level `rejected` records an offered Courier's refusal and is not an `OrderStatus`; the same task may be re-offered to another eligible Courier without changing the Order. `stale` is an informational freshness condition for unfinished work, not a new high-level Order status, and it does not automatically cancel or reassign a task.

## Physical delivery flow

Internal `in_transfer` execution and automatic offer expiry are deferred. Sorting is required before dispatch; no synthetic transfer event or extra hub is introduced.

```text
Customer places the Order
→ Seller processes and prepares it
→ Seller confirms `ready_for_pickup`
→ selected Logistics organization creates and offers the first-mile Seller pickup task
→ first-mile Courier accepts the Seller pickup task
→ Courier picks up from Seller (`picked_up_from_seller`)
→ Courier transfers the parcel to the sole Logistics hub
→ Logistics receives and validates it (`received_at_hub`)
→ Logistics scans the Seller-created tracking ID/waybill through the immutable Order/Parcel reference
→ the current tenant sort plan checks the Buyer postal code and selects a standard lane or exception lane
→ Logistics synchronizes the result (`sorted_at_hub` for a match; received-custody hold for an exception)
→ the sorted parcel enters **Ready to dispatch**
→ Logistics schedules up to 15 parcels with one Courier; dispatch and per-parcel final-mile offers commit together (`dispatched_from_hub` → `delivery_assigned`)
→ final-mile Courier accepts (`delivery_accepted`)
→ Courier picks up from the hub (`picked_up_from_hub`)
→ Courier travels and delivers (`in_transit` → `out_for_delivery`)
→ Courier submits completion intent/proof; Logistics validates and the shared service commits `delivered`
```

The first-mile and final-mile movements are separate task legs, even if the same Courier performs both. Each deployed Delivery Task represents one Order/Parcel for one leg; a pickup schedule may group Orders but never merge their tasks, waybills, snapshots, or histories. Each handoff requires its own assignment, actor, timestamp, location, and scan/event record. If an offered Courier rejects either leg, the task records task-level `rejected`, the Order remains unchanged, and Logistics may offer the same task to another eligible Courier. An unfinished task may be informationally `stale`; it is not automatically cancelled or reassigned in the MVP. The MVP has no alternate hub or sub-hub branch.

## Core features

Implemented hub-location capability: Logistics may confirm its actual sole-hub pin at registration or through Account Settings using the Customer/Seller PSGC/manual, intentional Geoapify assistance, and Leaflet. Laravel stores the complete latitude/longitude pair on the linked hub Address. Text-only fallback remains available with an explicit unpinned state. Same-premises corrections are recorded with previous/new coordinates, reason, actor, and UTC time; coordinate fingerprints change for future route/distance calculations while committed operational snapshots remain unchanged. Physical relocation remains separately controlled.

### 1. Dashboard

- **Core value:** View Seller-confirmed parcels that require Logistics attention.
- **Definition:** A secure, organization- and sole-hub-scoped queue for already-created shared Shipment records whose selected Logistics organization is this organization. It covers receipt, sorting, dispatch, final-mile assignment, and evidence/completion review. Rejected offers remain visible for re-offer; unfinished work exposes last activity without inventing a stale deadline or automatically cancelling/reassigning.
- **System context:** Read-only aggregation over authoritative Order/Shipment/Delivery Task records. Counts, rows, filters, caches, and events must never cross Logistics organizations or imply that assignment is physical pickup.
- Courier-submitted waybill QR/reference scans and handoff evidence are validated and recorded by an authorized Logistics account. The event preserves the Courier who performed the physical action, the Logistics account that recorded it, and the event timestamp; a scan or waybill access event alone never advances custody.
- The protected authentication and hub scaffold remain available at `/dashboard`; the deployed `/dashboard/queue` projection and `/operations` Hub operations page consume the additive Shipment/Parcel/DeliveryTask schema. Advanced ranking, realtime, and stale-threshold policy remain deferred.

Subscription status is not a dashboard or operational gate in the MVP. Billing, provider, subscription records, and enforcement remain deferred; an approved active Logistics account with its sole hub is sufficient for current access.

### 2. Deploy Rider

- **Core value:** Create and offer first-mile pickup work and select eligible Couriers for first-mile or final-mile delivery.
- **Definition:** After Seller `ready_for_pickup`, an authorized account in the selected Logistics organization creates at most one active first-mile task when none exists and offers/assigns it to an eligible Courier. Retried requests return the existing task. After hub dispatch, Logistics owns final-mile eligibility and idempotent `delivery_assigned` creation. A Courier rejection records task-level `rejected` without changing the Order, and Logistics may re-offer the same task to another eligible Courier.
- **System context:** Use the authoritative Customer checkout destination snapshot and Courier availability/capacity data. A separately approved, provider-neutral route/distance service may provide suggestions; authorized Courier task projections may include `distance_km` and `estimated_duration_minutes` as advisory context. Aisley remains authoritative for eligibility, organization/hub scope, and assignment. A Courier's acceptance never grants assignment authority. An unfinished task may be informationally `stale` and is not automatically cancelled or reassigned in the MVP.

### 3. Update Status

- **Core value:** Recover a valid parcel state when scanning automation fails.
- **Definition:** Allow authorized Logistics personnel to validate Courier-submitted scans/evidence or perform validated manual transitions such as `received_at_hub`, `sorted_at_hub`, or `dispatched_from_hub` when operational evidence exists. Internal `in_transfer` execution remains deferred in the MVP.
- **System context:** A shared backend transition service validates current state, sole-hub ownership, actor authority, idempotency, and immutable history. Logistics is the authoritative recorder of the event while preserving the Courier who performed the physical action, when applicable. This is not free-form editing and must not fabricate a Courier pickup or proof of delivery.
- **Sorting boundary:** Normal hub sorting uses the dedicated offline-first **Sorting** workspace. The separate **Sort plan** page lets the tenant create one active plan, standard/exception lanes, printable lane labels, and exact four-digit Buyer postal-code mappings. One open sole-hub session snapshots up to 100 oldest received parcels; automatic scan sync resolves the tracking ID and current plan server-side, commits `sorted_at_hub` for a matched standard lane, and records a reviewable exception hold when the plan or routing data is missing. Hub operations retains evidence and recovery responsibilities rather than the normal sorting control.
- **Lane/dispatch boundary:** A lane identifies physical staging inside the sole hub. Shipment retains its standard lane/session independently of session closure; ready parcels dispatch by lane with immutable provenance and stale-assignment checks. Combining standard lanes requires explicit opt-in. Audited online moves are allowed before dispatch; exceptions remain held and do not block other ready session parcels. Hub pickup clears the live lane assignment while dispatch history remains intact.

### 4. Chat/Messaging

- **Core value:** Communicate with relevant users.
- **Definition:** Organization-scoped operational communication with Couriers, Sellers, or Buyers when an active parcel requires coordination.
- **System context:** Threads are linked to an authorized Order/Shipment/Delivery Task; private contact details and unrelated conversations are not exposed.

### 5. Account Management

- **Core value:** Maintain Logistics account and organization information.
- **Definition:** Manage the authenticated Logistics profile and the single organization's operational-hub details, subject to account and approval rules.
- **System context:** The server resolves `user → organization → sole hub`; clients cannot create or select another hub. Logistics access requires an active approved account and existing hub.

### 6. Vehicle Fleet Management

- **Core value:** Maintain the organization's Courier vehicle registry.
- **Definition:** Review the required type, plate, and private OR/CR supplied for each affiliated Courier's exactly one vehicle. Maintenance, vehicle history, and capacity values/units/matching are deferred.
- **Edit boundary:** After initial approval, Courier edits to type/plate/optional make/model and separate OR/CR replacements need no Logistics approval. The organization receives a durable informational notification and may view current data through its scoped Vehicles list/detail or the alert destination; it does not approve or reject the edit.
- **System context:** The registry is scoped through Courier affiliation to this organization's sole hub. Registration/application review remains compatible with the combined legacy document, while dedicated fleet editing and database cardinality hardening are implemented additively. Deferred capacity or maintenance must not create dispatch gates or alter parcel status.

### 7. Waybill

- **Core value:** Print order/parcel details.
- **Definition:** View, download, print, and scan the shared waybill created when the Seller requested pickup, using its immutable tracking ID, thin 1D Code 128 barcode, and authorized QR compatibility identifier.
- **Immutability:** The waybill identifier and Order/Parcel link are immutable from creation. Routing and Courier assignments may change before `picked_up_from_hub` only through append-only events; after that pickup, final-mile assignment and custody history cannot be overwritten. Printing or reprinting is a document/audit operation and must not silently advance status or expose unnecessary Customer data.
- **System context:** Tracking-ID/QR/reference scans resolve authoritative Shipment/Delivery Task records. Courier-submitted scans/evidence are validated and recorded by Logistics, preserving performing-Courier and recording-Logistics actors, timestamp, and safe evidence/reference metadata. Logistics does not rewrite the frozen waybill, and a scan or waybill access event alone never advances custody.

### 8. Zone/Territory Mapping

- **Core value:** Define delivery zones to support operational assignment.
- **Definition:** Configure organization-scoped final-mile areas and use them as optional eligibility/routing context.
- **System context:** Zone rules must not bypass Courier authorization, sole-hub scope, or server-side assignment validation. Map geometry/provider choices remain a separate feature decision.

### 9. Flexible Availability and Capacity Monitoring

- **Core value:** Show available Courier capacity without fixed shift scheduling.
- **Definition:** Surface online/available Couriers, active task load, and basic capacity against pending first-mile/final-mile work.
- **System context:** Availability is operational input, not assignment authority. It must be organization-scoped, current/freshness-aware, and safe when data is unavailable.

## Operational invariants

- Only an authenticated active Logistics account may operate its organization's sole hub.
- Every Order/Shipment/Delivery Task, Courier affiliation, waybill, scan, assignment, cache entry, and event must be resolved server-side to that organization and hub. A pickup is eligible only when its immutable Seller-selected Logistics organization is this organization.
- `delivery_assigned` is not `delivery_accepted`, and neither means `picked_up_from_hub`.
- First-mile pickup is `picked_up_from_seller`; final-mile hub pickup is `picked_up_from_hub`.
- First-mile and final-mile assignments are independent. Completing first-mile pickup does not require or automatically grant final-mile assignment; the same or a different eligible Courier may be selected by Logistics for the second leg.
- A Courier may reject an offered first-mile or final-mile task. The task records `rejected`, the Order remains unchanged, and Logistics may offer the same task to another eligible Courier. An unfinished task may be informationally `stale`; it is not automatically cancelled or reassigned.
- Reservation conversion/release is owned by the shared fulfillment contract: an accepted cancellation/rejection before `picked_up_from_seller` releases the exact reservation once, while first-mile pickup commits it once. Post-pickup return/refund/partial-fulfillment behavior is deferred.
- Subscription status does not gate MVP access or parcel operations; subscription enforcement requires a separate approved policy.
- Status transitions and evidence records are validated, transactional, idempotent, and append immutable history; notification, mapping, or communication failure must not roll back a committed Logistics decision.
- Customer/Seller PII, payment credentials, private registration evidence, raw storage paths, and unrestricted Courier location history are excluded from Logistics operational DTOs.

## Deferred operational data

The current schema implements Logistics identity, organization, sole hub, Courier affiliation, Seller pickup requests, shared waybills, pickup schedules, first-mile assignment/acceptance, additive Shipment/Parcel/DeliveryTask records, dedicated Sorting lanes/sessions/snapshot items/idempotent scans, and tenant-scoped sort plans with exact postal-code mappings. Logistics can record offline-first hub receipt and sorting, scheduled dispatch, independent final-mile offers, QR hub-pickup/delivery evidence, and final delivery through the shared transition service. Geocoding, postal ranges, handling containers, lane/vehicle capacity, multi-hub transfer, RFID/automation, returns, and exceptional recovery beyond sort holds remain deferred. Operational records preserve the one-organization/one-hub invariant, immutable Seller-selected provider context, one shared waybill/tracking ID, append-only custody history, and string-backed status columns with PHP enum casts. Subscription billing, records, and enforcement are also deferred.

## Shared contracts

- `docs/requirements.md` — high-level Logistics responsibilities.
- `docs/workspace.md` — workflow and canonical status flow.
- `docs/schema.md` — implemented foundation, deployed Shipment/Delivery Task records, and deferred extensions.
- `docs/features/logistics/*/specs.md` — feature-specific implementation contracts.

**Current/future boundary:** `ConfirmFirstMilePickup` remains the compatibility writer for the accepted Courier's Seller handoff and Inventory fulfillment, then idempotently bridges shared physical records without replaying stock. Hub and final-mile state changes use the Logistics-authoritative `FulfillmentTransitionService`; advanced proof media, route/location telemetry, and exceptional recovery remain future extensions.
