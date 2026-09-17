---
role: Logistics
feature: Hub-to-Hub Transfer Routing
system: AISLEY
type: Feature Specification
version: 1.0
status: API and Logistics sorting extension implemented; visual verification and operational rollout pending
scope: Laravel API, PostgreSQL, and Logistics Sorting / Sort plan UI
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Logistics.md, docs/maps-location-api.md, docs/features/orders/logistics-sorting/spec.md, docs/features/orders/lane-aware-dispatch/spec.md
---

# Hub-to-Hub Transfer Routing

## WHAT

- Add a server-owned routing loop for parcels whose Buyer destination is outside the current hub's service area.
- Preserve the existing path for local deliveries: Seller pickup → hub receipt → postal-code sorting → final-mile dispatch.
- Keep the invariant that every `LogisticsOrganization` owns exactly one operational `LogisticsHub`. The network graph may connect hubs owned by different organizations; it must not create sub-hubs or a second hub for one organization.
- Resolve the destination hub from the immutable `OrderAddress` postal code and an active, authoritative hub service-area mapping.
- Treat hubs as graph nodes and explicitly approved directed hub connections as graph edges. Geoapify supplies road measurements only; it never creates or authorizes an edge.
- Calculate and snapshot the route when the shared waybill is created. A route such as `Hub A → Hub B → Hub C → Destination Hub` is then the parcel's ordered transfer plan.
- Keep routing responsible for the next hub and sorting responsible for the current hub's local lane. Logistics A must not read or configure Logistics B's internal lanes or sort plans.
- Non-goals: new Courier web UI, customer-selected hubs, automatic edge discovery, live fleet optimization, containers, returns, rerouting after a failed handoff, transfer penalties, or operating-cost optimization in this phase.
- Operational sequence:
  ```text
  Seller pickup → origin receipt → route-target lane → transfer dispatch
  → next-hub receipt → repeat sorting/dispatch → destination postal lane → final-mile delivery
  ```

## MUST

### Destination and route authority

- Use the waybill's recipient snapshot and normalize its four-digit postal code with the existing sorting convention; never read a mutable Customer address during fulfillment.
- Set `origin_hub_id` from the Seller-selected provider's sole hub (`seller_pickup_requests.logistics_hub_id` / waybill hub). Set `destination_hub_id` from exactly one active `hub_service_areas` match.
- Do not guess when a postal code is unmapped or maps to multiple active hubs. Persist an `unresolved` route result, hold the parcel in an exception state, and require configuration or an explicit recovery action before dispatch.
- When origin and destination are equal, persist a `local` route with no transfer hops and let the current sorting and final-mile flow run unchanged.
- When they differ, load only active database edges, calculate their current road metrics, and persist the selected ordered hops before the parcel can leave the origin hub.
- Use directed edges. A reverse connection requires its own row because road travel measurements may differ by direction.
- Use Dijkstra with nonnegative edge weights. Default to travel duration in seconds, use total distance as the deterministic tie-breaker, then hop count and stable hub IDs. A bounded node/hop limit must prevent runaway graph work.

### Operational lifecycle

