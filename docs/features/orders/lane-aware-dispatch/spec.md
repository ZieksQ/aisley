# Lane-aware Sorting and Dispatch

## WHAT

- Status: implemented; acceptance evidence recorded below.
- Date: 2026-09-16.
- Updated: automatic postal-code sort-plan routing is the default scan path; manual lane selection remains an explicit override.
- Role: the active Logistics account operating its organization's sole hub.
- Scope: Laravel API, PostgreSQL schema, and Logistics React dashboard.
- Connect physical sorting lanes with the ready queue and bulk dispatch.
- Keep staging assignment separate from Shipment custody state.
- Keep a parcel's lane available after its sorting session closes.
- Freeze source-lane provenance when a dispatch schedule is created.
- Allow staff to relocate a sorted parcel before assigning delivery work.
- Preserve offline sorting capture and per-parcel synchronization.
- Preserve one Courier per schedule and one final-mile task per parcel.
- A standard lane is an identified physical staging area inside this hub.
- An exception lane is a review area whose parcels are not dispatch-ready.
- A session is a bounded reconciliation snapshot, not a delivery batch.
- A dispatch schedule groups 1–15 ready parcels for one approved Courier.
- Non-goals:
  - geocoding, postal ranges, or geographic compatibility beyond exact mappings in an active sort plan;
  - Courier availability, route optimization, vehicle or lane capacity;
  - containers, bags, seals, loading manifests, or inter-hub transfers;
  - new Courier web screens, staff accounts, or Order statuses.

---

## MUST

### Authority and isolation

- Require Sanctum, active Logistics role/status, and current policy consent.
- Derive organization, hub, and actor from the authenticated account.
- Reject foreign Shipment, lane, and Courier IDs without mutation/disclosure.
- Resolve current custody, lane type/activity, and revisions on the server.
- Keep custody changes and append-only events in FulfillmentTransitionService.
- Keep Seller/Customer/Courier projections isolated from Logistics lane UI.

### Sorting and lane lifecycle

- Start a session only with an active standard lane and eligible received parcels.
- Snapshot at most 100 parcels and retain the one-open-session-per-hub rule.
- Order eligibility by authoritative receipt time, then Shipment ID.
- Use creation time only as the ordering fallback for legacy missing receipts.
- Persist receipt time from the server's receipt commit, not the device clock.
- Retain device capture time separately in the existing receipt event metadata.
- Standard-lane synchronization records lane/session and advances sorted custody.
- Exception synchronization retains received custody and operational hold details.
- Automatic synchronization resolves the tenant-owned tracking ID, Buyer postal code, and current active sort plan on the server; a client-predicted lane is advisory only.
- A missing plan, missing postal code, unmapped postal code, or unavailable mapped lane is recorded in the active exception lane with a routing reason and plan/mapping metadata when available.
- The Sort plan page owns plan activation, lane creation, printable lane labels, and exact postal-code mappings; Sorting owns scan/reconciliation and may request a manual standard-lane override.
- Resolve exceptions through a standard-lane capture with existing retry rules.
- A generic sort transition cannot bypass an unresolved sorting exception.
- Close sessions only after all items reconcile; the client also checks its outbox.
- Closure does not erase the parcel's staging assignment.
- A ready parcel may dispatch while its session remains open or has exceptions.
- Block lane deactivation/type changes while parcels remain staged, through delivery acceptance.
- Continue blocking those edits when an open session references the lane.
- Renaming a lane increments its revision and invalidates stale dispatch selections.

### Moving sorted parcels

- Offer an online Move lane action in Sorting and the Dispatch ready queue.
- Require another active standard lane in the same organization/hub.
- Require current Shipment revision, destination-lane revision, and bounded reason.
- Reject same-lane moves, stale revisions, inactive/exception lanes, and foreign IDs.
- Permit moves only while custody is sorted_at_hub, before dispatch/assignment.
- Increment Shipment revision and update the current open session item assignment.
- Preserve closed session item history; moves change the durable Shipment assignment.
- Append hub_lane_move with old/new lane IDs, actor, reason, and request hash.
- Preserve sorted custody; do not recreate a sorting session or delivery task.
- Replay an identical idempotency key without a second move/event.
- Reject the same key with another payload.

### Dispatch integration

- The 2026-09-23 company-truck extension adds a separate linehaul scheduler inside Dispatch. It groups by immediate destination Logistics hub across source lanes, uses the selected truck's `max_parcels`, and never creates final-mile tasks. The existing final-mile workflow below retains its independent 15-parcel limit. See `docs/features/logistics/company-truck-linehaul-dispatch/spec.md`.

- Linehaul is a separate manifest flow for parcels whose committed route still requires another hub. Group only by the immediate next hub; atomic transfer departure/receipt never creates final-mile tasks. Manifest members cannot use individual transfer endpoints. Final-mile schedule rules below remain destination-only. See the current Linehaul contract revision in `docs/features/logistics/hub-to-hub-routing/specs.md`.
- Expose lane counts across the scoped ready query before applying its lane filter.
- Filter ready parcels by lane or the explicit unassigned legacy bucket.
- Support reference search and 25-row pagination, oldest receipt first.
- Default to one source lane per batch; select up to 15 from that lane.
- Combining lanes requires explicit combine_lanes=true.
- Compatibility means active standard lanes in this sole hub; it implies no route rule.
- Send each selected parcel's Shipment revision, lane ID, and lane revision.
- Require assignments for lane-sorted parcels; reject incomplete/extra assignments.
- Compare assignments under transaction locks before creating any schedule.
- Lane-less legacy parcels remain dispatchable and visibly unassigned.
- Mixed assigned/unassigned batches also require explicit combining opt-in.
- Recheck the Courier's active account and approved sole-hub affiliation.
- Commit schedule, membership, dispatch events, tasks, offers, and Order projection atomically.
- Roll back the entire schedule if any parcel's final-mile offer fails.
- Snapshot source lane ID/code/name/revision, session ID, and pre-dispatch Shipment revision.
- Preserve snapshots when a lane is subsequently renamed or deactivated.
- Preserve per-task Courier acceptance/rejection and existing re-offer history.
- Require existing QR evidence validation for physical Courier hub pickup.
- Clear the live lane at validated hub pickup; retain session/history/snapshots.
- Reuse a dispatch idempotency key when retrying an unchanged submitted payload.

