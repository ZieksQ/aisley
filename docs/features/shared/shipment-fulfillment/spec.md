---
feature: shipment-fulfillment
title: Shipment and Fulfillment Lifecycle (Reference Only)
system: AISLEY
type: Feature Specification
version: 1.0
status: Deferred reference outline; no operational implementation authorized
roles: Customer, Seller, Logistics, Courier
scope: Shared order-to-delivery vocabulary and future backend contract
authority: reference_only
canonical: false
affects_other_documents: false
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, order and role domains/specifications
---

> **Isolation notice:** This is a standalone remainder/reference document. It is not a source of truth, dependency gate, migration order, or implementation authorization. It must not modify, supersede, or create requirements in any other file or feature specification. If it conflicts with `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, or an owning feature spec, those canonical documents win. Consult this file only when a developer explicitly asks for shipment/fulfillment context.

# Shipment and Fulfillment Lifecycle (Reference Only)

## WHAT

- **Purpose:** Keep a compact reference for the future movement of a prepared Order from Seller pickup through the Logistics hub to Buyer delivery.
- **Why it exists:** Current Order, waybill, pickup, Logistics, and Courier documents mention the same physical flow in different places. This file collects terminology for developer orientation without becoming an additional contract.
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

## MUST (reference-only; not normative)

### Document isolation

- Treat every statement in this file as provisional reference material, even when it repeats a rule from another document.
- Do not use this file to justify changing a model, migration, enum, endpoint, UI, test, cache, notification, or role boundary.
- Do not add links from canonical documents to this file as a prerequisite. A developer may copy an approved rule into its owning document only after an explicit project decision.
- Do not mark another specification implemented, deferred, or blocked because of this file.
- No endpoint listed or described here is available merely because it appears here; the owning specification must document and implement it.

### Reference ownership boundaries

- Customer checkout creates the high-level Order at `placed` for the current COD flow and stores an immutable destination snapshot.
- Seller owns `placed → seller_processing → ready_for_pickup`, selects one eligible Logistics organization, and commits the shared waybill and readiness transaction.
- The selected Logistics organization owns pickup scheduling, first-mile task creation/offer, sole-hub receipt, sorting, transfer, dispatch, and final-mile assignment.
- A Courier can accept only a task offered by its associated active Logistics organization. Courier assignment authority remains with Logistics.
- First-mile and final-mile assignments are independent. Completing first-mile pickup does not grant or require final-mile assignment; the same or a different eligible Courier may perform the later leg.
- Customer actions are read-only against fulfillment state. Customer tracking must not expose private Courier, Seller, Logistics, address, evidence, or internal scan data.

### Reference record vocabulary

- Future operational records may include `Shipment`, `Parcel`, `DeliveryTask`, assignment, physical `Scan`, custody event, and proof-of-delivery records.
- The existing shared waybill is created in the Seller pickup-request transaction at `ready_for_pickup`; it is not replaced by a second Logistics waybill at hub receipt.
- The shared waybill and its Order/Parcel reference are immutable; later route, assignment, print, and scan activity is append-only history.
- A pickup schedule may group Orders operationally, but this file does not approve task batching, parcel cardinality, capacity, or a different Order model.
- The Logistics registration address represents its one operational hub. Sub-hubs and additional hub records are outside the MVP reference boundary.

### Reference physical vocabulary

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

### Reference inventory and payment boundary

- Placement reserves the requested SKU quantities atomically for the Order.
- An accepted cancellation or rejection before `picked_up_from_seller` releases only that Order's reservation once and transactionally.
- `picked_up_from_seller` is the proposed fulfillment boundary for consuming the reservation once; it must not decrement `on_hand` twice.
- Post-pickup cancellation, delivery failure, returns, refunds, and partial fulfillment remain deferred until an approved policy and line-level records exist.
- Waybill creation, printing, scanning, scheduling, and assignment do not independently mutate payment, Inventory, or Order status.

### Reference API and client boundary

- The current Seller pickup, Logistics scheduling, and first-mile Courier API contracts remain owned by their existing feature specifications.
- Future physical transitions must use one server-owned transition service that validates the current state, tenant/hub ownership, actor authority, evidence, idempotency, and immutable history.
- Courier remains mobile-only and external to this repository. A Flutter client may consume an explicitly implemented API contract but must not infer transitions from this reference file.
- Route optimization, distance calculations, map rendering, and provider credentials are separate concerns. No mapbox or other provider dependency is implied here.

### Reference safety rules

- Every query and mutation must derive tenant, Shop, Logistics organization, sole hub, and Courier affiliation from authenticated server state.
- Retried transitions return the canonical committed projection and do not duplicate tasks, scans, custody events, Inventory effects, or notifications.
- Concurrent transitions lock or otherwise compare the current state and return a conflict without overwriting newer history.
- State changes commit before after-commit notifications or other communication. Delivery failure must not reverse a committed fulfillment decision.
- Public/customer projections are safe, minimal, and separately cached from user-specific task or consent data.

### Reference checklist (not approval)

- [x] Shared Shipment/Parcel/DeliveryTask schema and transition authority are explicitly approved elsewhere.
- [x] First-mile and final-mile task ownership, acceptance, cancellation, and reassignment rules are approved elsewhere.
- [x] Physical scan evidence, custody history, proof-of-delivery, failed-delivery, return, and refund contracts are approved elsewhere.
- [x] Order-level versus line-level fulfillment and reservation effects are approved elsewhere.
- [x] Every eventual endpoint has an owning feature specification with method, path, auth, request, response, errors, and retry semantics.

## HOW

- If implementation is explicitly requested, first read the current canonical requirements, workspace, schema, domain, and owning feature specs. Do not start from this file alone.
- Reconcile approved transitions in the canonical documents before writing code; this reference file does not get updated as a side effect of implementation unless separately requested.
- Add only additive migrations for approved Shipment, Parcel, DeliveryTask, assignment, Scan, custody, and proof records. Never edit an executed migration or add native PostgreSQL enum columns.
- Implement transitions through a shared service with transactions, row locks/optimistic revisions, server-derived ownership, idempotency keys, and append-only history.
- Dispatch notifications and audit/outbox work after commit so provider failures cannot roll back state. Laravel supports after-commit queued work for this boundary.
- Keep Customer projections read-only and role-specific; keep Logistics UI in its dashboard and Courier UI in the external Flutter project.
- Test every approved transition on SQLite and PostgreSQL, including IDOR, stale/concurrent requests, retries, invalid sequence, tenant isolation, inventory boundaries, and notification failure.
- Roll out schema and transition contracts before enabling physical custody actions; do not expose a conceptual endpoint as working API.

### Open questions for a future owner

- Is a Delivery Task always one Order/Parcel, or may Logistics intentionally batch multiple parcels into one task?
- Which actor records each physical scan, and what evidence is mandatory at each handoff?
- What are the approved retry, reassignment, expiration, failed-delivery, return, and refund transitions?
- Which safe route/distance summary, if any, is returned to a Courier before task acceptance?

### References

- Canonical project documents: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`, `docs/domains/Buyer.md`, `docs/domains/Logistics.md`, and `docs/domains/Courier.md`.
- Existing order specs: `docs/features/orders/logistics-pickups/spec.md` and `docs/features/orders/waybill/spec.md`.
- Owning role specs: Seller Prepare Orders, Logistics Dashboard/Deploy Rider, Courier pickup/delivery, Customer Order Status, and Customer Checkout.
- [Laravel database transactions](https://laravel.com/framework/docs/12.x/database)
- [Laravel queued work after database commit](https://laravel.com/framework/docs/12.x/queues)
