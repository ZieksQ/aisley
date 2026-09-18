---
feature: logistics-sorting
title: Logistics Sorting
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented MVP with postal-code and hub-target sort-plan routing; advanced automation and containerization remain deferred
role: Logistics
scope: Logistics API and Logistics web application
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Logistics.md, docs/features/logistics/update-status/specs.md, docs/features/logistics/deploy-rider/specs.md
---

# Logistics Sorting

## WHAT

- Provide a dedicated **Sorting** workspace between **Receive at hub** and **Dispatch parcels**.
- Let the owning Logistics account organize received parcels into physical hub lanes using waybill 1D Code 128 barcodes or manual references.
- Keep physical work available during connectivity loss by saving captured scans in a device-local outbox.
- Treat offline scans as provisional; only a successful API response commits `sorted_at_hub`.
- Reuse the sole organization/sole hub, shared waybill, Parcel, Shipment, Delivery Task, and transition-service contracts.
- Support one open sorting session per hub and a bounded snapshot of up to 100 oldest `received_at_hub` parcels.
- Support configurable standard and exception lanes with printable, scannable lane labels.
- Let each Logistics organization create multiple named sort plans for its sole hub, with one active plan at a time.
- Let an active sort plan map exact four-digit recipient postal codes to active standard lanes.
- Resolve the scanned tracking ID on the server, read the immutable Buyer address snapshot, and choose the current plan lane at sync time.
- Route missing plans, missing/invalid postal codes, unmapped postal codes, and unavailable mapped lanes to the active exception lane.
- Keep sorting internal to Logistics; Customer, Seller, Admin, and Courier receive no Sorting UI or mutation route.
- Keep high-level Order status unchanged while a parcel is received, sorted, or placed in a sorting exception.
- Non-goals for this MVP:
  - geocoding, postal-code ranges, carrier-specific routing, or route optimization beyond exact active-plan postal-code mappings;
  - parcel bags, cages, pallets, containers, seals, or load manifests;
  - weight, dimension, lane-capacity, vehicle-capacity, or dangerous-goods rules;
  - staff assignment, productivity rankings, or employee-level performance targets;
  - multi-hub transfers, linehaul, `in_transfer`, cross-dock routing, RFID, conveyors, or robotics;
  - returns, delivery failures, damaged-parcel claims, refunds, or customer compensation.

## MUST

### Flow and authority

- Preserve `picked_up_from_seller → received_at_hub → sorted_at_hub → dispatched_from_hub`.
- Sorting accepts only Shipments currently at `received_at_hub` in the authenticated account's organization and sole hub.
- Dispatch continues to accept only server-committed `sorted_at_hub` Shipments.
- The shared fulfillment transition service remains the only writer of Shipment custody and append-only Shipment events.
- A scan, local queue entry, lane selection, session item, or exception record does not independently change custody.
- A successful standard-lane sync commits `sorted_at_hub` and records session, lane, source, capture time, and Logistics actor metadata.
- Persist the standard lane/session on Shipment independently of session closure; order snapshots by authoritative hub receipt time with creation-time fallback for legacy records.
- In automatic mode, resolve the submitted tracking ID to the tenant-owned Shipment, load the Buyer postal code, and recheck the current active sort plan under the hub lock; a client-predicted lane is advisory only.
- Automatic matches use the mapped active standard lane. Any missing sort plan or routing input uses the active exception lane, records the reason and plan/mapping metadata when available, and keeps custody at `received_at_hub`.
- Allow online, idempotent moves between active standard lanes before dispatch using Shipment/lane revisions and a reason; append `hub_lane_move` without changing sorted custody.
- Block lane deactivation/type changes while parcels remain staged through delivery acceptance, including after session closure; validated hub pickup frees the live lane.
- Ready parcels can dispatch during an open session; exception parcels remain held. Dispatch consumes current assignments and freezes source-lane metadata per parcel.
- A successful exception-lane sync keeps the Shipment at `received_at_hub` and records a reviewable operational exception.

