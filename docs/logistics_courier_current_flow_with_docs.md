# Logistics and Courier: Current Flow and Documentation Alignment Review

> Review date: 2026-09-05  
> Scope: current Logistics and Courier feature specifications compared with the project requirements, workflow, domains, schema, registration/upload policies, and progress log.  
> Status: uncommitted documentation review; no application behavior is changed.

## Executive conclusion

The Logistics and Courier documents are aligned in their overall intent and cover the main capabilities described by the project. The implementation is now partial: Logistics Auth and the protected Dashboard scaffold exist, while Seller fulfillment, Logistics parcel operations, and the external Courier workflow remain unfinished.

- **Conceptual flow: aligned.** The documents consistently describe Seller handoff → Courier pickup → Logistics receive/sort/transfer/dispatch → final Courier delivery → Buyer completion/rating.
- **Dependency chain: explicit.** Logistics may process only the Seller handoff committed by Seller Prepare Orders; Dashboard, Waybill, Update Status, Deploy Rider, and the Courier task features consume that handoff in sequence. The directly affected specs are mapped below.
- **Implementation status: partial.** The repository now has the Logistics role, one-account/one-organization/one-hub foundation, auth flow, seeder, and protected Dashboard scaffold. It still has no shipment/parcel, waybill, scan, delivery-task, assignment, proof-of-delivery, or earnings workflow, and Courier remains an external mobile client.
- **MVP scope: settled.** Each Logistics organization operates exactly one operational hub/sorting center through one Logistics account. The registration address is that sole hub address; no sub-hub, additional hub, or staff/sub-account branch is part of this flow.
- **Duplicate features: mostly no.** Most apparent overlap is an integration boundary where two features touch the same workflow. Those boundaries need shared contracts, not duplicate implementations.
- **Remaining conflicts: yes.** Status/state ownership, the two Courier pickup legs, vehicle ownership, POD policy, mapping references, and route naming need resolution before the remaining operational features are coded. Courier approval authority is settled: the associated Logistics organization approves the Courier.

The practical conclusion is: keep the individual feature specs, but revise the cross-feature contracts first. The specs should not be implemented independently until the decisions in this report are recorded in one authoritative shared document.

## Documents reviewed

| Source | What it establishes |
| --- | --- |
| [`docs/requirements.md`](docs/requirements.md) | MVP role capabilities, first-party logistics lifecycle, approvals, waybill/scanning, subscription, and courier delivery requirements |
| [`docs/workspace.md`](docs/workspace.md) | Canonical registration/auth patterns, authorization rules, order/logistics workflow, status examples, routing, notifications, messaging, and pricing boundaries |
| [`docs/architecture.md`](docs/architecture.md) | Laravel/API stack, separate React dashboards, external mobile Courier client, Sanctum, and `/api/v1/` convention |
| [`docs/schema.md`](docs/schema.md) | What the database currently supports, current order statuses, Courier foundation, and explicitly deferred first-party logistics data |
| [`docs/domains/Logistics.md`](docs/domains/Logistics.md) | Logistics domain capability list and intended ownership |
| [`docs/domains/Courier.md`](docs/domains/Courier.md) | Courier operational, financial, communication, safety, and future capability list |
| [`docs/references/user-registration-requirements.md`](docs/references/user-registration-requirements.md) | Logistics/Courier registration fields and evidence expectations |
| [`docs/references/file-upload-requirements.md`](docs/references/file-upload-requirements.md) | Private image upload limits and validation rules |
| Direct Logistics dependency specs | Auth, Dashboard, Waybill, Update Status, Deploy Rider, Flexible Availability & Capacity, Vehicle Fleet, and Zone/Territory |
| Direct Courier dependency specs | Auth, Dashboard, Accept Delivery Requests, Pick Up Order, Deliver Order, Proof of Delivery, and Complete Delivery |
| [`docs/features/logistics/WIP.md`](docs/features/logistics/WIP.md) | Deferred shared shipment/state, scanner, Courier approval, subscription, and operational-history contracts |
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | Current implementation history, including the Logistics Auth/Dashboard scaffold and the absence of completed parcel/Courier operations |

Several feature specs cite `app.md`, but no `app.md` file exists in the current repository tree. The same specs also refer to a map policy that is not present as `docs/maps-location-api.md` in this checkout. Those references cannot be independently audited and should be replaced with the current canonical documents or restored before implementation.

## Current implementation boundary

