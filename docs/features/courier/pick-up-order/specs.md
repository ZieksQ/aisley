---
role: Courier / Rider
feature: courier-pick-up-order
title: Pick Up Order
system: AISLEY
type: Feature Specification
version: 2.6
status: Implemented first-mile pickup and shared final-mile handoff bridge
implementation_status: First-mile Courier API, route-manifest API, and final-mile companion backend are implemented; Flutter remains external
canonical: true
scope: Laravel API, development-only React courier mockup, and external Flutter Courier mobile application
backend_contract_commit: d5c160d4a5a21272e487b6f46a82de35e81395cb
backend_contract_version: first-and-final-mile-pickup-v1
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Courier.md, docs/domains/Logistics.md
---

> **Authority:** `docs/features/orders/logistics-pickups/spec.md` owns Seller-to-Logistics scheduling, and `docs/features/orders/waybill/spec.md` owns the shared waybill and QR identity. This document owns Courier pickup from Seller (first mile) and hub-pickup evidence submission (final mile). Logistics Update Status owns authoritative hub-handoff validation; Deliver Order owns subsequent travel.

# Pick Up Order Specification

## WHAT
- **Purpose:** Let the selected Courier review a scheduled bulk pickup, identify each assigned parcel, and confirm physical possession from the Seller.
- **Actors:** Seller prepares Orders; Logistics selects one approved Courier and a pickup window; Courier performs the mobile pickup; the API remains authoritative for ownership and state.
- **Scope:** Courier task receipt, schedule/address/order details, route-manifest consumption, QR/manual identifier verification, first-mile pickup confirmation, and final-mile hub-handoff evidence submission.
- **Mobile boundary:** Production Courier screens, secure token storage, offline decoding, and device accessibility belong to the external Flutter app. `src/couriermockup` is a development-only React harness for verifying the same bearer-token API, camera/manual input states, and handoff behavior in a browser; it is not a deployable Courier web application.
- **Current implementation:** Logistics scheduling creates one `first_mile_task` per selected Order, in `assigned`, for the chosen Courier. The Courier can list and accept tasks, resolve an assigned waybill QR, and explicitly confirm pickup with either the QR payload or printed Order reference. Confirmation resolves the identifier to its matching parcel in the open schedule, records immutable idempotency/history data, sets the task to `picked_up_from_seller`, advances the Order to `picked_up`, and fulfills the Order's Inventory reservation atomically. Each committed schedule revision also creates a queued route manifest: the server groups parcels sharing one immutable pickup address, resolves exact or maintained address-default coordinates, calls the bounded Geoapify Matrix API, applies the deterministic nearest-next-stop heuristic, obtains bounded Routing API road geometry through Logistics → pickups → Logistics, stores the result, and serves sanitized GeoJSON to the authorized Courier. The additive fulfillment bridge creates one shared Parcel/Shipment and links the legacy first-mile task without replaying Inventory; Logistics can then receive, sort, and dispatch the parcel, offer an independent final-mile task, and validate final-mile QR handoff/delivery completion through the owning operational APIs.
- **Not implemented yet:** The production Flutter screens, Courier notification read/push endpoint, turn-by-turn navigation, Logistics dashboard UI for the new operational routes, photo/signature proof, and location telemetry.

### Scheduled bulk-pickup flow

```text
Seller packs Orders and requests one Logistics provider
→ Orders become ready_for_pickup and immutable waybills are created
→ selected Logistics schedules 1–30 Orders with one approved Courier and UTC window
→ API creates one assigned first-mile task per Order and a post-commit Courier notification
→ Courier lists the schedule and task details, then accepts the task
→ Courier scans the waybill QR or enters the displayed Order ID/reference
→ API validates the match and Courier explicitly confirms physical pickup
→ task = picked_up_from_seller
→ Order = picked_up
→ Logistics receives, sorts, and dispatches each parcel through Update Status
```
- A Seller request may contain up to 50 Orders, but Logistics must split it into schedules of at most 30 Orders.
- A first-mile schedule may group multiple Sellers/pickup origins within the same Logistics organization; each parcel retains its own task and immutable waybill.

### Ownership and non-goals
- Pick Up Order owns parcel verification, physical handoff confirmation, pickup timestamp/actor, transition history, and the handoff to the next Logistics feature.
- Seller selects the Logistics provider. Logistics owns Courier eligibility, scheduling, hub validation, and final-mile assignment.
- Waybill creation/printing, Seller packing, Courier assignment, hub receipt, sorting, dispatch, delivery, proof of delivery, earnings, and incident resolution are outside this feature.