### Tenant and lifecycle isolation

- Require Sanctum, active Logistics role/status, policy consent, organization ownership, and sole-hub scope on every endpoint.
- Resolve actor, organization, hub, current Shipment state, task state, lane, session, and allowed transition server-side.
- Guessed foreign lane, session, Shipment, waybill, Order, or Parcel identifiers return no existence disclosure or mutation.
- Allow only one open session per organization/hub; an identical open request replays and a conflicting request returns `409`.
- Snapshot no more than 100 oldest eligible parcels when a session opens; newly received parcels wait for a later session.
- A session closes only when no snapshot item is pending or in exception and no client outbox entry remains unsynced.
- Closed sessions and inactive lanes are read-only and unavailable for new captures.

### Lanes and labels

- Each lane has an organization/hub-scoped unique uppercase code, name, type, active flag, display position, and revision.
- Lane types are string-backed API enums: `standard` and `exception`.
- Standard lanes commit sorting; exception lanes require an allow-listed exception code and do not commit sorting.
- Allow-listed exception codes are `damaged`, `unreadable_label`, `destination_unclear`, and `other`.
- `other` requires a concise reason; all reasons are plain text and length bounded.
- Lane create/update rejects duplicate codes, stale revisions, cross-tenant IDs, and deactivation while an open session still references the lane.
- Lane labels encode an opaque, versioned `AISLEY:SORT-LANE` value and display the human lane code/name.
- Label rendering uses the existing barcode dependency and introduces no new package.

### Sort plans

- Linehaul separation/consent (2026-09-19): Sorting remains the scan/reconciliation workspace; transfers and network setup live on the separate protected Linehaul page with a Beta sidebar tag. Sort plan maps only receiver-accepted active outgoing next hubs to standard lanes and cannot create/enable connections. Linehaul lists other active hubs for connection requests; the target Logistics must accept before automatic routing can use that directed edge. Automatic lane selection follows the committed minimum driving-plus-handling-time route; it does not promise minimum kilometres. Vehicle/Courier assignment and capacity-based automatic disconnection are deferred. This supersedes the earlier unilateral selector fix and embedded transfer UI.
- Current Linehaul revision (2026-09-18): create/edit plans in labelled native dialogs; confirm deletion with expected revision and tenant ownership. Deleting an active plan leaves automatic scans on exception fallback until another is activated. Preserve historical scans. Linehaul groups sorted parcels by immediate next hub into immutable manifests, with complete-group atomic departure/receipt. Logistics manages its own service areas and outgoing connections; the Admin linehaul switch defaults on. See the current contract revision in `docs/features/logistics/hub-to-hub-routing/specs.md`, which supersedes earlier flag/transfer UI wording below.
- A sort plan belongs to the authenticated Logistics organization and sole hub, has a unique name, revision, active flag, and creator.
- Only one plan can be active for a hub. Activating a plan deactivates the previous plan and increments its revision.
- A plan mapping stores one normalized four-digit postal code, one active standard lane, and a display position; a postal code cannot be duplicated within a plan.
- Plan edits use expected revisions and never rewrite earlier sorting scans or waybill snapshots.
- The Sort plan page owns plan creation, activation, lane creation/editing, printable lane labels, and postal-code mappings; the Sorting page remains the scan/reconciliation workspace.

### Offline capture and reconciliation

- The Sorting page preloads the open session, lane definitions, and item references while online.
- Operators normally scan parcel tracking IDs into automatic plan routing; clicking a lane or scanning its lane label enables an explicit manual override.
- Camera scanning accepts only 1D Code 128 for tracking IDs and lane labels, searches densely for thin bars, and ignores 2D QR codes. Keep manual reference fallback and existing payload normalization.
- Store `client_id`, session, optional lane, automatic-routing flag, reference, expected Shipment revision, source, capture time, exception code, and reason in Dexie.
- The local predicted lane is display guidance only. The API may route a queued capture differently if the plan, postal code, or lane changed before synchronization.
- Prevent a duplicate parcel from being queued twice on the same device; do not silently replace pending work.
- Bulk-sync 1-100 entries on ten queued entries, five minutes, reconnect, or explicit **Sync scans** action.
- The batch response reports `sorted`, `exception`, or `failed` per entry; clear only committed entries.
- Failed entries remain local with stable client IDs and the server's safe code/message.
- Matching client-ID retries replay the committed result; changed payloads return an idempotency conflict.
- Multiple-device races use Shipment revisions and row locks; the server never applies last-write-wins custody.
- Session detail reports expected, pending, sorted, and exception counts plus each snapshot item's current result.

