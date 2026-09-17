---
role: Logistics
feature: Hub-to-Hub Transfer Routing
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Laravel API, PostgreSQL, and internal Logistics hub operations
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

- [ ] A new waybill stores its origin, resolved destination, route status, and ordered route hops without changing Order status, inventory, or first-mile behavior.
- [ ] A same-hub waybill follows the existing receiving, postal-code sorting, dispatch, and final-mile path with no Geoapify call.
- [ ] A cross-hub waybill follows only configured directed edges and selects the deterministic shortest Dijkstra path using travel duration/distance.
- [ ] Each current hub can see only its own lane/plan data and the next hub required by the route.
- [ ] Transfer dispatch and arrival cannot duplicate, skip, reverse, or complete a route hop through retries or concurrent requests.
- [ ] Arrival at the destination hub exits the transfer loop and enables the existing local postal-code final-mile flow.
- [ ] Missing service areas, missing coordinates, unavailable provider metrics, and no path create explicit holds and never fabricate a route.
- [ ] Hub pin changes and graph edits do not rewrite already committed route-hop measurements.
- [ ] Existing Logistics sorting, dispatch, first-mile, final-mile, and Customer Order status tests continue to pass.

### Open decisions

- Confirm whether both Logistics organizations must consent before an Admin activates a cross-organization connection.
- Confirm whether an unresolved destination blocks waybill creation or follows the documented create-and-hold behavior.
- Confirm the transfer handoff actor/evidence contract and the metric refresh/traffic policy before physical linehaul automation is introduced.

## HOW

- Reuse `RequestSellerPickup`, `CreateWaybill`, `SortingPlanService`, `SortingService`, `FulfillmentTransitionService`, and `DispatchScheduleService`; extract only the route/bootstrap logic needed to preserve current lazy Shipment creation and status transitions.
- Keep all custody writes in `FulfillmentTransitionService` or a route-aware extension of it. Add transfer events such as `hub_transfer_dispatched` and `hub_transfer_received` to the existing append-only `shipment_events` history.
- Keep route snapshots immutable for a committed shipment. A later graph edit or hub pin correction affects future calculations and cache keys; it does not rewrite an active parcel's selected hops.
- Verify the additive migrations on SQLite and PostgreSQL, run focused route/transfer tests, then rerun existing Logistics fulfillment, sorting, dispatch, and Customer Order status suites. No frontend or external Flutter implementation is part of this specification.

### Migration boundaries

- Use new timestamped migrations only; do not edit the executed Logistics, waybill, fulfillment, or sorting migrations.
- Add partial unique indexes and check constraints for active service-area ownership, directed edge uniqueness, valid route targets, and ordered hops where the two supported databases allow them.
- Keep route and hop status values as strings and cast them to PHP enums; do not introduce PostgreSQL native enum columns.
- Make all new foreign keys restrictive by default so route history cannot disappear when a hub or connection is retired.

### References

- Project policy: [Maps, Address, and Location API Policy](../../../maps-location-api.md).
- Geoapify: [Route Matrix API](https://apidocs.geoapify.com/docs/route-matrix/), [Routing API](https://apidocs.geoapify.com/docs/routing/), and [pricing](https://www.geoapify.com/pricing/).