The current codebase can support only part of the planned flow:

- The API has shared UUID users, Sanctum, registration applications, documents, addresses, role/profile foundations, and the new Logistics role/profile, organization, and sole-hub foundation.
- Logistics Auth and its protected `src/logistics` React SPA are implemented; the Logistics Dashboard endpoint currently returns only the authenticated hub scaffold, empty order data, and freshness metadata.
- `CourierProfile` and Courier-owned `Vehicle` records exist, but Courier affiliation, shipment, parcel, waybill, scan, delivery-task, assignment, proof, and earnings workflows are not implemented.
- Customer checkout and Seller order/product flows exist, including the `ready_for_pickup` Order enum value. The Seller Prepare Orders handoff and its `OrderReadyForPickup` event remain specified but are not implemented.
- There is no `src/courier` application file by design: Courier consumes API endpoints from an external Flutter mobile app. No Courier web UI should be added under `src/`.
- The Logistics and Courier feature specs remain Draft. They are planning contracts; the Logistics Auth/Dashboard entries above are the only implemented parts of this flow.

Therefore, the documents describe a runnable Logistics Auth/Dashboard foundation plus the intended next parcel/Courier layer; they do not describe a currently runnable end-to-end Logistics/Courier delivery workflow.

## Current end-to-end flow

This is the flow implied by the combined requirements and workspace documents, with the unresolved parts called out explicitly.

### 1. Account registration and access

1. A Logistics applicant registers with personal/business details, a Philippine address, and registration evidence.
2. An Admin reviews the Logistics application. Approval activates the Logistics account; rejection leaves it unable to sign in. The Logistics account then enters the subscription flow after sign-in.
3. A Courier searches for and selects an eligible Logistics company or hub, submits personal/address/vehicle/evidence details, and waits for approval.
4. The associated Logistics organization reviews and approves the Courier. Admin account suspension, restoration, or deactivation remains a separate platform lifecycle action, not a second registration approval.
5. After every required approval, the Courier signs in through the external mobile app and receives a Sanctum bearer token. Logistics uses the stateful Sanctum web-session pattern.

### 2. Buyer order and Seller handoff

1. A Buyer places an order.
2. The Seller approves/processes it and packs the items.
3. The Seller exposes the order/waybill details needed for pickup and leaves a scannable or manually enterable parcel reference.
4. The current schema's closest order states are `placed` → `seller_processing` → `ready_for_pickup`. These are marketplace Order states, not a complete parcel or delivery-task state machine.

The Logistics side must not accept or queue a merely placed, unconfirmed, or unpacked Order. The relevant dependency is the Seller Prepare Orders contract: only its committed `READY_FOR_PICKUP` handoff makes the Order eligible for the Logistics Dashboard and downstream Logistics processing. There is no separate standalone “Logistics Accept Order” spec in the current docs.

### 3. Seller pickup leg

1. A Courier is given a pickup task for the Seller (the workspace calls this door-to-door pickup from the Seller).
2. The Courier accepts the request if the offer model is selected, travels to the pickup point, verifies the order/parcel/manifest, scans or enters the reference, and confirms physical possession.
3. Pickup confirmation advances the associated shipment/order state and makes the parcel available to Logistics.

This Seller-origin task is distinct from the later hub-origin final-mile pickup. Its creation/assignment event and whether the same Courier performs both legs are not defined; they must be represented explicitly rather than inferred from one `courier_id` field. In either case, Courier acceptance and physical pickup remain downstream of the Seller's committed readiness handoff.

### 4. Logistics receive, waybill, sort, transfer, and dispatch

1. Logistics receives the parcel into its operational workflow.
2. Logistics generates or identifies a waybill and can print its order/shipping details.
3. The parcel is sorted at a hub/sorting center.
4. Transfer is performed by scanning the waybill or entering its reference.
5. Dispatch is performed by scanning the waybill or entering its reference.
6. Logistics selects/assigns a Courier for final delivery using availability, capacity, zones, and route/distance context.

All of these actions occur inside the Logistics organization's single operational hub. The Dashboard is a read-only queue; Waybill, Update Status, and Deploy Rider own the corresponding mutations. No multi-hub, sub-hub, or separate hub-account branch is permitted in the MVP.

### 5. Final-mile Courier delivery