- At waybill creation, persist the route against the immutable waybill identity even though the current implementation materializes `Parcel`/`Shipment` lazily. Attach the route to the Shipment under lock when `ensureForWaybill` later creates or loads it; never create a duplicate Parcel or Shipment.
- Initialize the route's current node from the origin hub. The existing first-mile task, receipt scan, and `received_at_hub` transition remain unchanged for the first hub.
- During sorting, if `current_hub_id != destination_hub_id`, resolve the route's next hop and require an active local lane configured for that target hub. Dispatch the parcel to that hop and record `in_transfer`; do not create a final-mile task or project the Order to `assigned`.
- At the next hub, an authorized receiving operation validates the expected route hop, records arrival, updates the Shipment's current hub scope, and returns it to `received_at_hub`. The same `arrived → sorting → dispatch` cycle repeats.
- Once `current_hub_id == destination_hub_id`, stop consuming transfer hops. The active destination-hub sort plan maps the Buyer postal code to a local standard lane, and the existing `sorted_at_hub → dispatched_from_hub → delivery_assigned` final-mile flow applies.
- `in_transfer` is a Shipment/route milestone and must not be added to `orders.status`. `picked_up` remains the first-mile Order projection; `assigned` remains the committed final-mile assignment projection.
- Add `in_transfer` to the PHP Shipment status enum and string-backed status column for this feature. The transfer departure event owns that state; `dispatched_from_hub` remains the existing final-mile dispatch milestone.
- Snapshot the source lane on transfer departure and clear the live lane/session assignment before the next hub receives the parcel. The next hub starts with no inherited lane and cannot use the previous hub's plan.
- Every transfer departure and arrival is transactional, idempotent, revision-checked, and append-only. A duplicate scan replays its result; a stale hop, foreign hub, inactive connection, or wrong next hub returns a safe conflict/not-found response.

### Lane and tenant boundary

- Extend `sorting_plan_lanes` additively with a string-backed `destination_type` (`postal_code` or `hub`) and nullable `destination_hub_id`; preserve existing postal-code rows and their unique per-plan behavior.
- A `postal_code` destination requires a normalized four-digit code and an active standard lane. A `hub` destination requires a different active hub, an active allowed connection from the current hub, and an active standard lane in the current organization's own plan.
- Automatic sorting must select the lane whose destination matches the route's next hub. A client lane choice is advisory and cannot bypass the route or select a foreign lane.
- Logistics projections expose the current hub, next hub, route status, and safe hop metrics only. They must not expose another organization's lane IDs, plan revisions, or internal layout.
- Admin/platform operations should own service-area and connection configuration through permission-gated APIs. Logistics may read the next-hop context needed for its own hub; cross-organization topology editing is an open authorization decision.

### Data model

- Add `hub_service_areas`: `id`, `logistics_hub_id`, normalized `postal_code`, name/description as needed, active flag, revision, creator, and timestamps. Enforce one active destination hub per postal code.
- Add `hub_connections`: `id`, `from_hub_id`, `to_hub_id`, active flag, revision, creator, and timestamps. Enforce unique directed pairs, distinct endpoints, and restrictive hub deletes.
- Add `shipment_routes`: one route per waybill/Shipment, origin and destination hub IDs, route status, algorithm/objective, graph revision, total distance/duration, calculation time, and safe failure metadata. Allow a nullable Shipment link until lazy materialization.
- Add `shipment_route_hops`: route ID, sequence, from/to hub IDs, hop status, distance in meters, duration in seconds, coordinate fingerprints, provider status, departure/arrival actors and times, and idempotency metadata. Preserve the selected metric snapshot after hub coordinates or graph configuration change.
- Add `current_logistics_organization_id` and `current_hub_id` to Shipment while retaining the existing waybill/provider organization and hub as immutable origin context. Initialize both current fields from the existing Shipment fields; all operational scope queries use the current fields after rollout.
- Do not duplicate latitude/longitude or region fields on hubs. Reuse `logistics_hubs.address_id` and its confirmed coordinate pair. All new enum-like columns are database strings with PHP enum casts.

### Geoapify integration and future weights

