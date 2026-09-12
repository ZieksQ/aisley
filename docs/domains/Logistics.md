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

Its current Logistics-facing meanings are deliberately broad: `ready_for_pickup` is Seller preparation complete and `picked_up` is the high-level projection of an explicit first-mile Courier confirmation from the Seller. `assigned` remains reserved for a later Logistics/final-mile assignment contract. The detailed `picked_up_from_seller` task event remains authoritative proof of custody.

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
→ Logistics views/scans the Seller-created shared waybill through the immutable Order/Parcel reference
→ Logistics sorts it (`sorted_at_hub`)
→ Logistics dispatches the sorted parcel (`dispatched_from_hub`)
→ Logistics assigns a final-mile Courier (`delivery_assigned`)
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
- **Definition:** A secure, organization- and sole-hub-scoped queue for Orders whose selected Logistics organization is this organization. It covers Seller `ready_for_pickup` handoffs and, once the operational shipment schema exists, later receipt, sorting, transfer, dispatch, and assignment work. Rejected offers remain visible for re-offer; unfinished work may show informationally as `stale` without automatic cancellation or reassignment.
- **System context:** Read-only aggregation over authoritative Order/Shipment/Delivery Task records. Counts, rows, filters, caches, and events must never cross Logistics organizations or imply that assignment is physical pickup.
- Courier-submitted waybill QR/reference scans and handoff evidence are validated and recorded by an authorized Logistics account. The event preserves the Courier who performed the physical action, the Logistics account that recorded it, and the event timestamp; a scan or waybill access event alone never advances custody.
- The current protected authentication and dashboard scaffold exists; the operational parcel queue remains dependent on the deferred shipment/task schema.

Subscription status is not a dashboard or operational gate in the MVP. Billing, provider, subscription records, and enforcement remain deferred; an approved active Logistics account with its sole hub is sufficient for current access.

### 2. Deploy Rider

- **Core value:** Create and offer first-mile pickup work and select eligible Couriers for first-mile or final-mile delivery.
- **Definition:** After Seller `ready_for_pickup`, an authorized account in the selected Logistics organization creates at most one active first-mile task when none exists and offers/assigns it to an eligible Courier. Retried requests return the existing task. After hub dispatch, Logistics owns final-mile eligibility and idempotent `delivery_assigned` creation. A Courier rejection records task-level `rejected` without changing the Order, and Logistics may re-offer the same task to another eligible Courier.
- **System context:** Use the authoritative Customer checkout destination snapshot and Courier availability/capacity data. A separately approved, provider-neutral route/distance service may provide suggestions; authorized Courier task projections may include `distance_km` and `estimated_duration_minutes` as advisory context. Aisley remains authoritative for eligibility, organization/hub scope, and assignment. A Courier's acceptance never grants assignment authority. An unfinished task may be informationally `stale` and is not automatically cancelled or reassigned in the MVP.

### 3. Update Status

- **Core value:** Recover a valid parcel state when scanning automation fails.
- **Definition:** Allow authorized Logistics personnel to validate Courier-submitted scans/evidence or perform validated manual transitions such as `received_at_hub`, `sorted_at_hub`, or `dispatched_from_hub` when operational evidence exists. Internal `in_transfer` execution remains deferred in the MVP.
- **System context:** A shared backend transition service validates current state, sole-hub ownership, actor authority, idempotency, and immutable history. Logistics is the authoritative recorder of the event while preserving the Courier who performed the physical action, when applicable. This is not free-form editing and must not fabricate a Courier pickup or proof of delivery.

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
- **Definition:** Track vehicle type, plate, capacity, status, and maintenance data used for Courier eligibility and operational planning.
- **System context:** Fleet records are organization-scoped and may constrain final-mile assignment; they do not change parcel status themselves.

### 7. Waybill

- **Core value:** Print order/parcel details.
- **Definition:** View, download, print, and scan the shared waybill created when the Seller requested pickup, using its stable opaque reference and authorized QR.
- **Immutability:** The waybill identifier and Order/Parcel link are immutable from creation. Routing and Courier assignments may change before `picked_up_from_hub` only through append-only events; after that pickup, final-mile assignment and custody history cannot be overwritten. Printing or reprinting is a document/audit operation and must not silently advance status or expose unnecessary Customer data.
- **System context:** QR/reference scans resolve authoritative Shipment/Delivery Task records. Courier-submitted scans/evidence are validated and recorded by Logistics, preserving performing-Courier and recording-Logistics actors, timestamp, and safe evidence/reference metadata. Logistics does not rewrite the frozen waybill, and a scan or waybill access event alone never advances custody.

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

The current schema implements Logistics identity, organization, sole hub, Courier affiliation, Seller pickup requests, shared waybills, pickup schedules, first-mile assignment/acceptance, and the additive Shipment/Parcel/DeliveryTask operational records. Logistics can record hub receipt/sorting/dispatch, offer/re-offer independent final-mile tasks, validate QR hub-pickup and delivery evidence, and commit final delivery through the shared transition service. Availability, capacity, earnings, photo/signature media, route/location telemetry, returns, and exceptional recovery remain deferred. Operational records preserve the one-organization/one-hub invariant, immutable Seller-selected provider context, one shared waybill, append-only actor/evidence history, and string-backed status columns with PHP enum casts. Subscription billing, records, and enforcement are also deferred.

## Shared contracts

- `docs/requirements.md` — high-level Logistics responsibilities.
- `docs/workspace.md` — workflow and canonical status flow.
- `docs/schema.md` — implemented foundation, deployed Shipment/Delivery Task records, and deferred extensions.
- `docs/features/logistics/*/specs.md` — feature-specific implementation contracts.

**Current/future boundary:** `ConfirmFirstMilePickup` remains the compatibility writer for the accepted Courier's Seller handoff and Inventory fulfillment, then idempotently bridges shared physical records without replaying stock. Hub and final-mile state changes use the Logistics-authoritative `FulfillmentTransitionService`; advanced proof media, route/location telemetry, and exceptional recovery remain future extensions.
