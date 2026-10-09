# Courier route-map integration

> Imported external Courier Flutter report dated 2026-10-08. Client code, plugin behavior, tests and builds below are reported evidence, not rerun here. The current API read shapes were separately checked against Laravel source during the October 9 sync.

Map-specific backend baseline: `51d96947569d1603fdfb6d264ebd2a04bf866280`.
Other operational adoption remains `d7df220`, and copied Auth v2.6 documentation
remains `4c3f504`. Source inspection proves DTO implementation, not deployment.

## Authoritative sources

- Laravel `FinalMileRouteService` at the baseline defines accepted-member gates,
  ordered nodes, nullable summary/map/GeoJSON, advisory matrix metrics, road
  geometry, and explicit `stop_sequence_fallback` unavailable responses.
- `PickupRouteManifestController` defines raw raster style, private PNG tile
  proxy, no-store headers, nested pickup task projection, and metric spellings.
- `BuildPickupRouteManifest` defines nested tasks, unreachable legs, road/fallback
  geometry and the final hub return. No Laravel files were changed.
- [Final-mile service source](https://github.com/ZieksQ/aisley/blob/51d96947569d1603fdfb6d264ebd2a04bf866280/src/api/app/Services/Courier/FinalMileRouteService.php)
- [MapLibre platform setup](https://maplibre.org/flutter-maplibre-gl/getting-started/)

## Reads and authorization

All paths below are implemented `GET` endpoints under Sanctum bearer access,
active Courier role/account, approved affiliation, active Logistics organization,
sole-hub scope, and current policy consent. No request bodies, owner/status
selectors, idempotency keys, pagination, or mutation retries are involved.

| Path | Response and ownership |
| --- | --- |
| `/api/v1/courier/pickup-schedules/{schedule}/route-manifest` | `{data: manifest}`; assigned Courier schedule/organization/hub scope |
| `/api/v1/courier/final-mile-batches/{schedule}/route` | `{data: route}`; every member belongs to this accepted final-mile dispatch |
| `/api/v1/courier/map-style` | Raw version-8 raster style; no `data` envelope |
| `/api/v1/courier/map-tiles/{z}/{x}/{y}.png` | Private PNG; bounded zoom and tile coordinates |

Reads are private/no-store; the client sends `Cache-Control: no-store` for map
resources and final-mile routes. All route snapshots, image sources, marker
images, and viewport sets are held only in memory and released on disposal.
No offline region, local file cache, service-worker route snapshot, or GPS is
added. Android retains existing camera/upload permissions and adds Internet.
Flutter web uses the plugin's existing automatic MapLibre JS/CSS loader; it
needs WebGL2 and CDN access, and stays the same app on localhost port 8765.

`401` clears the existing session; `403` follows account/affiliation denial or
policy consent handling. `404` is unavailable, `409` requires batch/schedule
recovery, `422` is an invalid request, and `429` obeys seconds or HTTP-date
`Retry-After`. Offline, timeout, and `5xx` are recoverable failures. Private text
from the latest authorized read may survive recoverable failures in memory,
with its original receipt time; auth/scope failures remove route data.

## Security-driven transport exception

The approved plan proposed `MapLibreMapController.setCustomHeaders`. Inspection
of the resolved **0.27.1** package disproves its stated platform behavior:

- Android `MapLibreCustomHttpInterceptor` keeps `CustomHeaders` and `Filter` as
  static fields and installs an SDK-wide OkHttp client. The controller setter
  delegates to that static integration. It cannot isolate simultaneous maps.
- Web `MapLibreWebGlPlatform.setCustomHeaders` throws `UnimplementedError`.
- Web `addImageSource(bytes)` is also unimplemented, while the generic
  `addSource(ImageSourceProperties)` supports an inline image URL.

Therefore the app never calls the SDK's global or controller header setters.
`CourierMapSecurity` uses the existing authenticated `ApiClient` to fetch a
validated raw style and bounded raster images. The SDK receives only image
pixels and sanitized positions/marker numbers. Android uses native image-source
bytes; web uses generic image sources with inline PNG data URLs. These contain
pixels, no credentials or private task metadata. No package fork is introduced.

The style whitelist permits only the baseline single raster source/layer and
exact configured-origin `/api/v1/courier/map-tiles/{z}/{x}/{y}.png` template.
Extra sources, glyphs, sprites, imports, external URLs, alternate ports/schemes,
lookalike hosts/paths, queries/fragments, and user-info are rejected. Tile reads
use fixed client paths, validate coordinates and bounded PNG signatures, and
disable redirects. A resource-free SDK style is loaded first and remains in
use: the remote style is validated metadata, never an SDK network capability.

Viewport loading uses at most 16 tiles, lowers raster zoom if necessary, and
removes images outside the viewport. A failure stops the loader, removes the
map view, and makes one normal route API revalidation. There is no tile retry
loop. Explicit refresh remounts the map only after the cooldown; route and tile
throttling both enforce `Retry-After`. Confirmed API auth failures use existing
session cleanup; a provider/tile failure alone never revokes identity.

## Composition and accessibility

First-mile repositories/controllers remain independent from final-mile route
repositories/controllers. Shared `RouteMapView` accepts sanitized geometry and
markers and depends only on shared map security, not feature internals.
`RouteMapScope.renderer` is injectable for deterministic layout/accessibility
tests. Stop lists render independently of map initialization and tile success.

Pickup stop tasks use nested `tasks[]`, `leg_distance_metres`, and
`leg_duration_seconds`. The first-mile route includes the hub return. Final-mile
summary uses `stop_count`, `distance_metres`, and `duration_seconds`; ordered
stops are never sorted or optimized locally, and no hub return is appended.
Final-mile **Last refreshed** is local receipt time, never a server calculation
timestamp. Unknown route states remain text-only; missing coordinates never
become default/fabricated markers. Only approved server `route_line` LineStrings
with recognized road/fallback sources are drawn.

Maps label H as the hub and numbers as stop order. Material zoom and Fit route
controls, readable fallback/state messages, visible attribution, wrapping
layout, and stable Back/Refresh actions follow `design-courier.md`. There is no
GPS permission, tracking, navigation, client optimization, or operational write.

## Acceptance limits

Contract fixtures are synthetic values derived from the backend resource shapes.
Widget tests exercise both production themes, narrow widths and 1×/2× text,
including map failure without losing stops. They do not establish TalkBack or
installed-device acceptance. The real-browser fixture verifies visible numbered
markers above raster layers, bounded tiles, Zoom/Fit route, refreshed geometry,
map removal after session invalidation, and no SDK requests with credentials.
This is distinct from authenticated server acceptance. Exact completed checks
are in `PROGRESS.md`.

The user confirmed no API or Android device is available for live acceptance.
The localhost app can be served and built; real authorized style/tile CORS,
provider quotas, deployed membership gates, map pixels, and installed Android
runtime/secure-storage behavior require an authorized API and device later.

## Reproduce the synthetic browser check

Use the same Flutter renderer in the isolated harness; its HTTP client returns
synthetic DTOs and PNG bytes and never reads account storage or a live API.
Keep the ordinary Courier app on localhost 8765. The isolated harness below uses 8766 temporarily; stop any Buyer test server occupying that port before running it. Serve the harness separately:

```sh
flutter run --no-pub -d web-server --web-hostname localhost --web-port 8766 -t test/manual/route_map_browser_fixture.dart
```

For Linux automation, use an isolated Chromium profile and Node with built-in
WebSocket support. The software WebGL flags apply only to this test process:

```sh
chromium --headless=new --no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader --ignore-gpu-blocklist --no-first-run --no-default-browser-check --remote-debugging-address=127.0.0.1 --remote-debugging-port=9334 --user-data-dir=build/maplibre-browser-profile about:blank
node test/manual/check_route_map_browser.mjs
```

The driver creates and closes its own synthetic page, asserts real SDK layer
order/rendered markers and camera/refresh/cleanup behavior, and writes
`build/courier-map-browser.png`. Never attach it to a signed-in user browser.
This test needs the pinned public MapLibre JS/CSS CDN and WebGL2. It does not
exercise deployed API authorization, private tile CORS, or provider imagery.
