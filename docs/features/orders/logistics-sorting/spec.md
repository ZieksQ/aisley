---
feature: logistics-sorting
title: Logistics Sorting
system: AISLEY
type: Feature Specification
version: 1.0
status: Implemented MVP; advanced automation and containerization deferred
role: Logistics
scope: Logistics API and Logistics web application
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Logistics.md, docs/features/logistics/update-status/specs.md, docs/features/logistics/deploy-rider/specs.md
---

# Logistics Sorting

## WHAT

- Provide a dedicated **Sorting** workspace between **Receive at hub** and **Dispatch parcels**.
- Let the owning Logistics account organize received parcels into physical hub lanes using waybill Code 128, QR, or manual references.
- Keep physical work available during connectivity loss by saving captured scans in a device-local outbox.
- Treat offline scans as provisional; only a successful API response commits `sorted_at_hub`.
- Reuse the sole organization/sole hub, shared waybill, Parcel, Shipment, Delivery Task, and transition-service contracts.
- Support one open sorting session per hub and a bounded snapshot of up to 100 oldest `received_at_hub` parcels.
- Support configurable standard and exception lanes with printable, scannable lane labels.
- Keep sorting internal to Logistics; Customer, Seller, Admin, and Courier receive no Sorting UI or mutation route.
- Keep high-level Order status unchanged while a parcel is received, sorted, or placed in a sorting exception.
- Non-goals for this MVP:
  - automatic destination-to-lane recommendations or enforcement;
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

### Offline capture and reconciliation

- The Sorting page preloads the open session, lane definitions, and item references while online.
- Operators select a lane by clicking its row or scanning its lane label, then scan parcel references into that lane.
- Support Code 128, the existing waybill QR payload, and manual reference fallback.
- Store `client_id`, session, lane, reference, expected Shipment revision, source, capture time, exception code, and reason in Dexie.
- Prevent a duplicate parcel from being queued twice on the same device; do not silently replace pending work.
- Bulk-sync 1-100 entries on ten queued entries, five minutes, reconnect, or explicit **Sync scans** action.
- The batch response reports `sorted`, `exception`, or `failed` per entry; clear only committed entries.
- Failed entries remain local with stable client IDs and the server's safe code/message.
- Matching client-ID retries replay the committed result; changed payloads return an idempotency conflict.
- Multiple-device races use Shipment revisions and row locks; the server never applies last-write-wins custody.
- Session detail reports expected, pending, sorted, and exception counts plus each snapshot item's current result.

### Compact Logistics UI

- Add the sidebar label **Sorting** between **Receive at hub** and **Dispatch parcels**.
- Use a compact, scan-first layout without hero treatment, excessive whitespace, large padding, or decorative cards.
- Use icon-only controls with accessible labels/tooltips for refresh, print, edit, deactivate, remove-local-entry, and camera start/stop where the icon is unambiguous.
- Keep words for consequential actions such as Start session, Close session, Sync scans, and Save lane.
- Show selected lane, online/offline state, local pending count, session counts, and sync failures without relying on color alone.
- Require confirmation before session close or lane deactivation; camera denial retains manual entry.
- Clear private Sorting data on logout/account change and isolate IndexedDB records by organization/hub/session.

### API contract

- `GET /api/v1/logistics/sorting` returns lanes, current open session, bounded session items, and counts.
- `POST /api/v1/logistics/sorting/lanes` creates a lane.
- `PATCH /api/v1/logistics/sorting/lanes/{lane}` updates an owned lane with expected revision.
- `GET /api/v1/logistics/sorting/lanes/{lane}/label` returns a private printable SVG label.
- `POST /api/v1/logistics/sorting/sessions` opens or idempotently replays a session.
- `POST /api/v1/logistics/sorting/sessions/{session}/close` closes a reconciled session with expected revision.
- `POST /api/v1/logistics/sorting/sessions/{session}/batches` processes per-entry offline captures.
- Private reads use `Cache-Control: private, no-store`; validation distinguishes `401`, `403`, `404`, `409`, and `422`.

### Acceptance criteria

- [x] Only the owning Logistics organization and sole hub can manage lanes, sessions, and sorting captures.
- [x] One open bounded session snapshots eligible received parcels and cannot close while work remains unresolved.
- [x] Standard-lane scans commit `sorted_at_hub` through the shared transition service with immutable metadata.
- [x] Exception-lane scans remain `received_at_hub`, require a valid reason code, and can be resolved by a later standard-lane scan.
- [x] Offline Code 128/QR/manual captures survive reload and sync with stable idempotency and partial-result handling.
- [x] Duplicate, stale, foreign, inactive-lane, closed-session, and invalid-state captures are non-mutating.
- [x] Lane labels are printable and scanner-selectable without a new dependency.
- [x] Dispatch shows only successfully synchronized sorted parcels.
- [x] The responsive page is compact, accessible, dark-mode compatible, and named **Sorting** in the sidebar.
- [x] The page uses dot-only online/connecting/offline feedback, consistently labels manual upload as **Sync scans**, and provides an operator-instructions dialog from the header.
- [x] Focused Laravel tests plus Logistics TypeScript, lint, and production build pass.

## HOW

- Add an additive migration for sorting lanes, sessions, snapshot items, and idempotent scan results; store enum-like values as strings.
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