### Compact Logistics UI

- Add the sidebar label **Sorting** between **Receive at hub** and **Dispatch parcels**.
- Add a sibling **Sort plan** page for tenant-scoped plan, lane, label, and postal-code management.
- Use a compact, scan-first layout without hero treatment, excessive whitespace, large padding, or decorative cards.
- Use icon-only controls with accessible labels/tooltips for refresh, print, edit, deactivate, remove-local-entry, and camera start/stop where the icon is unambiguous.
- Keep words for consequential actions such as Start session, Close session, Sync scans, and Save lane.
- Show selected lane, online/offline state, local pending count, session counts, and sync failures without relying on color alone.
- Require confirmation before session close or lane deactivation; camera denial retains manual entry.
- Clear private Sorting data on logout/account change and isolate IndexedDB records by organization/hub/session.

### API contract

- `GET /api/v1/logistics/sorting` returns lanes, automatic-routing state, current open session, bounded session items, and counts.
- `GET /api/v1/logistics/sorting/plans` returns the authenticated organization's plans, active plan, hub lanes, context, and ID/name summaries of receiver-accepted active outgoing Logistics hubs in `next_hubs`.
- `POST /api/v1/logistics/sorting/plans` creates a named plan; `PATCH /api/v1/logistics/sorting/plans/{plan}` updates its name/active state with an expected revision.
- `POST /api/v1/logistics/sorting/plans/{plan}/lanes` maps a four-digit postal code to an active standard lane; `DELETE /api/v1/logistics/sorting/plans/{plan}/lanes/{planLane}` removes a mapping with an expected revision.
- `POST /api/v1/logistics/sorting/lanes` creates a lane.
- `PATCH /api/v1/logistics/sorting/lanes/{lane}` updates an owned lane with expected revision.
- `GET /api/v1/logistics/sorting/lanes/{lane}/label` returns a private printable SVG label.
- `POST /api/v1/logistics/sorting/sessions` opens or idempotently replays a session.
- `POST /api/v1/logistics/sorting/sessions/{session}/close` closes a reconciled session with expected revision.
- `POST /api/v1/logistics/sorting/sessions/{session}/batches` processes per-entry offline captures.
- Private reads use `Cache-Control: private, no-store`; validation distinguishes `401`, `403`, `404`, `409`, and `422`.

- Logistics camera scanning keeps the same stream across scan-handler/page-state updates, enables muted inline autoplay, and releases tracks on Stop/unmount even during startup. Unsupported preferred settings retry with basic video constraints; HTTPS, unsupported browser, permission, missing/busy camera, and playback failures show actionable errors while retaining manual entry.

### Acceptance criteria

- [x] Only the owning Logistics organization and sole hub can manage lanes, sessions, and sorting captures.
- [x] One open bounded session snapshots eligible received parcels and cannot close while work remains unresolved.
- [x] Standard-lane scans commit `sorted_at_hub` through the shared transition service with immutable metadata.
- [x] Exception-lane scans remain `received_at_hub`, require a valid reason code, and can be resolved by a later standard-lane scan.
- [x] Offline Code 128/manual captures survive reload and sync with stable idempotency and partial-result handling.
- [x] Duplicate, stale, foreign, inactive-lane, closed-session, and invalid-state captures are non-mutating.
- [x] Lane labels are printable and scanner-selectable without a new dependency.
- [x] Each Logistics organization can create and activate a tenant-scoped sort plan, create lanes on the Sort plan page, and map exact Buyer postal codes.
- [x] Automatic scan routing resolves the tracking ID and current Buyer postal code server-side, records the plan/mapping used, and falls back to an exception lane when routing data is absent or unavailable.
- [x] Dispatch shows only successfully synchronized sorted parcels.
- [x] The responsive page is compact, accessible, dark-mode compatible, and named **Sorting** in the sidebar.
- [x] The page uses dot-only online/connecting/offline feedback, consistently labels manual upload as **Sync scans**, and provides an operator-instructions dialog from the header.
- [x] Focused Laravel tests plus Logistics TypeScript, lint, and production build pass.