1. The final-mile Courier receives or accepts the dispatch offer (the recommended draft direction is an offer → accept model).
2. The Courier picks up the parcel from the hub/sorting center or other dispatch point.
3. The Courier obtains destination and navigation context, travels to the Buyer, and handles delivery exceptions through the Incident feature.
4. The Courier records an approved proof-of-delivery method, such as QR/parcel verification, confirmation, photo, or signature, according to the final POD policy.
5. The Courier completes the delivery. The Buyer-facing Order becomes delivered, the delivery task becomes completed, notifications are sent after the transaction commits, and the delivery becomes visible in history/earnings.

This sequence is consistent at a business level, but the separate Order, Parcel/Shipment, Delivery Task, Assignment, Scan, and POD records do not yet exist in the schema.

## Dependency-relevant feature coverage and ownership

Only specs that directly gate or consume the order-to-delivery path are listed here. Standalone account settings, chat, incident, history, and earnings specs remain separate and do not gate the core handoffs.

`docs/features/seller/order-management/spec.md` is intentionally not a dependency: its current contract owns Seller catalog/Product management, while purchased-order fulfillment and the Logistics handoff belong to Seller Prepare Orders.

| Stage | Directly affected specs | Responsibility and current state |
| --- | --- | --- |
| Access gate | [`logistics/auth`](features/logistics/auth/spec.md); [`courier/auth`](features/courier/auth/spec.md) | Logistics Auth and its one-account/one-organization/one-hub foundation are implemented. Courier Auth is planned for the external Flutter app; the associated Logistics organization is the settled Courier approver. |
| Seller handoff | [`seller/prepare-orders`](features/seller/prepare-orders/spec.md) | Seller owns `SELLER_PROCESSING → READY_FOR_PICKUP` and the committed handoff event. The spec exists; the fulfillment implementation is deferred. |
| Logistics intake | [`logistics/dashboard`](features/logistics/dashboard/specs.md); [`logistics/waybill`](features/logistics/waybill/specs.md); [`logistics/update-status`](features/logistics/update-status/specs.md) | Dashboard reads the Seller-ready queue; Waybill owns identity/printing; Update Status owns valid scan/manual transitions. Only the Dashboard scaffold is implemented. |
| Dispatch inputs and decision | [`logistics/flexible-availability-and-capacity-monitoring`](features/logistics/flexible-availability-and-capacity-monitoring/specs.md); [`logistics/vehicle-fleet-management`](features/logistics/vehicle-fleet-management/specs.md); [`logistics/zone-territory-mapping`](features/logistics/zone-territory-mapping/specs.md); [`logistics/deploy-rider`](features/logistics/deploy-rider/specs.md) | Availability, fleet, and zones provide eligibility inputs; Deploy Rider creates the assignment/offer. These are draft contracts. |
| Courier acceptance and movement | [`courier/dashboard`](features/courier/dashboard/specs.md); [`courier/accept-delivery-requests`](features/courier/accept-delivery-requests/specs.md); [`courier/pick-up-order`](features/courier/pick-up-order/specs.md); [`courier/delivery-order`](features/courier/delivery-order/specs.md) | The external mobile client receives the dispatch offer, accepts it, confirms physical pickup, then performs transit. These are draft contracts. |
| Completion | [`courier/proof-of-delivery`](features/courier/proof-of-delivery/specs.md); [`courier/complete-delivery`](features/courier/complete-delivery/specs.md) | e-POD supplies evidence; Complete Delivery owns finalization (`Order = DELIVERED`, task completion) after policy checks. These are draft contracts. |
| Shared prerequisites | [`logistics/WIP.md`](features/logistics/WIP.md) | Shared shipment/state machine, scanner processing, Courier approval/management, subscription, and operational history contracts are still deferred. |

The main path is therefore covered by distinct feature specs without a duplicate “Logistics Accept Order” feature. The implementation gap is the shared shipment/task contract and the deferred operational features, not missing ownership of the Seller confirmation gate.

## What is aligned

### Role boundaries

- Logistics owns parcel processing, sorting, transfer, dispatch, and final Courier assignment.
- Courier owns mobile task acceptance, physical pickup, navigation/delivery work, proof capture, completion, history, and personal earnings views.
- Courier remains mobile-only; no Courier web dashboard should be added under `src/`.
- Account/auth specs do not own operational mutations, and dashboard specs are primarily read/aggregation surfaces.
- Fleet, zones, and availability provide dispatch inputs; Deploy Rider owns the dispatch decision.