- Add a server-only Geoapify adapter beside the existing `LogisticsDistanceService`. Use `POST https://api.geoapify.com/v1/routematrix` with `GEOAPIFY_SERVER_API_KEY`, `mode=drive`, and coordinate pairs in `[longitude, latitude]` order.
- Batch only allowed edge endpoints, read `distance` in meters and `time` in seconds, and ignore matrix cells for disallowed pairs. Use the Routing API only for an optional single-hop road trace or fallback measurement; it cannot change graph membership.
- Cache measurements by directed hub pair, coordinate fingerprints, mode, and provider options. On missing coordinates, null routes, timeout, quota, malformed data, or missing key, return an explicit unavailable metric and preserve a retryable route failure; never use zero or a straight-line distance.
- Keep credentials and full addresses off clients and logs. Persist provider name/status, metric timestamps, coordinate fingerprints, and safe request/correlation IDs; include Geoapify/OpenStreetMap attribution wherever metrics are displayed.
- Isolate `RouteWeightCalculator` behind an interface accepting duration, distance, connection metadata, and a future weight context. The current implementation uses duration/distance only; do not add fake zero `transfer_penalty` or `operating_cost` values.
- Future weighting may extend the edge snapshot and calculate a normalized cost such as `duration_weight + distance_weight + transfer_penalty + operating_cost`. Those fields, units, ownership, and currency require a separate policy and migration.

### API, testing, and rollout

- Preserve existing Seller pickup, waybill, receiving, sorting, dispatch, Courier, and Customer contracts for local routes. Add private route projections, transfer-departure, and transfer-arrival endpoints under `/api/v1/logistics/`; derive actor, organization, and current hub from Sanctum.
- Extend sorting/dispatch responses with destination type, next hub, route hop status, and metric availability. Transfer dispatch must accept current Shipment/hop revisions and an idempotency key; final-mile dispatch remains restricted to the destination hub.
- A route projection should include route status, origin/destination hub summaries, current/next hub, ordered hop sequence, safe distance/duration, and the reason for an unavailable route. Transfer write requests must not accept an arbitrary destination hub or a client-supplied route.
- Cover service-area resolution, same-hub bypass, directed Dijkstra paths, deterministic ties, no path, stale graph/metric data, provider failures, coordinate invalidation, lazy Shipment attachment, cross-tenant IDOR, duplicate scans, concurrent arrival/dispatch, exception holds, and the A → B → C → destination example.
- Roll out additive migrations and route services first, configure and verify service areas/connections second, then enable new waybill route snapshots behind a feature flag. Do not retroactively reroute in-flight waybills without a separately approved reconciliation plan.
- Measure route calculation success/failure, provider latency/quota errors, cache hit rate, no-path holds, transfer dwell time, hop conflicts, and parcels held by unresolved destination data without logging PII or route secrets.

### Acceptance criteria

- [x] A new waybill stores its origin, resolved destination, route status, and ordered route hops without changing Order status, inventory, or first-mile behavior.
- [x] A same-hub waybill follows the existing receiving, postal-code sorting, dispatch, and final-mile path with no Geoapify call.
- [x] A cross-hub waybill follows only configured directed edges and selects the deterministic shortest Dijkstra path using travel duration/distance.
- [x] Each current hub can see only its own lane/plan data and the next hub required by the route.
- [x] Transfer dispatch and arrival cannot duplicate, skip, reverse, or complete a route hop through retries or concurrent requests.
- [x] Arrival at the destination hub exits the transfer loop and enables the existing local postal-code final-mile flow.
- [x] Missing service areas, missing coordinates, unavailable provider metrics, and no path create explicit holds and never fabricate a route.
- [x] Hub pin changes and graph edits do not rewrite already committed route-hop measurements.
- [x] Existing Logistics sorting, dispatch, first-mile, final-mile, and Customer Order status tests continue to pass.

### Open decisions

- Confirm whether both Logistics organizations must consent before an Admin activates a cross-organization connection.
- Confirm whether an unresolved destination blocks waybill creation or follows the documented create-and-hold behavior.
- Confirm the transfer handoff actor/evidence contract and the metric refresh/traffic policy before physical linehaul automation is introduced.

## HOW