## MUST

### Access and tenant rules
- Require `Authorization: Bearer <token>`, `auth:sanctum`, the persisted `courier` role, an active Courier account, an approved affiliation, an active Logistics organization, and its valid sole hub on every request.
- Resolve Courier, organization, hub, schedule, task, Order, and waybill ownership server-side. Never trust client `courier_id`, `organization_id`, `hub_id`, status, or assignment fields.
- A foreign, cancelled, reassigned, unknown, or stale task must fail closed without disclosing whether another record exists.
- First-mile and final-mile assignments remain independent. Completing `picked_up_from_seller` never grants final-mile work.

### Courier receipt and detail view
- After schedule commit, notify only the selected Courier after the transaction commits. Current delivery is a database notification plus a task-list deep link; push transport remains planned.
- The task list must show, when authorized: schedule reference, pickup date/window, schedule timezone, Seller/shop name, complete pickup address snapshot, Order reference/ID, waybill reference, destination area, task status, and `pickup_schedule_id`.
- Display times in Asia/Manila while the API transports UTC ISO-8601 values. Do not expose product names, prices, COD amounts, Buyer phone numbers, private evidence, or unrelated destination details.
- Opening or refreshing details is read-only. The app must not infer custody from a notification, cached row, `assigned`, or `accepted` alone.
- The Courier may accept only an assigned task through the existing acceptance endpoint. Pickup confirmation requires the current task to be accepted unless the shared dispatch policy explicitly changes.

### First-mile pickup verification and status
- Provide two input methods: scan the waybill QR, or manually enter the human-readable Order ID/reference printed on the waybill. Both use the same server validation.
- QR decoding treats the payload as untrusted text. It must accept only the Aisley waybill format mapped by the backend; arbitrary URLs/scripts are never opened or executed.
- Scanning or typing only fills a verification candidate. An explicit **Confirm pickup** action is required before the physical-custody mutation.
- At confirmation, atomically verify active waybill, identifier-to-Order mapping, task membership, selected Courier, organization/hub, accepted task status, schedule eligibility, and current transition.
- Commit the detailed first-mile state `accepted → picked_up_from_seller`, the high-level Order transition `ready_for_pickup → picked_up`, actor, timestamp, and immutable event/history exactly once. The detailed task event remains the authoritative proof of Seller handoff; do not invent `in_transit`.
- Return the server-authoritative task and Order statuses. Logistics receipt is owned by Update Status and is now available through its separate organization-scoped API; Courier pickup owns both leg-specific submissions, not Logistics receipt or validation.
- A copied QR, guessed Order ID, or task UUID cannot authorize pickup. A wrong or unknown identifier causes no mutation.

### Final-mile hub pickup — implemented API
- Logistics dispatches and offers an independent final-mile task; the Courier accepts through Accept Delivery Requests.
- `GET /api/v1/courier/final-mile-tasks` returns `{data:[]}`; `GET /api/v1/courier/final-mile-tasks/{task}` returns `{data:{...}}`. Do not reuse first-mile pagination or schedule filtering.
- Task projection includes `task_id`, `leg`, `status`, `revision`, nullable `picked_up_at`, Order/waybill/Parcel references, and area-safe summaries.
- `GET /api/v1/courier/tasks/{task}/delivery` provides authorized hub/address/contact context after acceptance; Deliver Order owns that read contract.
- `POST /api/v1/courier/final-mile-tasks/{task}/pickup` is implemented and owned here; send JSON and a UUID `Idempotency-Key`.
- Exact body: `{"identifier_type":"qr","identifier":"AISLEY:WB:1:WB-EXAMPLE","expected_revision":1}`; use the actual server revision, not this example constant.
- `identifier_type` accepts `qr` or `order_id`; identifier is required, at most 128 characters; revision is an integer ≥1. Unknown fields are rejected.
- The accepted task must be `delivery_accepted`; the QR or printed Order reference must match that task's immutable waybill. Do not use the first-mile resolver as a final-mile authorization endpoint.
- Success is HTTP `202`: `{data:{task_id,evidence_id,evidence_status,custody_state,submitted_at}}`, with `evidence_status = awaiting_validation`.
- Submission records evidence only. Show “Awaiting Logistics validation,” never “Picked up” merely because the request succeeded.
- Logistics Update Status validates evidence and records `picked_up_from_hub`; this does not fulfill Inventory again.
- Refetch task detail to observe `status = picked_up_from_hub` and `picked_up_at`. Its general `evidence_status` describes delivery proof, not hub-pickup review.
- Matching retries return the same evidence identity with freshly loaded state; the response is not guaranteed byte-for-byte identical. Changed input/key reuse returns `409 IDEMPOTENCY_KEY_REUSED`.
- Revision/state mismatch returns `409 TASK_STATE_CONFLICT`; wrong parcel returns `404 PARCEL_NOT_FOUND`; malformed input/header returns `422`. Preserve the same request/key after timeout.
- Both legs require active approved Courier bearer access and policy consent. Handle `403 POLICY_CONSENT_REQUIRED` without clearing a valid session or automatically replaying pickup.
- No offline mutation is supported. Final-mile routing/ETA remains unavailable; the first-mile schedule manifest must not be presented as a Buyer delivery route.
- [x] Final-mile submission returns pending evidence; only Logistics validation records hub custody.
- [ ] PostgreSQL rollout/concurrency verification and external Flutter tests pass for both pickup legs.