### Hub-routing API integration (2026-09-18)

The API extension in `docs/features/logistics/hub-to-hub-routing/specs.md` adds hub-target plan mappings and route projections for new waybills behind `HUB_ROUTING_ENABLED=false` by default. Cross-hub parcels sort against the current hub's plan and committed next hop; unavailable routes remain in the local exception lane. Current custody fields scope eligible Shipments, and a previous hub's open session cannot block the receiving hub or reveal its lane/plan. Same-hub/legacy manual sorting compatibility remains. This extends the earlier transfer non-goal through the API and existing Logistics UI. Sort plan now supports postal-code or allowed next-hub destinations; Sorting displays next-hop context; the separate Linehaul page owns online manifest departure/receipt confirmation. The server owns the route and custody. Help/refresh icons remain at the top right on mobile; Linehaul has its own Beta sidebar entry. Visual/browser and physical handoff verification remain pending, as recorded in the routing spec.

## HOW

- Add additive migrations for sorting lanes, sessions, snapshot items, idempotent scan results, sort plans, postal-code mappings, and automatic-routing metadata; store enum-like values as strings.
- Add typed PHP enums/casts, Eloquent relationships, Logistics requests/controller, and a tenant-scoped Sorting service.
- Add a dedicated fulfillment method for the sort transition so lane/session metadata is written with the immutable Shipment event.
- Reuse waybill resolution, first-mile task validation, Shipment revision checks, database transactions, and row locking.
- Seed no production lanes; Logistics creates lanes explicitly because physical layouts differ.
- Add a `sortingDb` Dexie database and a dedicated React page using the existing API/scanner/UI utilities.
- Keep the generic Parcel search recovery action for compatibility, but direct normal sortation to the Sorting page.
- Update Dispatch, Update Status, workspace/schema/domain/WIP contracts where Sorting ownership changes presentation.
- Verify migration rollback, tenant isolation, idempotent replay, exception resolution, session close conflicts, and dispatch handoff.
- Deferred extensions remain documented here for later approval and must not be implied by the MVP UI or API.

### Research references

- Microsoft documents sort positions, position verification, closing, and downstream loading work: https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/outbound-sorting
- Odoo documents barcode-driven batch processing and source/destination location scans: https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/barcode/operations/process_transfers.html
- GS1 documents unique transport-unit and location identifiers for interoperable logistics scanning: https://ref.gs1.org/guidelines/scan-4-transport/1.1.0/

## Linehaul partner routing revision — 2026-09-19

- Discover Logistics partners on Linehaul and use **Connect**; receiver acceptance is required before a next hub appears in Sort plan. Connection setup is separate from plan mappings and optional road measurements.
- For nonlocal delivery coverage, Dijkstra selects the supported next hop and automatic sorting selects its mapped local standard lane. Recipient postal codes absent from the current local plan do not independently authorize transferring to another organization.
- A new automatic capture retries a held route only at the origin in `received_at_hub`, with no existing route hops. Preserve route identity, custody, scan replay, and committed route history. Successful recalculation and sorting commit together; missing destination/path/metrics/transfer lane still holds the parcel. Planned routes and manual exception captures are unchanged.
- Coverage determines the delivery hub; destination-hub parcels missing their local postal mapping remain local exceptions. Manifest grouping is automatic; physical handoffs require confirmation.
