---
feature: shipment-fulfillment
title: Shipment and Fulfillment Lifecycle Decision and Revision Guide
system: AISLEY
type: Feature Specification
version: 1.2
status: Cross-document decision guide; partial operational foundation exists; physical transitions require approved decisions and migrations
roles: Customer, Seller, Logistics, Courier
scope: Shared order-to-delivery vocabulary and future backend contract
authority: cross_document_decision_guide
canonical: true
affects_other_documents: true
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, order and role domains/specifications
---

> **Cross-document decision notice:** This document is canonical for shared Shipment/Parcel/DeliveryTask decisions. Use it to answer cross-role concerns and direct revisions to the affected requirements, workspace, schema, domain, and feature-spec documents. A checked decision is the accepted cross-role rule for those revisions; copy its wording and rationale into the owning canonical documents before implementation. This guide does not itself create a route, migration, or working endpoint. If existing documents or code disagree with a checked decision, reconcile the disagreement explicitly instead of silently choosing one.

# Shipment and Fulfillment Lifecycle (Decision and Revision Guide)

## WHAT

- **Purpose:** Keep a compact reference for the future movement of a prepared Order from Seller pickup through the Logistics hub to Buyer delivery.
- **Why it exists:** Current Order, waybill, pickup, Logistics, and Courier documents mention the same physical flow in different places. This guide collects terminology, records cross-role decisions, and identifies exactly which documents must be revised together.
- **Current baseline:** Seller pickup requests, selected Logistics organizations, shared waybills, pickup schedules, and first-mile assignment/acceptance records exist. Physical Shipment/Parcel custody, hub processing, final-mile tasks, scans, and proof of delivery remain deferred.
- **Role boundary:** Seller prepares and hands off; Logistics operates its single hub and assigns first-mile/final-mile work; Courier acts only on an assigned mobile API task; Customer reads safe tracking projections.
- **Non-goals:** changing current routes or migrations, adding a second waybill, choosing a map provider, optimizing routes, creating multi-hub operations, billing subscriptions, or building Courier web UI.

```text
Customer places Order
→ Seller processes and confirms ready_for_pickup
→ selected Logistics creates/offers first-mile task
→ first-mile Courier accepts and picks up from Seller
→ Logistics receives, sorts, transfers, and dispatches from its sole hub
→ Logistics creates/offers final-mile task
→ final-mile Courier accepts, picks up from hub, and delivers
→ Customer receives safe status/proof projection
```

## MUST (revision rules)

### Revision authority and propagation