### State contract
- Persisted/API values are lowercase `snake_case`; legacy uppercase source labels are display terminology only.
- The first-mile task lifecycle is:
  ```text
  assigned → accepted → picked_up_from_seller
  assigned → cancelled
  accepted → cancelled (only through the approved Logistics cancellation path)
  ```
- `assigned` means the selected Courier has work to review; it is not custody. `accepted` means the Courier accepted responsibility; it is not physical pickup.
- `picked_up_from_seller` records the Seller-to-Courier handoff. It must not be confused with final-mile `picked_up_from_hub` or generic Order `picked_up`.
- A cancelled or already picked-up task is read-only to this feature. Logistics recovery may use its own transition path, but a late Courier request must be idempotent and cannot duplicate history.
- Every successful mutation records task, Order/waybill, actor, previous state, new state, timestamp, schedule revision, and correlation ID.

### Route manifest and coordinates
- A route manifest is schedule/revision-scoped and is calculated after a schedule is committed or revised; provider failure must not roll back scheduling or pickup availability.
- Build nodes from the Logistics sole-hub coordinates plus each distinct immutable Seller pickup address in the schedule. Preserve the task/Order sequence separately from coordinate order.
- Coordinate priority is: exact persisted address/snapshot pair, then a server-maintained address-default latitude/longitude pair for the canonical address area. Never send a partial pair, `0,0`, or silently geocode during this job.
- If neither exact nor address-default coordinates exist, mark the manifest `unavailable` with a reason and retain the address/list view; do not block the Courier from seeing or confirming eligible tasks.
- Use Geoapify Route Matrix API with GeoJSON order `[longitude, latitude]`, `mode=drive`, and the hub plus pickup nodes as both sources and targets. Use returned `distance` metres and `time` seconds for a deterministic bounded stop-order heuristic.
- The schedule limit yields at most 31 nodes and a 31×31/961-cell matrix. The manifest must report matrix status, calculated time, route distance/time, coordinate source per node, ordered stops, and unreachable-stop reasons.
- Matrix data determines the stop order and its time/distance estimates. After ordering, request bounded Geoapify Routing API geometry through every stop in sequence, including the final hub return, and expose it as the map's GeoJSON route line.
- Split route requests at the provider waypoint limit with one overlapping boundary waypoint, then combine the returned geometry in order. If routing geometry is unavailable, retain the ready manifest and explicitly fall back to the straight stop-sequence `LineString`; pickup work must not be blocked by a presentation-layer routing failure.
- Treat the GeoJSON geometry format as versioned manifest output. Clients render both current and legacy `LineString` features, while reads of a legacy ready manifest queue its regeneration so deployments do not temporarily hide existing route lines.
- Use a bounded deterministic heuristic: start at the hub, choose the lowest available next-leg time, break ties by distance then persisted task position, visit every reachable stop once, and return to the hub. This is a manifest sequence, not a guaranteed optimal vehicle-routing solution.
- Store a coordinate fingerprint for the hub and every stop. A changed exact/default coordinate or schedule revision invalidates the previous result and triggers one new calculation.