This matches [`docs/domains/Logistics.md`](docs/domains/Logistics.md), [`docs/domains/Courier.md`](docs/domains/Courier.md), [`docs/requirements.md`](docs/requirements.md), and the role-boundary rules in [`docs/workspace.md`](docs/workspace.md).

### Business sequence

The core sequence in the specs matches the requirements and workspace flow: Seller-confirmed order → Seller pickup → Logistics receive → waybill/sort/transfer/dispatch → final Courier assignment → Buyer delivery → completion/rating.

### Security and ownership expectations

The specs consistently require Sanctum, role/status checks, Logistics-to-Courier relationship checks, tenant-scoped Logistics data, private evidence, server-owned state transitions, idempotency, and post-commit notifications. These are compatible with the existing API architecture and schema invariants, even though the required tables and services are not implemented.

### Provider boundaries

The operational specs generally treat route providers as sources of distance/route context, not as the owner of assignment or delivery state. They also keep waybill generation separate from scan-triggered state changes. That is a sound boundary.

## Conflicts and unresolved decisions

These are the items that are more than ordinary implementation detail.

### 1. Courier approval authority is settled

The requirements, workspace rules, `AGENTS.md`, and revised Courier Auth spec agree that the associated Logistics organization is the sole Courier registration reviewer and approval authority for the MVP. Admin account-management actions may suspend, restore, or deactivate an account after or independently of registration, but Admin approval is not a second Courier-registration stage.

The remaining implementation gap is an auditable Courier-to-Logistics relationship and Logistics decision record with actor, reason, timestamp, and notification state; the authority itself is no longer an open decision.

### 2. Role/schema documentation lag

Logistics is now implemented as a fifth role in the API and migration foundation, with one profile, one organization, and one operational hub. The requirements, workspace, and Logistics Auth/Dashboard specs agree with that direction. `docs/schema.md` still contains the earlier four-role/deferred-Logistics description and should be synchronized before the parcel tables are added; this is documentation drift, not a reason to create a second role model.

### 3. One account and one hub are settled for the MVP

The current requirements, workspace rules, Logistics Auth, and Logistics Dashboard spec agree that:

- each Logistics organization has exactly one operational hub/sorting center;
- the Logistics registration address is that hub's address;
- one Logistics account operates that organization and hub through the Dashboard; and
- sub-hubs, additional hubs, multi-hub transfers, and staff/sub-accounts are out of scope for this MVP.

This is a settled scope rule, not an open flow branch. The remaining implementation work is to carry the single organization/hub relationship into shipment, parcel, scan, assignment, fleet, zone, and capacity records. Staff/sub-account authorization can be revisited in a later version without changing this MVP flow.

### 4. Order status versus shipment, task, and assignment status

The current schema has an `OrderStatus` enum-like field with values such as `ready_for_pickup`, `assigned`, `picked_up`, `in_transit`, `out_for_delivery`, and `delivered`. The Logistics/Courier specs additionally use values such as `READY_FOR_PICKUP`, `AT_SORTING_CENTER`, `ACCEPTED`, `IN_TRANSIT`, `DELIVERED`, and `COMPLETED`.

Those values do not form one safe enum. The Update Status spec correctly notes that Order/Parcel status, Delivery Task status, and Assignment status are different concepts, but the shared model is still deferred. Create one canonical state-machine contract and define which event updates each projection. Do not add every phrase from the specs to `orders.status`.

### 5. Two Courier legs are not modeled

The workspace requires both:

1. Courier door-to-door pickup from Seller; and
2. Logistics assignment followed by Courier pickup for final delivery.

The specs do not yet define whether these are separate task types, one task with two legs, or always the same Courier. A single generic “delivery task” and a single `courier_id` would make reassignment, earnings, history, notifications, and responsibility ambiguous.

Define `pickup`/`line-haul` and `final-mile` task semantics (or another explicit model) before implementing Deploy Rider, Accept, Pickup, Complete, History, or Profit.

### 6. Vehicle ownership conflicts with the current schema

The current schema links `vehicles` to `courier_profile_id`. The Logistics Fleet spec expects Logistics-scoped vehicle ownership and uses fleet capacity for dispatch eligibility. Decide whether vehicles are:

- owned by the Courier;
- owned by the Logistics company and assigned to a Courier; or
- registered by the Courier but affiliated/approved by Logistics.

The chosen relationship must also define whether a Courier may have multiple vehicles, whether a vehicle can move between companies, and what happens to active assignments when it is deactivated.