### Responsive behavior

- Mobile: wrap filters/actions, break long references, and use reconciliation rows.
- Tablet: retain readable rows and stacked schedule controls below the desktop breakpoint.
- Desktop: use a bounded workspace and adjacent dispatch schedule controls.
- Sort-plan management is a separate compact responsive page; Sorting remains focused on capture, reconciliation, and exception resolution.
- Use existing dashboard palette, dark mode, and shared operation controls.
- Keep dialogs within 90% of viewport height with internal scrolling.
- Avoid a wide reconciliation table as the mobile interaction surface.
- Current screen dimensions cannot be detected in this tool session; requested from the user.

### Acceptance and evidence

- [x] Durable lane/session assignment persists beyond closure — lane-move regression.
- [x] Receipt-time ordering survives unrelated updates/reversed sorting — ordering regression.
- [x] Online moves preserve custody and increment revision once — lane-move regression.
- [x] Move retries replay; changed payload and foreign Shipment fail — lane-move regression.
- [x] Closed-session staged parcels prevent lane deactivation — lane-move regression.
- [x] Stale dispatch assignment fails and source labels survive rename — provenance regression.
- [x] Mixed lanes require opt-in and preserve both source snapshots — mixed-lane regression.
- [x] Ready parcels dispatch despite an open exception session — mixed-lane regression.
- [x] Exception parcels cannot dispatch or bypass the hold — mixed-lane regression.
- [x] A later offer failure rolls back earlier parcel work — mixed-lane regression.
- [x] Lane filters/counts and legacy unassigned dispatch work — queue/legacy regressions.
- [x] Additive migration round trip/backfill preserves marked history — migration regression.
- [x] Validated hub pickup clears the live lane and retains provenance — handoff regression.
- [x] Each Logistics tenant can create an active sort plan, create standard/exception lanes, and map exact four-digit postal codes — plan/routing regression.
- [x] Automatic scan routing records the matched plan/lane or exception reason and falls back to the exception lane when routing input or configuration is unavailable — plan/routing regression.
- [x] Logistics lint, TypeScript compilation, and production build pass.
- [ ] Rendered mobile/tablet/1920×1080 viewport checks — no browser tool available.
- [ ] Rendered current-resolution check — dimensions/browser unavailable in this session.

---

### Hub-routing API integration (2026-09-18)

`docs/features/logistics/hub-to-hub-routing/specs.md` adds separate transfer-departure/arrival endpoints. Final-mile schedules now use current Shipment organization/hub scope and reject unresolved or unfinished hub routes. Transfer departure snapshots the source lane on the hop and clears live lane/session assignments without creating a delivery task or projecting the Order to `assigned`. Arrival enables the next hub's own sorting cycle; destination arrival enables the existing final-mile schedule flow. Historical dispatch snapshots remain unchanged.

## HOW

- Add 2026_09_16_000001_add_shipment_lane_assignments; never change executed migrations.
- Add additive sorting-plan, postal-code mapping, and automatic-routing scan metadata migrations; never change executed migrations.
- Store Shipment sorting_lane_id, sorting_session_id, and received_at_hub_at separately from status.
- Add source_lane JSON, sorting_session_id, and shipment_revision_at_dispatch to memberships.
- Backfill receipt from first recorded receipt event and assignment from sorted session items.
- Historical source labels use today's lane definition, marked historical_backfill=true.
- Leave unknowable historical dispatch revisions null; never invent original labels/revisions.
- Do not restore live lanes for parcels already beyond accepted delivery custody.
- Add POST /api/v1/logistics/sorting/shipments/{shipment}/move with UUID Idempotency-Key.
- Add tenant-scoped `GET/POST /sorting/plans`, `PATCH /sorting/plans/{plan}`, and plan-lane add/remove endpoints; never accept a foreign organization, hub, or lane.
- Extend GET /api/v1/logistics/dashboard/queue with lane_id and summary.by_lane.
- Extend dispatch POST with combine_lanes and assignments; keep shipment_ids/courier/time contract.
- Reuse SortingService, FulfillmentTransitionService, and DispatchScheduleService transactions.
- Reuse Dexie captures unchanged; lane moves require an authoritative online response.
- Use ParcelLaneMove in both workspaces and retain existing CourierPicker behavior.
- Regression evidence: tests/Feature/Logistics/FinalMileFulfillmentTest.php.
- Automatic matched-routing, no-plan exception fallback, scan metadata, pickup-time routing snapshot, and tenant-scope evidence are covered by Logistics regression tests.
- Broader Logistics/Courier and CustomerOrderStatusTest checks pass: 80 tests/1,190 assertions.
- PostgreSQL: migration dry run and local additive migration application passed.
- Rendered responsive acceptance remains open; source/build checks do not substitute for it.
- Research basis: [Microsoft outbound sorting](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/outbound-sorting) connects sorting positions and downstream staging/loading work.
- Research basis: [Odoo barcode transfers](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/barcode/operations/process_transfers.html) separates physical location scanning from transfer validation.
- These sources inform physical staging/validation; this project's single-hub compatibility policy is a local design choice.