### Embedded map visual
- When the manifest is `ready`, the schedule detail map must show the Logistics hub as both start and end, numbered pickup points between them, and a visible ordered route line. Prefer road-following Routing API geometry and retain a clearly labelled straight-line fallback. A stop list remains available beside/below the map.
- Use MapLibre GL JS in the existing Logistics React/Vite dashboard with a Geoapify `style.json`/map-tile source and a local GeoJSON source/layers. MapLibre GL JS is for the web dashboard, not the Flutter app.
- The Courier API returns the same authorized ordered stops and GeoJSON. Flutter may render it with a free native map or an accessible ordered list; it must not depend on a Courier web page or paid map SDK.
- Keep Geoapify, OpenStreetMap, and OpenMapTiles attribution visible. Do not put full addresses, QR secrets, or Buyer/Seller PII in map-provider requests or client logs.
- “Embedded map” means this authorized schedule-detail map panel; if WebGL is unavailable, the approved fallback is a quota-guarded Geoapify Static Maps image with the sanitized GeoJSON overlay, then the accessible stop list. Do not fabricate route lines or coordinates.

### Free-tier and offline constraints

- Use only free/open-source client dependencies and Geoapify's Free plan for the MVP; no Mapbox, Google Maps, Scanbot, Scandit, or paid fallback may be introduced.
- The current Geoapify Free plan lists 3,000 credits/day and limited commercial use with attribution. Enforce one cached matrix calculation per schedule revision, bounded map loading, usage metrics, and a circuit breaker; quota exhaustion yields `unavailable`, never an automatic paid call.
- Under the current Matrix pricing formula, a 31×31 request costs `max(31,31) × min(31,31,10) = 310` baseline credits before any distance/avoidance surcharges. The application must meter that estimate and keep a daily safety margin for map tiles.
- Render the map on schedule-detail open, not through an unbounded polling loop. Cache the manifest and avoid reloading identical tiles/data when the user revisits the same revision.
- Recommend `mobile_scanner` with its bundled Android ML Kit model for local QR/Code 128 decoding. Do not choose its unbundled model for MVP because first-use download would undermine offline scanning.
- Free alternatives are `flutter_zxing` (MIT, ZXing C++/FFI) and `qr_code_dart_scan` (MIT, Dart decoder). Select one after testing the target Android/iOS devices; do not add all three.
- Offline decoding may identify and display a candidate, but authoritative status mutation requires connectivity in MVP. A network failure must not show `picked_up_from_seller`; an offline queue is deferred and must use secure storage plus idempotency.

### Errors, privacy, and retry behavior

- Map `401` to signed out, `403` to blocked role/account/affiliation, `404` to an unavailable task/identifier without cross-tenant disclosure, `409` to stale/reassigned/already-transitioned task, `422` to invalid input, `429` to retry-after, and timeout/`5xx` to recoverable server failure.
- Pickup confirmation uses a UUID `Idempotency-Key`; the same key and identical payload returns the committed result, while reuse with different data returns `IDEMPOTENCY_KEY_REUSED`.
- Lock/revalidate the task and Order at commit. A duplicate retry from the same Courier is safe; a competing Courier, Logistics recovery, cancellation, or stale schedule cannot create a second pickup event.
- Responses are private and no-store. Log correlation ID, actor/tenant, schedule revision, task ID, transition result, provider status, latency, and estimated credits; redact addresses, raw QR payloads, tokens, and full coordinates.

### Acceptance criteria

- [x] A scheduled 1–30 Order bulk pickup creates tasks only for the selected Courier and the Courier can retrieve schedule, pickup-address, and Order details.
- [x] An assigned Courier can accept the task; an unrelated Courier, inactive account, wrong affiliation, or foreign ID cannot.
- [x] QR and manual Order ID/reference input reach identical backend matching and validation rules.
- [x] Only explicit confirmation changes the task to `picked_up_from_seller` and the Order to `picked_up`; retries are idempotent and wrong/unknown identifiers have no side effects.
- [x] Missing exact coordinates use the server-maintained address-default pair; missing both produces an honest unavailable manifest.
- [x] A ready Courier route manifest includes grouped parcels, ordered stops, matrix metrics, and valid GeoJSON; the development harness renders the Logistics start, numbered pickups, Logistics return, visible route line, and accessible list.
- [x] The Logistics dashboard renders its separately authorized companion embedded map and accessible list.
- [x] The implementation remains on the free/open-source dependency path, honors attribution, and continues task/pickup operation when map or quota services fail.
- [x] The next state, Logistics parcel receipt, is delegated to the implemented Update Status API and is not duplicated by this feature.

## HOW

### Existing and planned API contract