### 7. POD requirements are not one policy

The Courier domain describes strict evidence, while [`docs/workspace.md`](docs/workspace.md) says P0 can use at least one method and that QR/parcel verification plus delivery confirmation is sufficient; a photo is recommended. The Complete Delivery and POD specs leave the exact requirement open.

Choose the required method(s), when evidence is captured, retention/access rules, and whether completion is rejected without POD. Complete Delivery and POD must then share one completion contract rather than independently deciding whether an order is delivered.

### 8. Mapping references and provider selection are stale or mixed

- [`docs/workspace.md`](docs/workspace.md) names Mapbox Matrix and Optimization for route/distance optimization.
- Some domain/spec text says Google Maps or Mapbox.
- Current address work in the progress log uses bundled PSGC data, Geoapify, and Leaflet; that is an address/pin flow, not proof that Mapbox route optimization is implemented.
- Many specs cite the missing `app.md` as the authority for Mapbox.

Treat address lookup/rendering and route optimization as separate integrations. Replace the missing reference, explicitly select the route provider, and define a fallback (for example, route-assisted manual assignment) before making routing a hard dependency of Deploy Rider or Courier Accept.

### 9. API paths are conceptual and inconsistent

Architecture requires `/api/v1/`, while many operational specs show conceptual paths such as `/api/logistics/...` and `/api/courier/...`; the auth specs use `/api/v1/...`. Mark the operational paths as conceptual or normalize them to the repository versioning convention before implementation. This is a documentation inconsistency rather than a business-flow conflict.

### 10. Subscription is a gate, but its owner is deferred

Requirements/workspace place Logistics subscription after Admin approval and sign-in, and the WIP list defers Subscription/Billing. Authentication should establish identity and approval; a separate subscription contract should decide whether an inactive subscription blocks dashboard access, parcel operations, dispatch, or only billing views. Do not embed an unapproved subscription gate in every feature.

## Direct dependency contracts

The following boundaries name only specs that directly participate in the core order-to-delivery path. Each boundary needs one shared event/state contract before the two sides are implemented independently.

| Boundary | Dependency that must hold | Owning handoff | Risk if implemented independently |
| --- | --- | --- | --- |
| Seller Prepare Orders → Logistics Dashboard | Seller has authenticated ownership, completed processing/packing, and committed `READY_FOR_PICKUP` | Seller Prepare Orders emits the committed handoff; Dashboard reads it | Logistics could show or “accept” an order that is still placed, unpaid, unpacked, cancelled, or outside its hub |
| Logistics Auth → Dashboard/operations | The caller is an approved active Logistics account mapped to its one organization and sole hub | Logistics Auth gates every Logistics request | A valid account could read another organization's queue or a pending account could operate the hub |
| Dashboard → Waybill | The selected row is an authorized, Seller-ready/Logistics-eligible parcel | Dashboard deep-links; Waybill re-authorizes and generates/prints | A UI row could be mistaken for permission to generate a label, or a label could be created for an unready order |
| Waybill → Update Status / Pick Up Order | One scoped opaque reference/QR resolves to the authoritative parcel/task | Waybill owns identity; Update Status/Pick Up consume it | Printing or scanning could create duplicate parcels, mutate status twice, or resolve another Logistics organization's record |
| Update Status → Pick Up/Deliver/Complete | Every state change uses the approved Order/Parcel/Task/Assignment transition model | Update Status owns Logistics scan/manual transitions; Courier features own physical actions | Separate status columns could skip required stages or mark a parcel in transit without physical possession |
| Availability + Fleet + Zone → Deploy Rider | Courier status, capacity/vehicle, zone, GPS freshness, and hub affiliation are current at commit time | Supporting specs provide inputs; Deploy Rider makes the assignment/offer decision | A Courier who goes offline or over capacity could still receive the task |
| Deploy Rider → Courier Dashboard/Accept | A dispatch offer/assignment is scoped to the organization and has one defined acceptance model | Deploy Rider creates the handoff; Courier Dashboard displays it; Accept Delivery Requests commits `ACCEPTED` | Two Couriers could acquire one task, or Logistics could treat an unaccepted offer as physical possession |
| Courier Auth → Courier task features | The external mobile caller is an approved active Courier with a valid Logistics relationship | Courier Auth gates Dashboard, Accept, Pick Up, Deliver, POD, and Complete | A same-email or disassociated Courier could access another company's task |
| Accept Delivery Requests → Pick Up Order | The Courier explicitly accepted the current request and remains the authorized assignee | Accept owns `ACCEPTED`; Pick Up consumes it | A Courier could bypass acceptance or confirm a parcel for a stale/reassigned task |
| Pick Up Order → Deliver Order | The correct parcel was physically verified and possession was committed as `IN_TRANSIT` | Pick Up owns physical handoff; Deliver reads the active transit task | Navigation could begin for a parcel the Courier never received |
| Deliver Order → Proof of Delivery → Complete Delivery | Drop-off context exists and any required POD is valid before finalization | Deliver hands off; e-POD stores evidence; Complete owns `DELIVERED`/`COMPLETED` | A destination arrival or upload alone could prematurely complete the Order, or duplicate completion/notifications |