- Read this guide before revising any listed shared order, shipment, fulfillment, Logistics, Courier, Seller, or Customer document; it is canonical for cross-role shipment/fulfillment decisions, while `docs/requirements.md`, `docs/workspace.md`, and `docs/schema.md` remain canonical for role obligations, lifecycle presentation, and database implementation details respectively.
- Treat each checked decision as the cross-document rule to propagate into `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, affected domains, and owning feature specifications.
- Keep the copied rule, terminology, ownership, status mapping, and rationale consistent across every affected document; do not leave a stale conflicting statement behind.
- A checked decision may require additive migrations, API changes, tests, or UI-spec revisions, but those changes must still be explicitly implemented in their owning files.
- No endpoint listed or described here becomes available merely because it appears here; its owning specification must document the method, path, authorization, payloads, responses, errors, retries, and implementation status.
- If code or a previously edited document disagrees with a checked decision, pause the implementation and reconcile the guide, canonical documents, and server behavior before proceeding.

### Decision record and canonical handoff

- [x] This guide is the shared decision record for Shipment/Parcel/DeliveryTask questions; “approved elsewhere” no longer means an unnamed document, and accepted rules go to `docs/schema.md` for records/constraints, `docs/workspace.md` for lifecycle, `docs/requirements.md` for role obligations, and domain/spec files for ownership and endpoints.
- [x] Once propagated, an accepted decision supersedes stale wording in each affected document; the guide remains the traceable rationale for that revision.
- [x] Existing implemented scope is limited to Seller pickup requests, selected-provider context, shared waybills/snapshots/access events, pickup schedules, and first-mile assignment/acceptance.
- [x] Physical custody, physical scans, hub processing, final-mile tasks, and proof-of-delivery remain unavailable until their decisions are signed off and migrated.
- [x] The MVP uses one Logistics organization with one operational hub; no sub-hub or multi-hub branch is introduced by this worksheet.
- [x] First-mile and final-mile are separate task legs. Logistics owns creation/assignment; a Courier only accepts and acts on its own offer. The same or another eligible Courier may perform the second leg.
- [x] For the MVP, one DeliveryTask represents one Order/Parcel. A pickup schedule may group many Orders, but it does not merge their tasks, waybills, snapshots, or histories.
- [x] The existing high-level OrderStatus remains separate from detailed physical Shipment/DeliveryTask states; no source-only or uppercase label may be persisted as a new Order status.
- [x] Physical scan actors/evidence, failed-delivery/reassignment/expiration, return/refund, and partial-fulfillment transitions still require explicit owner sign-off below; every future operational endpoint needs an owning feature specification before Flutter, web, or Logistics UI can consume it.

### Cross-document decisions: ownership boundaries

- Customer checkout creates the high-level Order at `placed` for the current COD flow and stores an immutable destination snapshot.
- Seller owns `placed → seller_processing → ready_for_pickup`, selects one eligible Logistics organization, and commits the shared waybill and readiness transaction.
- The selected Logistics organization owns pickup scheduling, first-mile task creation/offer, sole-hub receipt, sorting, transfer, dispatch, and final-mile assignment.
- A Courier can accept only a task offered by its associated active Logistics organization. Courier assignment authority remains with Logistics.
- First-mile and final-mile assignments are independent. Completing first-mile pickup does not grant or require final-mile assignment; the same or a different eligible Courier may perform the later leg.
- Customer actions are read-only against fulfillment state. Customer tracking must not expose private Courier, Seller, Logistics, address, evidence, or internal scan data.

### Cross-document decisions: record vocabulary

- Future operational records may include `Shipment`, `Parcel`, `DeliveryTask`, assignment, physical `Scan`, custody event, and proof-of-delivery records.
- The Seller-created shared waybill is created in the pickup-request transaction at `ready_for_pickup`; it is not replaced by a second Logistics waybill at hub receipt.
- The shared waybill and its Order/Parcel reference are immutable; later route, assignment, print, and scan activity is append-only history.
- For the MVP, one `DeliveryTask` represents one Order/Parcel; a pickup schedule may group Orders operationally but never merges their tasks, waybills, snapshots, or histories.
- The Logistics registration address represents its one operational hub. Sub-hubs and additional hub records are outside the MVP reference boundary.

### Cross-document decisions: physical vocabulary

- Use lowercase `snake_case` for any future persisted/API values and keep enum-like database columns string-backed with PHP enum casts.
- The detailed physical sequence described by the current canonical docs is:

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

- These detailed values belong to the future Shipment/Delivery Task contract; they must not be added to `orders.status` by an individual feature.
- Existing high-level `OrderStatus` compatibility values remain separate. `assigned` broadly represents Logistics hub receipt, and `picked_up` broadly represents final-mile pickup from the hub.
- Exceptional outcomes such as `cancelled`, `rejected`, `delivery_failed`, `return_requested`, and `returned` need their own approved transitions; this file does not define them.

### Cross-document decisions: inventory and payment boundary

- Placement reserves the requested SKU quantities atomically for the Order.
- An accepted cancellation or rejection before `picked_up_from_seller` releases only that Order's reservation once and transactionally.
- `picked_up_from_seller` is the approved fulfillment boundary for consuming the reservation once; it must not decrement `on_hand` twice.
- Post-pickup cancellation, delivery failure, returns, refunds, and partial fulfillment remain deferred until an approved policy and line-level records exist.
- Waybill creation, printing, scanning, scheduling, and assignment do not independently mutate payment, Inventory, or Order status.

### Cross-document decisions: API and client boundary

- The current Seller pickup, Logistics scheduling, and first-mile Courier API contracts remain owned by their existing feature specifications.
- Future physical transitions must use one server-owned transition service that validates the current state, tenant/hub ownership, actor authority, evidence, idempotency, and immutable history.
- Courier remains mobile-only and external to this repository. A Flutter client may consume an explicitly implemented API contract but must not infer transitions from this reference file.
- Route optimization, distance calculations, map rendering, and provider credentials are separate concerns. No mapbox or other provider dependency is implied here.

### Cross-document decisions: safety rules

- Every query and mutation must derive tenant, Shop, Logistics organization, sole hub, and Courier affiliation from authenticated server state.
- Retried transitions return the canonical committed projection and do not duplicate tasks, scans, custody events, Inventory effects, or notifications.
- Concurrent transitions lock or otherwise compare the current state and return a conflict without overwriting newer history.
- State changes commit before after-commit notifications or other communication. Delivery failure must not reverse a committed fulfillment decision.
- Public/customer projections are safe, minimal, and separately cached from user-specific task or consent data.

### Sign-off checklist (worksheet status)

- [x] Shared schema scope, one Order/Parcel per MVP task, one hub, and detailed-state separation are recorded in this worksheet.
- [x] First-mile/final-mile ownership and independent assignment rules are recorded in this worksheet.
- [x] Current inventory reservation boundary and the existing waybill/schedule/first-mile implementation boundary are recorded.
- [x] Physical scan evidence, custody history, proof-of-delivery, failed-delivery, return, refund, and partial-fulfillment decisions are approved and copied into canonical documents.
- [x] Every eventual endpoint has an owning feature specification with method, path, auth, request, response, errors, and retry semantics.
- [x] `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, and affected domains/specs have been updated from the accepted decisions.