- Reuse `RequestSellerPickup`, `CreateWaybill`, `SortingPlanService`, `SortingService`, `FulfillmentTransitionService`, and `DispatchScheduleService`; extract only the route/bootstrap logic needed to preserve current lazy Shipment creation and status transitions.
- Keep all custody writes in `FulfillmentTransitionService` or a route-aware extension of it. Add transfer events such as `hub_transfer_dispatched` and `hub_transfer_received` to the existing append-only `shipment_events` history.
- Keep route snapshots immutable for a committed shipment. A later graph edit or hub pin correction affects future calculations and cache keys; it does not rewrite an active parcel's selected hops.
- Verify the additive migrations on SQLite and PostgreSQL, run focused route/transfer tests, then rerun existing Logistics fulfillment, sorting, dispatch, and Customer Order status suites. The Logistics Sorting / Sort plan extension is included; external Flutter implementation remains separate.

### Implemented API contract (2026-09-18)

All Logistics endpoints require Sanctum, active Logistics access, and policy consent. Responses are private/no-store. Routing adds no Logistics or Courier UI.

| Method/path | Request | Result |
| --- | --- | --- |
| `GET /api/v1/logistics/routes/{reference}` | Tracking ID/waybill reference or compatible QR value | Shipment identity/status/revision and safe route projection. Current custody owner may read it; the expected receiving hub may read only this safe projection while its hop is `in_transfer`. |
| `POST /api/v1/logistics/transfers/departures` | Transfer body below and UUID `Idempotency-Key` | Commits `sorted_at_hub → in_transfer`, snapshots the local source lane, clears live lane/session, and appends `hub_transfer_dispatched`. |
| `POST /api/v1/logistics/transfers/arrivals` | Transfer body below and UUID `Idempotency-Key` | Commits the expected arriving hop, changes current organization/hub, resets lane/session, records receipt time, and appends `hub_transfer_received`. |
| `GET /api/v1/admin/hub-routing/service-areas` | Optional `page`, `per_page=1..100` | Bounded configuration list; requires `platform-settings.view`. |
| `POST /api/v1/admin/hub-routing/service-areas` | `logistics_hub_id`, four-digit `postal_code`, optional `is_active` | Creates postal coverage; requires `platform-settings.manage`; one active hub per postal code. |
| `PATCH /api/v1/admin/hub-routing/service-areas/{id}` | `expected_revision`, `is_active` | Revision-checked activation/deactivation; hub/postal identity cannot be changed. |
| `GET /api/v1/admin/hub-routing/connections` | Optional `page`, `per_page=1..100` | Bounded directed-edge list; requires `platform-settings.view`. |
| `POST /api/v1/admin/hub-routing/connections` | `from_hub_id`, `to_hub_id`, optional `is_active` | Creates a unique directed connection between different hubs; requires `platform-settings.manage`. |
| `PATCH /api/v1/admin/hub-routing/connections/{id}` | `expected_revision`, `is_active` | Revision-checked activation/deactivation; endpoints cannot be changed. |

Admin routes also require active Admin access and policy consent. Configuration writes use the existing platform-settings permission boundary and audit outbox. Logistics cannot edit network topology. Admin activation is the implementation baseline; bilateral organization consent remains a policy decision before operational rollout.

```json
{
  "reference": "AWB-TRACKINGREFERENCE",
  "hop_id": "current-hop-uuid",
  "expected_revision": 5,
  "expected_hop_revision": 1
}
```