These dependencies do not require duplicate features. They require shared ownership, identifiers, allowed transitions, and post-commit events before each downstream spec is implemented.

## Recommended revision and implementation order

This order is a dependency recommendation, not a new product requirement.

1. **Preserve the settled organization boundary:** one Logistics account, one organization, and one operational hub; synchronize the schema documentation with the implemented foundation before adding parcel ownership.
2. **Implement the settled approval boundary:** Logistics-only Courier approval, including the relationship, decision fields, notification ownership, and separate Admin lifecycle actions.
3. **Write the shared shipment contract:** Order, Parcel/Shipment, Delivery Task, Assignment/Offer, Scan, POD, and immutable history ownership.
4. **Define the state machine:** separate state fields where necessary and map each state-changing action to one transition service.
5. **Complete the Seller handoff:** implement Seller Prepare Orders so only a committed `READY_FOR_PICKUP` event can enter the Logistics flow.
6. **Complete the Logistics intake:** extend the Dashboard queue, then implement Waybill and Update Status with scoped lookup, valid transitions, manual fallback, and idempotency.
7. **Implement dispatch inputs and decision:** add Courier availability, Fleet, Zone, and Deploy Rider using the finalized organization/hub scope and route-provider adapter.
8. **Implement Courier acceptance and pickup:** expose the dispatch offer through the external Courier Dashboard, commit `ACCEPTED`, verify the parcel, and commit `IN_TRANSIT`.
9. **Implement final-mile delivery:** Deliver Order, e-POD, and Complete Delivery, with one finalization owner and post-commit Buyer/Seller notifications.
10. **Add only after the core handoffs are stable:** messaging, incidents, history, earnings, subscription, and operational audit. The Courier WIP items can follow later.

## Specific documentation changes to make next

- Replace every `app.md` source reference with an existing canonical document, or restore one authoritative `app.md`; do not leave provider and workflow decisions pointing to a missing file.
- Add the deferred Logistics shared state-machine and scanner specs before revising status-heavy feature specs again.
- Add the deferred Logistics Courier Approval/Management spec so the settled Logistics authority, relationship, decision record, and revocation cascade are not spread across auth and dispatch documents.
- Synchronize `docs/schema.md` with the implemented Logistics role/profile/organization/sole-hub migration; keep the one-account/one-hub MVP invariant consistent across Auth, Dashboard, Fleet, Zone, Availability, Deploy Rider, and Courier Auth.
- Normalize conceptual API examples to `/api/v1/logistics/...` and `/api/v1/courier/...` (or explicitly label them as pseudoroutes).
- Make the two Courier legs explicit in Dashboard, Accept, Pickup, Deploy Rider, Complete, History, and Profit.
- Choose the POD minimum and make Complete Delivery the only finalization owner.
- Separate address provider policy from route/distance optimization policy and state which integration is actually approved for each.
- Keep the current individual specs concise and feature-owned; put cross-feature invariants in shared contracts instead of copying different versions into every spec.

## Bottom line

The Logistics and Courier specs are directionally aligned with the existing requirements and domain documents. The feature list is coherent, and there is no large duplicate feature that needs to be removed. The one-account/one-hub MVP boundary is settled; the current blockers are the remaining shared design decisions and missing implementation foundations, not a fundamentally wrong flow.

Before implementing the remaining operational features, resolve the two Courier legs, shared state machine, vehicle ownership, POD policy, subscription gate, and provider/source-document inconsistencies. Keep every new resource scoped to the already-settled Logistics organization and sole hub and the settled Logistics-only Courier approval, then revise the feature specs around the shared contracts and implement them in dependency order.