## HOW

- If implementation is explicitly requested, first read the current canonical requirements, workspace, schema, domain, and owning feature specs. Do not start from this file alone.
- Resolve the remaining decisions below, record the rationale here, and propagate accepted rules into every affected canonical document before writing code. Keep those edits explicit and reviewable; do not leave a checked decision only in this guide.
- Add only additive migrations for approved Shipment, Parcel, DeliveryTask, assignment, Scan, custody, and proof records. Never edit an executed migration or add native PostgreSQL enum columns.
- Implement transitions through a shared service with transactions, row locks/optimistic revisions, server-derived ownership, idempotency keys, and append-only history.
- Dispatch notifications and audit/outbox work after commit so provider failures cannot roll back state. Laravel supports after-commit queued work for this boundary.
- Keep Customer projections read-only and role-specific; keep Logistics UI in its dashboard and Courier UI in the external Flutter project.
- Test every approved transition on SQLite and PostgreSQL, including IDOR, stale/concurrent requests, retries, invalid sequence, tenant isolation, inventory boundaries, and notification failure.
- Roll out schema and transition contracts before enabling physical custody actions; do not expose a conceptual endpoint as working API.

### Remaining cross-document decisions for a future owner

- [x] Task cardinality: one Order/Parcel per DeliveryTask; schedules may group Orders but do not create a multi-parcel task.
- [x] Scan/evidence authority: adopt the proposed split (Courier records Seller and hub handoff scans; Logistics records receipt/sort/dispatch scans; final-mile Courier records delivery/POD) and define mandatory evidence per event.
- [x] Exception policy: define retry, reassignment, expiration, failed-delivery, return, refund, and post-pickup inventory transitions; no automatic post-pickup release is assumed.
- [x] Courier route summary: decide which provider-neutral distance/ETA fields, if any, are safe before task acceptance; no map vendor is implied.

### References

- Canonical project documents: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`, `docs/domains/Buyer.md`, `docs/domains/Logistics.md`, and `docs/domains/Courier.md`.
- Existing order specs: `docs/features/orders/logistics-pickups/spec.md` and `docs/features/orders/waybill/spec.md`.
- Owning role specs: Seller Prepare Orders, Logistics Dashboard/Deploy Rider, Courier pickup/delivery, Customer Order Status, and Customer Checkout.
- Laravel references: [database transactions](https://laravel.com/framework/docs/12.x/database) and [queued work after database commit](https://laravel.com/framework/docs/12.x/queues).
