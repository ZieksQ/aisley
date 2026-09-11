---
feature: shipment-fulfillment
title: Shipment and Fulfillment Lifecycle Decision and Revision Guide
system: AISLEY
type: Feature Specification
version: 1.6
status: Cross-document decision and reconciliation guide; implemented foundation documented; physical schema/transitions and final sign-off pending
roles: Customer, Seller, Logistics, Courier
scope: Shared order-to-delivery vocabulary, decision record, and future backend contract
authority: cross_document_decision_guide
canonical: true
affects_other_documents: true
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/PROGRESS.md, order and role domains/specifications, src/api/database/migrations
---

> **Cross-document decision notice:** This document is the canonical decision and reconciliation record for shared Shipment/Parcel/DeliveryTask concerns; it is not a replacement for the implementation contracts in `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, the domain documents, or owning feature specifications. Use it to answer cross-role concerns and direct revisions to those files. A checked decision is the accepted cross-role rule for those revisions; copy its wording and rationale into the owning canonical documents before implementation. This guide does not itself create a route, migration, or working endpoint. If existing documents or code disagree with a checked decision, reconcile the disagreement explicitly instead of silently choosing one.

# Shipment and Fulfillment Lifecycle (Decision and Revision Guide)

## WHAT

- **Purpose:** Keep a compact reference for the future movement of a prepared Order from Seller pickup through the Logistics hub to Buyer delivery.
- **Why it exists:** Current Order, waybill, pickup, Logistics, and Courier documents mention the same physical flow in different places. This guide collects terminology, records cross-role decisions, and identifies exactly which documents must be revised together.
- **Current baseline:** Seller pickup requests, selected Logistics organizations, shared waybills, pickup schedules, first-mile assignment/acceptance, explicit pickup confirmation with Inventory fulfillment, and route manifests exist. Logistics-validated physical scans, shared Shipment/Parcel records, hub processing, final-mile tasks, and proof of delivery remain deferred.
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
- [x] Existing scope includes Seller pickup requests, selected-provider context, shared waybills, schedules, first-mile assignment/acceptance/confirmation, Inventory fulfillment, and route manifests.
- [x] Shared Shipment/Parcel custody and Logistics-validated scans, hub processing, final-mile tasks, and proof-of-delivery remain unavailable until the readiness questions below are answered and the additive migrations are deployed.
- [x] Each Logistics organization owns exactly one operational hub; no sub-hub or multi-hub branch is introduced by this worksheet.
- [x] First-mile and final-mile are separate task legs. Logistics owns creation/assignment; a Courier only accepts and acts on its own offer. The same or another eligible Courier may perform the second leg.
- [x] For the MVP, one DeliveryTask represents one Order/Parcel. A pickup schedule may group many Orders, but it does not merge their tasks, waybills, snapshots, or histories.
- [x] The existing high-level OrderStatus remains separate from detailed physical Shipment/DeliveryTask states; no source-only or uppercase label may be persisted as a new Order status.
- [x] Physical scan actors/evidence, failed-delivery/reassignment/expiration, return/refund, and partial-fulfillment decisions are recorded below; implementation questions remain in the readiness worksheet and every future operational endpoint still needs an owning feature specification before Flutter, web, or Logistics UI can consume it.

### Reconciliation register

In this register, `[x]` records an accepted decision or completed named correction. The sign-off checklist separately verifies propagation. Implementation and rollout require their own evidence. Do not begin physical operational implementation while a required propagation gate remains unchecked.

- [x] **Logistics-selection authority:** The Seller selects one eligible Logistics organization when committing the pickup request. Checkout remains provider-neutral; the Customer selects a shipping address, not a Logistics provider. Remove or rewrite the old Customer-selection wording in `docs/requirements.md` and `docs/workspace.md`.
- [x] **High-level status mapping:** `picked_up` is the high-level projection of first-mile `picked_up_from_seller`; `assigned` remains reserved for a future Logistics/final-mile assignment. Hub receipt, sorting, transfer, and dispatch are detailed physical milestones, not meanings of either high-level value.
- [x] **Implemented/deferred summaries:** Update `docs/domains/Seller.md`, `docs/domains/Buyer.md`, and `docs/features/seller/prepare-orders/spec.md` so Seller pickup selection, shared-waybill persistence, pickup scheduling, first-mile assignment/acceptance, and explicit pickup confirmation are identified as the implemented foundation. Keep physical Shipment/Parcel/Scan custody, hub operations, final-mile tasks, delivery, and proof-of-delivery deferred.
- [x] **Schema-ledger synchronization:** Reconcile `docs/schema.md` with the migration directory without renaming or editing executed migrations. Add the implemented low-stock-alert, wishlist, and Logistics profile-photo migrations that are missing from the ledger; correct its duplicate sequence numbers for the Courier pickup, Product Q&A, and route-manifest entries; and narrow its policy-consent row to the still-deferred global auth/session gate.
- [x] **Endpoint ownership paths:** The ownership table below uses the exact existing `spec.md`/`specs.md` paths. A route is usable only when that owning specification marks it implemented; a conceptual physical route remains unavailable until the shared schema and transition service pass the rollout gate.
- [x] **Legacy-reference audit:** Active canonical documents must not rely on the missing `app.md` or `docs/workflows.md`, old uppercase order values, or Mapbox assumptions. Draft and superseded specs may retain historical wording, but they must not be used as implementation authority until revised.
- [x] **Shared-policy ledger wording:** Update the deferred-schema table so implemented policy status/acceptance APIs are not described as wholly deferred; leave only global login/session/protected-action enforcement deferred.

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

- These detailed values belong to the future Shipment/Delivery Task contract; they must not be added to `orders.status` by an individual feature. Until the physical schema is migrated, treat this list as planned vocabulary rather than implemented database values.
- Existing high-level `OrderStatus` compatibility values remain separate. `picked_up` is the high-level projection of an explicit first-mile Seller handoff (`picked_up_from_seller`). `assigned` remains reserved for a later Logistics/final-mile assignment and does not represent hub receipt. Hub receipt, sorting, transfer, and dispatch are detailed future milestones.
- Task-level `rejected` and informational `stale` outcomes follow the exception decision below and do not write a new `orders.status` value. Customer cancellation and Seller rejection of eligible `placed` Orders are implemented. Post-pickup cancellation, `delivery_failed`, `return_requested`, and `returned` transitions remain deferred.

### Cross-document decisions: inventory and payment boundary

- Placement reserves the requested SKU quantities atomically for the Order.
- An accepted cancellation or rejection before `picked_up_from_seller` releases only that Order's reservation once and transactionally.
- `picked_up_from_seller` is the approved fulfillment boundary for consuming the reservation once; it must not decrement `on_hand` twice.
- Post-pickup cancellation, delivery failure, returns, refunds, and partial fulfillment remain deferred until an approved policy and line-level records exist.
- Waybill creation, printing, scanning, scheduling, and assignment do not independently mutate payment, Inventory, or Order status.

### Current implementation versus accepted target

**Current/future boundary:** `ConfirmFirstMilePickup` currently validates the accepted Courier task and commits Seller pickup, Order `picked_up`, and Inventory fulfillment without a separate Logistics review. The accepted target requires Courier evidence submission followed by Logistics validation and a server-owned transition. That target is not implemented. Its rollout must explicitly migrate the current confirmation contract, preserve existing confirmations and stock movements, and never replay pickup or fulfill stock twice.

### Cross-document decisions: API and client boundary

- The current Seller pickup, Logistics scheduling, and first-mile Courier API contracts remain owned by their existing feature specifications.
- Future physical transitions must use one server-owned transition service that validates the current state, tenant/hub ownership, actor authority, evidence, idempotency, and immutable history.
- Courier remains mobile-only and external to this repository. A Flutter client may consume an explicitly implemented API contract but must not infer transitions from this reference file.
- An authorized Courier may view the operational Order, parcel, waybill, pickup, destination, item, and delivery-instruction data needed for its offered or accepted task, plus provider-neutral `distance_km` and `estimated_duration_minutes`. Secrets, private evidence, raw storage paths, and unrelated personal data remain excluded.
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
- [x] The endpoint-ownership rule is recorded; each eventual endpoint still requires an owning feature specification with method, path, auth, request, response, errors, and retry semantics.
- [x] Provider-selection wording is consistent: Seller selection at pickup request is stated everywhere, and the stale Customer checkout-selection wording is removed.
- [x] High-level `picked_up`/`assigned` mapping is consistent everywhere: first-mile projection versus future final-mile assignment.
- [x] Seller/Buyer domain summaries and Seller Prepare Orders distinguish the implemented pickup/waybill/scheduling/first-mile foundation from deferred physical operations.
- [x] `docs/schema.md` migration ledger includes every repository migration, uses unique documentation sequence numbers, and describes only the global policy-consent gate as deferred.
- [x] Complete propagation of detailed schema columns/constraints, per-transition evidence/side effects, endpoint payloads, and the first-mile compatibility rollout into all owning specs. The selection, status, implementation summaries, and migration-ledger corrections are complete; this broader implementation gate remains open.

### Remaining technical details

- [x] Define exact Shipment/Parcel foreign keys, uniqueness, nullability, package measurement units/limits (or explicitly defer measurements), and creation/backfill timing in `docs/schema.md`.
- [x] Define the compatibility rollout from `first_mile_tasks`/`courier_pickup_confirmations` to shared tasks and Logistics validation without creating duplicate custody or Inventory effects.
- [x] Specify whether `in_transfer` is an internal sole-hub step and when it may be skipped; no inter-hub transfer is authorized.
- [x] Define re-offer transition from rejected state, any offer expiry window, and stale threshold without automatic task cancellation/reassignment.
- [x] Complete every transition's preconditions, evidence, transactional effects, retry projection, and conflict response in the owning API contract before exposing it.

### Implementation-readiness worksheet

Complete each unchecked question before creating physical operational migrations. A blank answer is an open contract decision; mark a question `[x]` only after the decision, owner, and affected canonical document are recorded. Keep detailed columns and constraints in `docs/schema.md`, lifecycle wording in `docs/workspace.md`, and endpoint details in the owning feature specification.

#### Record contract questions

- [x] **Shipment identity and relationship:** Is one Shipment created per Order, per Parcel, or per fulfillment instance? Which immutable Order/Parcel/waybill references and foreign keys are required?  
       **Answer/owner:** Create exactly one Shipment per physical Parcel. Since the MVP has one Parcel per Order, each Order effectively has one Shipment. First-mile and final-mile are separate DeliveryTasks linked to that same Shipment. Courier reassignment, scans, and status changes append history; they do not create another Shipment.

- [x] **Parcel identity and packaging:** What identifies the Parcel? Which dimensions/weight units, item-and-quantity snapshot, and waybill link are stored? Is more than one Parcel per Order allowed in a later version?  
       **Answer/owner:** One Order produces one Parcel, containing all of its items, and one Shipment. The Parcel has a stable ID, package details, an immutable item/quantity snapshot, and one link to the shared waybill. First-mile and final-mile tasks reference this same Parcel; they do not create new Parcels. Multiple Parcels per Order require a future approved schema and waybill decision.

- [x] **Leg:** Confirm that `first_mile` is Seller → the owning Logistics hub and `final_mile` is that hub → Customer. Identify the field that distinguishes the two legs.  
       **Answer/owner:** Each `DeliveryTask` has a required server-controlled `leg` field with either `first_mile` or `final_mile`.  
       - `first_mile`: Seller → the owning Logistics organization’s sole hub.  
       - `final_mile`: that sole hub → Customer.

- [x] **Current state:** Should the existing explicit lowercase `snake_case` enum values remain the complete state vocabulary? If any value is added, where is its transition and migration approved?  
       **Answer/owner:** The project/domain owner approves the shared state vocabulary. Keep the existing explicit lowercase `snake_case` enum values. Any new value requires a documented transition in `docs/workspace.md`, a string-backed schema/migration change in `docs/schema.md`, and an update to its owning feature specification. Implementation is owned by the backend transition-service maintainer.
- [x] **Logistics/hub scope:** Which owning Logistics organization and authorized account(s) may view, create, update, re-offer, or close an assignment? Which fields are protected, and how is cross-organization access denied?  
       **Answer/owner:** Only the owning Logistics organization—the organization with which the assigned Courier is affiliated and that created the task—may access and manage the assignment. Its authorized accounts may view, create, update permitted assignment fields, re-offer, or close it. The Logistics organization, sole hub, Order/Parcel/waybill links, task leg, state transitions, actor data, timestamps, and historical events are server-controlled. Cross-organization access is denied through authenticated organization, hub, role, and Courier-affiliation checks; client-supplied organization IDs are not trusted.
- [x] **Offer/acceptance:** How are offered, accepted, rejected, and re-offered Couriers represented? Confirm that a rejected offer stays in history and the same task may be offered again.  
       **Answer/owner:**
  - **Offered:** Logistics sends the task to a Courier; store the task, Courier, offer time, and expiry/state.
  - **Accepted:** The Courier accepts the offer; the task’s current assignment becomes that Courier.
  - **Rejected:** The Courier declines; store the rejection reason and timestamp. The Order and custody state do not change.
  - **Re-offered:** Logistics offers the same `DeliveryTask` to another Courier by creating a new offer/assignment record. Do not create a new Order, Parcel, or Shipment.

- [x] **Actor timestamps and presentation:** Which server timestamps and performing/validating/recording actors are required? Should a restricted Logistics/Admin audit log be separate from Customer/Courier milestone timelines?  
       **Answer/owner:**
      All event times are generated by the server in UTC and are immutable. Each event records the relevant actor:
  - `offered_at` and the Logistics account that created the offer.
  - `accepted_at` or `rejected_at`, the Courier, and any rejection reason.
  - `performed_at` and the Courier who physically performed the action.
  - `validated_at` and the Logistics account that validated the scan/evidence.
  - `recorded_at` and the Logistics account that committed the authoritative event.
  - `expires_at` for an offer where an expiry window applies.

  A restricted Logistics/Admin audit log is separate from Customer and Courier milestone timelines. The same append-only event history may feed both views, but each role receives a different authorized projection. Audit logs may show actors, reasons, evidence references, and validation details; Customer/Courier timelines show only the safe milestones relevant to them.

- [x] **Idempotency:** What scope makes a mutation key unique (task, action, actor, or request), and what canonical projection must a retry return?  
       **Answer/owner:** Mutation idempotency is scoped to the authenticated actor, owning Logistics organization, `DeliveryTask`, action, and client-provided `Idempotency-Key`. The server stores the request hash and the committed result. Reusing the same key with the same request returns the original canonical projection, including the task state, current assignment, and committed event identifiers. It must not create duplicate assignments, scans, custody events, inventory effects, or notifications. Reusing the key with different request details returns a conflict. A new logical action or re-offer requires a new key; client-supplied actor or organization identifiers are never trusted.
- [x] **Scan/evidence:** What QR/reference and approved evidence does the Courier submit? How is the owning Logistics organization notified, and does the scan only await validation or ever advance custody directly?  
       **Answer/owner:** The Courier scans the opaque waybill QR in the Flutter app. The backend validates that it belongs to the Courier’s accepted task and owning Logistics organization, then stores an immutable scan event with the server timestamp, Courier, task leg, and idempotency key. The owning Logistics organization receives an after-commit in-app/dashboard notification. The scan is treated as Courier-submitted evidence pending Logistics validation; it does not independently advance custody. After validation, the shared transition service records the applicable pickup state.
- [x] **Append-only history:** Which assignment, scan, evidence, custody, and re-offer events are immutable? Can a current assignment be closed without deleting its history?  
       **Answer/owner:** Assignment offers, acceptances, rejections, expirations, re-offers, scan submissions, evidence decisions, custody transitions, actor details, timestamps, reasons, and idempotency results are immutable after commit. A current assignment may be closed only through an authorized state transition; closing it updates the current projection and appends a close event without deleting or rewriting prior history. Re-offering creates a new offer record for the same `DeliveryTask`, while the previous offer remains unchanged. Any correction is recorded as a new event rather than editing an old event.

#### Transition and implementation questions

- [x] **Transition matrix:** For every allowed `from → to` state, record actor, preconditions/evidence, transaction side effects, retry result, and concurrent-conflict result in `docs/workspace.md` and the owning specs.  
       **Answer/owner:** The authoritative transition matrix is maintained in `docs/workspace.md` and mirrored in each owning feature specification. The following is the accepted target vocabulary, not a claim that every state exists in today's backend enums. Existing first-mile task `assigned`/`accepted` values remain distinct from the future `seller_pickup_assigned`/`seller_pickup_accepted` names and high-level Order `assigned`. No client may submit an arbitrary target status.
  - `awaiting_seller_pickup → seller_pickup_assigned`: Logistics creates/offers the task after Seller readiness, selected-provider, hub, and waybill checks.
  - `seller_pickup_assigned → seller_pickup_accepted`: The affiliated Courier accepts its own offer.
  - `seller_pickup_assigned → rejected`: The Courier rejects the offer with a reason; the Order and custody state remain unchanged. Logistics may re-offer the same task.
  - `seller_pickup_accepted → picked_up_from_seller`: The Courier scans/submits the waybill evidence; Logistics validates it and the transition service commits the first-mile handoff and approved inventory effect once.
  - `picked_up_from_seller → received_at_hub`: Logistics validates receipt at its sole hub.
  - `received_at_hub → sorted_at_hub → in_transfer → dispatched_from_hub`: Logistics performs and records these hub transitions.
  - `dispatched_from_hub → delivery_assigned`: Logistics creates/offers the independent final-mile task.
  - `delivery_assigned → delivery_accepted`: The assigned affiliated Courier accepts the offer.
  - `delivery_accepted → picked_up_from_hub`: The Courier scans/submits handoff evidence; Logistics validates and records the hub pickup.
  - `picked_up_from_hub → in_transit → out_for_delivery`: The final-mile Courier performs the movement.
  - `out_for_delivery → delivered`: The Courier submits proof; Logistics validates the evidence, and the owning Complete Delivery transition commits `delivered`.

  Every accepted transition appends immutable history, uses server-side authorization and idempotency, returns the committed projection on retry, and returns a conflict without
  overwriting newer history when concurrent state is detected. Post-pickup cancellation, delivery failure, returns, refunds, and partial fulfillment remain unavailable until separately
  approved.

- [x] **Failure and cancellation boundary:** Which pre-`picked_up_from_seller` cancellation is implemented now? Confirm that post-pickup cancellation, delivery failure, returns, refunds, and partial fulfillment remain deferred until separately approved.  
       **Answer/owner:** In the MVP, Customer cancellation and Seller rejection are allowed only while the Order is `placed`, before `picked_up_from_seller`. Each releases only that Order’s reserved SKU quantities once and transactionally. A Courier’s task rejection is assignment-level and does not cancel the Order. After `picked_up_from_seller`, automatic cancellation or inventory release is unavailable. Delivery failure, returns, refunds, and partial fulfillment remain deferred until their policies, line-level records, and owning transitions are separately approved.
- [x] **Migration order and rollout gate:** What additive table, foreign-key, and index order is required, and what prevents unavailable endpoints from being enabled before the schema is deployed?  
       **Answer/owner:** Additive migrations will create Shipment, Parcel, DeliveryTask, assignment/offer history, scan/custody/evidence records, and proof-of-delivery references in dependency order, followed by indexes, uniqueness constraints, and any approved backfills. Existing migrations will not be modified, and enum-like values will remain string-backed. Physical-operation routes and the shared transition service remain disabled until all required migrations are deployed and a schema health check passes. Controllers fail closed while the schema is unavailable, and Flutter, web, and Logistics clients may consume only routes explicitly marked implemented.
- [x] **Transition-service owner:** Which server service owns state validation, tenant/hub/role checks, locking or revision checks, idempotency, append-only history, and after-commit notifications?  
       **Answer/owner:** Current high-level Order transitions remain owned by `src/api/app/Services/OrderTransitionService.php`. Future physical Shipment/Parcel/DeliveryTask transitions will be owned by one dedicated server-side fulfillment transition service. The service will validate the transition matrix, organization/sole-hub/role/Courier affiliation, evidence, row locks or revisions, idempotency, and append-only history in one transaction. It will apply only approved inventory effects and dispatch notifications after commit. Logistics remains the authoritative business recorder for Courier-submitted scans and evidence, but the transition service commits the state. Controllers and clients may submit requests only; they cannot set statuses directly. If the required schema is unavailable, the service fails closed and performs no write.
- [x] **Endpoint ownership:** Which feature specification owns each scan, hub operation, final-mile task, and proof-of-delivery endpoint, and is each route implemented or unavailable?  
       **Answer/owner:** Each operational endpoint has one owning feature specification. The owning specification defines its method, path, authorization, request, response, errors, retry behavior, and implementation status. Supporting specifications may reference the contract but must not redefine it.

| Endpoint area                                                 | Owning specification                                      | Status                                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Courier first-mile QR/manual verification and pickup confirm  | `docs/features/courier/pick-up-order/specs.md`            | Implemented foundation; physical Shipment scan/evidence transition remains deferred |
| Physical Courier scan/evidence submission for future custody  | `docs/features/courier/pick-up-order/specs.md`            | Unavailable until the operational schema exists                                     |
| Logistics scan validation and authoritative custody recording | `docs/features/logistics/update-status/specs.md`          | Unavailable                                                                         |
| Hub receipt, sorting, transfer, and dispatch                  | `docs/features/logistics/update-status/specs.md`          | Unavailable                                                                         |
| Final-mile task creation, assignment, and re-offer            | `docs/features/logistics/deploy-rider/specs.md`           | Unavailable                                                                         |
| Courier final-mile acceptance/rejection                       | `docs/features/courier/accept-delivery-requests/specs.md` | Unavailable; first-mile listing/acceptance is implemented                           |
| Proof-of-delivery submission                                  | `docs/features/courier/proof-of-delivery/specs.md`        | Unavailable                                                                         |
| Final delivered transition                                    | `docs/features/courier/complete-delivery/specs.md`        | Unavailable until the shared transition service and contract exist                  |

- [x] **Verification plan approved:** The test categories below are the accepted plan; this checkbox does not claim that future physical migrations or tests have run.
- [ ] **Verification execution:** Physical migrations, schema-health checks, and the planned SQLite/PostgreSQL tests exist and pass, with results recorded in `docs/PROGRESS.md`.

  **Answer/owner:** The backend fulfillment maintainer owns the verification plan. The migration and API suites must run against both the PHPUnit SQLite database and PostgreSQL which is the production database. Physical-operation coverage remains planned until the additive operational migrations are deployed.
  - **Migration tests:** Verify migration order, Shipment/Parcel/DeliveryTask foreign keys, indexes, uniqueness constraints, string-backed status fields, sole-hub scope, append-only
    history constraints, and schema-health checks on SQLite and PostgreSQL.
  - **IDOR/tenant tests:** A Courier, Logistics account, Seller, or Customer cannot read or mutate another organization’s task, hub, Order, Parcel, waybill, scan, evidence, or history.
  - **Invalid-sequence tests:** Reject transitions with the wrong current state, leg, actor, assignment, missing evidence, or invalid precondition without changing state.
  - **Retry/idempotency tests:** Retrying the same mutation key returns the original committed projection and does not duplicate assignments, history, inventory effects, or
    notifications. Reusing a key with different input returns a conflict.
  - **Concurrency tests:** Simultaneous transitions use locking or revision checks; only one valid transition commits and the other receives a conflict without overwriting history.
  - **Evidence-authority tests:** Couriers may submit scans/evidence only for their assigned task. Logistics validates and records the authoritative event; a QR scan or notification
    alone cannot advance custody.
  - **Inventory-boundary tests:** Cancellation or rejection before `picked_up_from_seller` releases the reservation once; pickup fulfillment commits it once; post-pickup cancellation,
    returns, refunds, and partial fulfillment have no unapproved automatic inventory effect.
  - **Notification-failure tests:** A notification or queue failure after commit does not roll back the transition, inventory effect, or audit history. Retrying delivery does not create
    duplicate notifications.
  - **Rollout gate:** These tests must pass and the schema-health check must succeed before physical-operation endpoints are marked implemented or consumed by any client.

## HOW

- If implementation is explicitly requested, first read the current canonical requirements, workspace, schema, domain, and owning feature specs. Do not start from this file alone.
- Complete the unchecked readiness questions above, record the rationale here, and propagate accepted rules into every affected canonical document before writing code. Keep those edits explicit and reviewable; do not leave a checked decision only in this guide.
- Add only additive migrations for approved Shipment, Parcel, DeliveryTask, assignment, Scan, custody, and proof records. Never edit an executed migration or add native PostgreSQL enum columns.
- Implement transitions through a shared service with transactions, row locks/optimistic revisions, server-derived ownership, idempotency keys, and append-only history.
- Dispatch notifications and audit/outbox work after commit so provider failures cannot roll back state. Laravel supports after-commit queued work for this boundary.
- Keep Customer projections read-only and role-specific; keep Logistics UI in its dashboard and Courier UI in the external Flutter project.
- Test every approved transition on SQLite and PostgreSQL, including IDOR, stale/concurrent requests, retries, invalid sequence, tenant isolation, inventory boundaries, and notification failure.
- Roll out schema and transition contracts before enabling physical custody actions; do not expose a conceptual endpoint as working API.

### Recorded cross-document decisions and deferred outcomes

- [x] Task cardinality: one Order/Parcel per DeliveryTask; schedules may group Orders but do not create a multi-parcel task.
- [x] Scan/evidence authority: the Courier scans the Order's waybill QR/reference in the app and submits the event/evidence; Logistics validates and records the authoritative event, preserving both the performing Courier and recording Logistics account. The QR/reference scan, Courier identity, and timestamp are the minimum evidence.
- [x] Exception policy: returns, refunds, and partial fulfillment are deferred. A rejected Courier offer marks the task `rejected` without changing the Order; Logistics may offer the same task to another eligible Courier. An unfinished task becomes informationally `stale` and is not automatically cancelled or reassigned; no automatic post-pickup inventory release is assumed.
- [x] Courier route summary: an authorized Courier may see provider-neutral `distance_km` and `estimated_duration_minutes` with the offered or accepted task; no map vendor or graphical route is implied.

### References

- Canonical project documents: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`, `docs/domains/Buyer.md`, `docs/domains/Logistics.md`, and `docs/domains/Courier.md`.
- Existing order specs: `docs/features/orders/logistics-pickups/spec.md` and `docs/features/orders/waybill/spec.md`.
- Owning role specs: Seller Prepare Orders, Logistics Dashboard/Deploy Rider, Courier pickup/delivery, Customer Order Status, and Customer Checkout; Laravel references: [database transactions](https://laravel.com/framework/docs/12.x/database) and [queued work after database commit](https://laravel.com/framework/docs/12.x/queues).
