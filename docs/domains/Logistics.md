---
model: Logistics
type: Domain Context
purpose: Shared Logistics workflow and implementation context
version: 1.2
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
→ assigned
→ picked_up
→ in_transit
→ out_for_delivery
→ delivered
```

Its Logistics-facing meanings are deliberately broad: `ready_for_pickup` is Seller preparation complete, `assigned` is Logistics receipt/acceptance at the hub, and `picked_up` is final-mile Courier pickup from the hub.

Current COD placement skips `pending_payment`: the Order starts at `placed` with `payment_status = pending`. The Customer's selected eligible Logistics organization is retained in the future fulfillment context; Logistics may operate only Orders selected for its organization and may not silently replace the provider.

Detailed physical milestones belong to a separate Shipment/Delivery Task contract and must not be added to `orders.status` without an approved migration:

```text
awaiting_seller_pickup
→ seller_pickup_assigned
→ seller_pickup_accepted
→ picked_up_from_seller
→ received_at_hub
→ sorted_at_hub
→ in_transfer
→ dispatched_from_hub
→ delivery_assigned
→ delivery_accepted
→ picked_up_from_hub
→ in_transit
→ out_for_delivery
→ delivered
```

## Physical delivery flow

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
→ Logistics transfers and dispatches it (`in_transfer` → `dispatched_from_hub`)
→ Logistics assigns a final-mile Courier (`delivery_assigned`)
→ final-mile Courier accepts (`delivery_accepted`)
→ Courier picks up from the hub (`picked_up_from_hub`)
→ Courier travels and delivers (`in_transit` → `out_for_delivery`)
→ Courier completes delivery (`delivered`)
```

The first-mile and final-mile movements are separate task legs, even if the same Courier performs both. Each handoff requires its own assignment, actor, timestamp, location, and scan/event record. The MVP has no alternate hub or sub-hub branch.

## Core features

### 1. Dashboard

- **Core value:** View Seller-confirmed parcels that require Logistics attention.
- **Definition:** A secure, organization- and sole-hub-scoped queue for Orders whose selected Logistics organization is this organization. It covers Seller `ready_for_pickup` handoffs and, once the operational shipment schema exists, later receipt, sorting, transfer, dispatch, and assignment work.
- **System context:** Read-only aggregation over authoritative Order/Shipment/Delivery Task records. Counts, rows, filters, caches, and events must never cross Logistics organizations or imply that assignment is physical pickup.
- The current protected authentication and dashboard scaffold exists; the operational parcel queue remains dependent on the deferred shipment/task schema.

Subscription status is not a dashboard or operational gate in the MVP. Billing, provider, subscription records, and enforcement remain deferred; an approved active Logistics account with its sole hub is sufficient for current access.

### 2. Deploy Rider

- **Core value:** Create and offer first-mile pickup work and select eligible Couriers for first-mile or final-mile delivery.
- **Definition:** After Seller `ready_for_pickup`, an authorized account in the selected Logistics organization creates at most one active first-mile task when none exists and offers/assigns it to an eligible Courier. Retried requests return the existing task. After hub dispatch, Logistics owns final-mile eligibility and idempotent `delivery_assigned` creation.
- **System context:** Use the authoritative Customer checkout destination snapshot and Courier availability/capacity data. A separately approved, provider-neutral route/distance service may provide suggestions; Aisley remains authoritative for eligibility, organization/hub scope, and assignment. A Courier's acceptance never grants assignment authority.

### 3. Update Status

- **Core value:** Recover a valid parcel state when scanning automation fails.
- **Definition:** Allow authorized Logistics personnel to perform validated manual transitions such as `received_at_hub`, `sorted_at_hub`, `in_transfer`, or `dispatched_from_hub` when operational evidence exists.
- **System context:** A shared backend transition service validates current state, sole-hub ownership, actor authority, idempotency, and immutable history. This is not free-form editing and must not fabricate a Courier pickup or proof of delivery.

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
- **System context:** QR scans resolve authoritative Shipment/Delivery Task records. Logistics does not rewrite the frozen waybill, and a scan alone never advances custody.

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
- Reservation conversion/release is owned by the shared fulfillment contract: an accepted cancellation/rejection before `picked_up_from_seller` releases the exact reservation once, while first-mile pickup commits it once. Post-pickup return/refund/partial-fulfillment behavior is deferred.
- Subscription status does not gate MVP access or parcel operations; subscription enforcement requires a separate approved policy.
- Status transitions are validated, transactional, idempotent, and append immutable history; notification or map-provider failure must not roll back a committed logistics decision.
- Customer/Seller PII, payment credentials, private registration evidence, raw storage paths, and unrestricted Courier location history are excluded from Logistics operational DTOs.

## Deferred operational data

The current schema implements Logistics identity, organization, sole hub, and Courier affiliation. Shipment/Parcel/Waybill/Scan/Delivery Task, assignment, proof-of-delivery, availability, capacity, and earnings tables remain deferred. Future migrations must preserve the one-organization/one-hub invariant, immutable Seller-selected provider context, one shared waybill, and string-backed status columns with PHP enum casts. Subscription billing, records, and enforcement are also deferred.

## Shared contracts

- `docs/requirements.md` — high-level Logistics responsibilities.
- `docs/workspace.md` — workflow and canonical status flow.
- `docs/schema.md` — implemented foundation and deferred Shipment/Delivery Task vocabulary.
- `docs/features/logistics/*/specs.md` — feature-specific implementation contracts.