| Endpoint                                                         | Status      | Contract                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/courier/first-mile-tasks`                           | Implemented | Optional `pickup_schedule_id`, `per_page` 1–50; returns private/no-store paginated `assigned`/`accepted` tasks with schedule, pickup, destination area, Order, and waybill references.                                                                     |
| `POST /api/v1/courier/first-mile-tasks/{task}/accept`            | Implemented | No client ownership fields; locked, Courier-scoped accept/acknowledge; repeat accepted result is safe; `409` when no longer acceptable.                                                                                                                    |
| `POST /api/v1/courier/waybills/resolve`                          | Implemented | Throttled; body `{ "payload": "opaque-waybill-qr" }`; read-only authorized match; `404` for unknown/foreign/inactive waybill.                                                                                                                              |
| `POST /api/v1/courier/first-mile-tasks/{task}/pickup`            | Implemented | UUID `Idempotency-Key`; body `{ "identifier_type": "qr/order_id", "identifier": "..." }`; atomically validates custody, fulfills reserved Inventory, records immutable confirmation history, and returns task/order status, `picked_up_at`, and next step. |
| `GET /api/v1/courier/pickup-schedules/{schedule}/route-manifest` | Implemented | No mutable query fields; only a task-owning Courier receives the current revision, grouped/ordered stops, metrics, coordinate sources, status, and GeoJSON.                                                                                                |
| `GET /api/v1/courier/map-style`                                  | Implemented | Returns a private inline MapLibre raster style whose tile URL points back to the authenticated API; contains no provider key.                                                                                                                              |
| `GET /api/v1/courier/map-tiles/{z}/{x}/{y}.png`                  | Implemented | Validates bounded XYZ coordinates and proxies server-cached Geoapify `osm-carto` tiles with a daily safety limit and the server-only credential.                                                                                                           |

- The route-manifest resource has `pending`, `ready`, and `unavailable` states, stable reason codes, revision/fingerprint metadata, and no provider credential.
- Logistics needs a separately documented organization-scoped companion route; it must use the same service and not call a Courier route with a Logistics session.

### Endpoint response and failure semantics

- The implemented task-list response is `{ "data": [...], "meta": { "current_page", "last_page", "per_page", "total" } }`; each row retains the task UUID and nested `schedule`, `pickup`, `destination_area`, `order`, and `waybill` fields.
- The list is bounded and ordered by task creation time then UUID. A changed or expired page is refreshed from page one; Flutter must not synthesize missing tasks from notifications.
- The pickup response is `{ "data": { "task_id", "order", "waybill", "task_status", "order_status", "picked_up_at", "next_step", "idempotent" } }`. `order_status` is the server-committed `picked_up` projection, not a client prediction.
- The manifest response is `{ "data": { "status", "schedule", "revision", "coordinate_source", "summary", "stops", "geojson", "calculated_at", "reason", "map" } }`; `reason` is nullable only when `status = ready`.
- `stops[]` includes sequence, `kind` (`hub` or `pickup`), grouped task/order/waybill references when applicable, safe address summary, latitude, longitude, coordinate source, leg distance/time, and reachability. GeoJSON properties use only opaque IDs, sequence, kind, and reachability.
- All reads are private and should send `Cache-Control: private, no-store`; client caches, if approved for offline display, are encrypted, bounded, and invalidated after logout or authorization failure.
- Refresh/list/manifest reads are safe to retry. Pickup confirmation is safe to retry only with the same UUID idempotency key and identical identifier payload.
- `422` includes stable field errors for malformed `identifier_type`, empty/oversized identifier, or malformed UUID header; `409` includes a stable transition/conflict code and current safe task state when the caller owns it.

Example implemented first-mile confirmation request:

```json
{
  "identifier_type": "qr",
  "identifier": "AISLEY:WB:1:WB-EXAMPLE"
}
```

`identifier_type = order_id` means the printed human-readable Order reference in the UI; it is not permission to submit an arbitrary database UUID. QR and manual input are normalized only for lookup, while the immutable waybill/order mapping remains authoritative.

Example GeoJSON geometry (first-mile manifest only):
```json
{"type":"Feature","geometry":{"type":"LineString","coordinates":[[121.0,14.5],[121.1,14.6],[121.0,14.5]]},"properties":{"kind":"route_line","geometry_source":"geoapify_routing"}}
```
- Real manifests include numbered pickup points and the bounded feature collection; this example is not a live route.

### Backend data flow and dependencies

- Reuse `PickupSchedule`, `PickupScheduleOrder`, `FirstMileTask`, `Waybill`, immutable waybill snapshot, schedule history, and post-commit notification services already present. `courier_pickup_confirmations` is the immutable one-per-task pickup/idempotency record, and `first_mile_tasks.picked_up_at` stores the current transition timestamp. The route-manifest and shared operational migrations already exist; do not create duplicate tables.
- Store route status/action enum-like columns as strings and cast them to PHP enums. A manifest record should key by schedule revision, retain source fingerprints and failure reason, and preserve the GeoJSON/ordered-stop snapshot used by the client.
- `BuildPickupRouteManifest` and its unique queued job resolve exact/default coordinates, calculate/cache the bounded matrix once per stable revision/fingerprint, order reachable nodes, obtain bounded road geometry with a straight-line fallback, build sanitized GeoJSON, persist the snapshot, and expose it through the Courier-scoped resource.
- Recalculate on schedule revision; superseded manifests remain history only. Cancellation prevents new pickup confirmation and marks the current manifest unavailable without deleting history.
- The route builder must not own assignment, waybill identity, status transitions, or Logistics receipt.

### Flutter handoff and UI states

- `src/couriermockup` implements the temporary browser contract check with `@zxing/browser` and `maplibre-gl`, both loaded only when their scanner/map state opens. It groups tasks by schedule, renders the authorized GeoJSON and numbered stops, resolves a scanned QR or manual Order reference to the matching parcel in that open schedule, keeps the identifier as an untrusted candidate until the explicit confirmation call, and selects the matched task before showing the server result.
- The mockup adds no provider/browser secret. `VITE_API_URL` remains a non-secret origin only; Geoapify calls and `GEOAPIFY_SERVER_API_KEY` remain server-side.
- Flutter stores tokens only in OS secure storage and sends Bearer auth. It implements loading, empty, assigned, accepted, manifest-pending, manifest-ready, map-unavailable, permission-denied, mismatch, not-found, offline, retry, success, and stale-task states.
- The scanner requests camera permission at use time, exposes a manual-entry fallback, announces textual results, uses adequate touch targets, and never relies on camera preview/color alone.
- Cache only bounded, encrypted, private task/manifest data; clear it on logout, denial, affiliation invalidation, or account switch. Cached data never authorizes pickup.

### Verification, rollout, and open decisions

- API coverage verifies task receipt, schedule handling, QR/manual matching, wrong identifiers without side effects, idempotent replay, immutable confirmation and Order-status history, the `picked_up` Order transition, Inventory fulfillment, and private/no-store reads. Dedicated concurrent database verification remains part of the production rollout gate.
- Current route fixtures cover exact/default/missing coordinates, same-address parcel grouping, cache reuse, matrix metrics, road geometry with Logistics return, sanitized GeoJSON, attribution, credential hiding, and tenant scope. Null-route, 31-node boundary, quota circuit-breaker, and dedicated PostgreSQL concurrency fixtures remain rollout work.
- Add Logistics map tests for GeoJSON layers, ordered markers, accessible list fallback, stale revisions, and no map mutation. Add Flutter contract/widget tests for scanner fallback and server-error mapping.
- Production rollout still requires PostgreSQL verification, populated and reviewed address-coordinate defaults, and Geoapify usage monitoring; current list/accept/resolve behavior remains intact.
- Open: schedule early/late pickup grace; native Flutter map versus list-only; turn-by-turn navigation; offline mutation queue; Courier push transport. Logistics receipt is implemented under Update Status, not a Courier action.

### Sources

- [Geoapify Route Matrix API](https://apidocs.geoapify.com/docs/route-matrix/), [Geoapify Routing API](https://apidocs.geoapify.com/docs/routing/), [Geoapify pricing](https://www.geoapify.com/pricing/), [Geoapify map tiles](https://apidocs.geoapify.com/docs/maps/), and [Geoapify Static Maps API](https://apidocs.geoapify.com/docs/maps/static/).
- [MapLibre GeoJSON source](https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/) and [MapLibre GL JS license](https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt).
- [mobile_scanner](https://pub.dev/packages/mobile_scanner), [flutter_zxing](https://pub.dev/packages/flutter_zxing), [qr_code_dart_scan](https://pub.dev/packages/qr_code_dart_scan), and [Google ML Kit barcode scanning](https://developers.google.com/ml-kit/vision/barcode-scanning).