- Both transfer writes return `200 {data: {shipment_id, status, revision, event_id, route}}`. Matching actor/key/body retries replay the committed transfer result even after custody moves. Changed payloads conflict; foreign references return scoped `404`; stale revisions, skipped hops, inactive connections, and incompatible states return safe `409`. Unknown body fields, arbitrary destinations, and invalid/missing UUID keys return `422`.
- Route status is `local`, `planned`, `unresolved`, `unavailable`, or `completed`. Projection includes origin/destination/current/next hub summaries, ordered hop IDs/statuses/revisions, snapshot metres/seconds, metric availability, safe failure code, and Geoapify/OpenStreetMap attribution. It excludes lanes, plan revisions, coordinate fingerprints, credentials, provider URLs, and full addresses.
- Extend the existing `POST /api/v1/logistics/sorting/plans/{plan}/lanes` with `destination_type=hub` and `destination_hub_id` instead of `postal_code`; the existing `lane_id` and `expected_revision` remain required. Only an active allowed outgoing connection and the caller's active standard lane are valid. Postal mappings retain their existing contract.
- Cross-hub route captures use authoritative routing even when a manual standard lane is supplied. Explicit local exception-lane captures still allow damage/unreadable holds without advancing custody. Missing routes/plans/hub mappings select the active local exception lane. Destination-hub sorting returns to postal-code mappings from the immutable waybill recipient. Same-hub and legacy parcels retain their existing manual sorting/recovery compatibility.
- Shipment records and sorting session item projections add `route`; operational queues, final-mile task reads, delivery hub context, and evidence/completion notifications use current custody scope. A historical session never exposes the next organization's lane/plan. Old receiving/transition retry paths recheck current custody before returning operational details.
- Transfer writes record the authenticated Logistics actor, server timestamp, reference-linked parcel, hop, and append-only custody event. No linehaul Courier assignment or additional handoff evidence contract is invented. First-mile inventory effects and final-mile proof requirements remain unchanged.

### Implementation rollout and verification

- Run additive migrations, seed the existing Admin permissions, configure/verify service areas and directed connections, confirm hub pins, and create each organization's local hub-target/postal sort-plan mappings before enabling `HUB_ROUTING_ENABLED=true` with the server Geoapify key configured.
- The default `HUB_ROUTING_ENABLED=false` controls new waybill snapshot creation only. Disabling it later does not remove committed routes or strand their transfer endpoints. Existing waybills never acquire routes through lazy Shipment reads; no retroactive reconciliation is performed.
- Use bounded graph limits (100 hubs, 300 edges, 32 hops), 1×N matrices grouped by allowed source, and 24-hour coordinate-fingerprint caches. Measure only origin-reachable configured edges; unavailable metrics there hold the route rather than silently optimizing an incomplete graph. Matrix requests share the existing daily credit bucket with pickup manifests. Measurements use explicit `drive`, metric units, free-flow traffic, and balanced road routes; historical hop metrics remain fixed.
- Safe failure codes include `destination_unresolved`, `no_path`, `coordinates_missing`, `key_missing`, `quota`, `timeout`, `malformed`, `provider_error`, `route_unavailable`, `graph_changed`, `graph_limit`, and `hop_limit`. Provider exceptions are not logged because they can include credentials. Safe calculation, metric/cache/latency, and transfer-duration events provide initial observability.
- Held immutable routes are not retried or rerouted by a topology edit or document read. An operational recovery/reconciliation policy and explicit action remain separate; do not enable production routing until handling these holds is agreed. Optional single-hop road traces, live traffic refresh, bilateral connection consent, physical linehaul automation, and additional transfer evidence remain deferred.
- Focused coverage includes route snapshots without materialization, lazy identity attachment, same-hub compatibility, immutable postal routing, directed weighted paths and deterministic ties, no path, graph/hop limits, graph changes, coordinate invalidation, provider/quota failures, exception holds, scoped access, stale/skipped hops, retry replay, and four-hub destination final-mile assignment. PostgreSQL worker tests exercise duplicate departures and competing arrivals on independent connections.

- Verification: focused routing/configuration/path/migration tests pass on SQLite (22 passed, 313 assertions; one PostgreSQL-only concurrency test skipped) and PostgreSQL (23 passed, 338 assertions). Broader SQLite Logistics, Customer status/mutations, and Seller acceptance coverage passes 92 tests/1,440 assertions with the same concurrency skip; the later targeted fulfillment/routing run passes 31 tests/633 assertions plus that skip. Existing PostgreSQL fulfillment, pickup/waybill, notification, and Customer status coverage passes 33 tests/708 assertions; its older SQLite-only lane-migration test is excluded there and passes on SQLite. Laravel Pint passes. Geoapify responses are mocked; live road-network/physical handoff verification remains an operational rollout gate.

### Migration boundaries

- Use new timestamped migrations only; do not edit the executed Logistics, waybill, fulfillment, or sorting migrations.
- Add partial unique indexes and check constraints for active service-area ownership, directed edge uniqueness, valid route targets, and ordered hops where the two supported databases allow them.
- Keep route and hop status values as strings and cast them to PHP enums; do not introduce PostgreSQL native enum columns.
- Make all new foreign keys restrictive by default so route history cannot disappear when a hub or connection is retired.

### References

- Project policy: [Maps, Address, and Location API Policy](../../../maps-location-api.md).
- Geoapify: [Route Matrix API](https://apidocs.geoapify.com/docs/route-matrix/), [Routing API](https://apidocs.geoapify.com/docs/routing/), and [pricing](https://www.geoapify.com/pricing/).

### Logistics frontend extension (2026-09-18)

Hub routing extends the existing **Sorting** and **Sort plan** pages, with no separate sidebar feature. Sort plan maps either an exact postal code or an allowed next hub to an active standard lane. `GET /api/v1/logistics/sorting/plans` now includes `next_hubs` containing only `{id, name}` for active directed connections from the authenticated hub to active Logistics accounts; foreign topology, lanes, and plans remain excluded. Existing mappings to unavailable hubs remain removable and display an unavailable state.

Sorting reconciliation shows the committed next hub or route hold alongside the authoritative predicted lane. Its **Hub transfer** section accepts a tracking ID, waybill reference, or compatible QR value and shows current/destination/next hubs, route-hop states, departure/arrival timestamps, and safe estimated metrics with provider attribution. It confirms physical departure only after sorting at the sending hub, or physical arrival only at the expected receiving hub. Confirmation includes the server-supplied Shipment/hop revisions and a UUID idempotency key. Ambiguous network failures retain the same request/key for retry during the mounted workspace; a definitive rejection clears stale details and requires another lookup. Transfer confirmations are online-only; the existing offline sorting outbox is unchanged. No route editor, reroute, hold-recovery action, provider request, network editor, or linehaul Courier assignment is introduced in Logistics.

Both page headers keep small labelled help and refresh icon buttons at the top right, including mobile. Instructions live in native dialogs. The UI retains project colors and dark mode, uses compact borders/spacing, and adapts the forms, scanner, transfer panel, and reconciliation list across mobile, tablet, FHD, 1980×1080, and wider device viewports.

Frontend acceptance:

- [x] Hub-target mappings extend Sort plan without a separate navigation section and preserve postal-code mappings.
- [x] Sorting displays safe next-hop context and holds without exposing another hub's layout.
- [x] Physical departure/arrival confirmations use authoritative hops, expected revisions, confirmation prompts, and matching-key retries after uncertain network failures.
- [x] Transfer actions require a connection; offline sorting captures keep their existing behavior.
- [x] Compact responsive layouts, dark mode, labelled icon navigation, and top-right help/refresh controls are implemented.
- [x] Logistics TypeScript, lint, and production build pass; focused route/configuration-summary and fulfillment regressions pass (30 tests / 614 assertions).
- [ ] Browser interaction and visual checks at the current device resolution, 1980×1080, 1920×1080, tablet, and mobile, including dark mode, offline failures, and ambiguous-response retry.
- [ ] Physical barcode/camera and real inter-hub handoff verification.

The runtime routing flag still defaults to disabled for newly created waybills. Platform network configuration, hold-recovery policy, bilateral consent, and physical linehaul rollout retain their existing boundaries. Admin network configuration continues through the existing permission-gated API; this extension does not add an Admin frontend.
