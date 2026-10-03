# Buyer addresses, PSGC and optional maps

Flutter implementation pending. Upstream authority: `docs/maps-location-api.md`, Customer Address Book spec, `StoreAddressRequest`, Address Resource/Service and `packages/psgc-address-data`. A map is assistance; Laravel owns saved address validation, shipping serviceability and Order snapshots.

## Dart-compatible PSGC plan

The existing workspace package contains PSA PSGC Q2 2026 JSON, with `data/list-of-all-regions.json` referring to each region's `addresses.json`. Flutter cannot import `@aisley/psgc-address-data` or JavaScript selectors directly.

Before implementing addresses, copy/export the approved JSON index and referenced files into the standalone app's `assets/psgc/`, preserve hierarchy/codes/names and source attribution, and declare those assets in `pubspec.yaml`. Record source commit, dataset revision, file manifest/checksums and export date in the Flutter progress log. No data assets or export tool are shipped by this documentation bundle. Index entries contain psgc_code, name and relative file. Use a typed Dart reader, lazy region loading and deterministic fixtures to verify each region hierarchy rather than assuming an unobserved converted schema.

Cascade searchable **Region → Province → City/Municipality → Barangay**. Parent changes clear invalid descendants. Preserve NCR/independent-city structures as supplied; do not fabricate a Province. Follow the existing package's reviewed names and manual fallback for missing/incomplete data. Postal code and house/street/address lines are manual, not inferred from a PSGC code. Save reviewed names through the existing Address fields; lookup codes/provider IDs do not become replacement API fields.

The generic `/api/v1/address-options/*` routes exist, but current Customer dropdowns use bundled local data. Their presence is not a requirement to call them at each selection or silently replace offline assets. A mobile adapter/data-schema decision and parity tests remain open.

## Pinning and provider boundaries

Manual address → intentional **Pin location** → one Philippines-scoped Geoapify forward-geocode request → display a result and allow reviewed adjustment/GPS with permission → persist only valid coordinate pair. No geocoding while typing or selecting administrative fields. Changing populated location text clears stale coordinates. Provider failure never rewrites/erases text or blocks manual saving.

Current web policy uses Leaflet with Geoapify raster tiles and visible Geoapify/OpenStreetMap/OpenMapTiles attribution; Mapbox is excluded. Leaflet is JavaScript and has no direct Dart import. A native renderer/hosted Leaflet bridge, its dependency, attribution, privacy, key restrictions and Android/browser parity require approval before pin rendering is implemented. Do not claim a Flutter map package is already chosen. Ship the permitted text-only fallback while that integration is unresolved.

An approved public client key may assist intentional geocoding/tiles with target-appropriate restrictions; an origin-restricted browser key is not automatically a protected Android credential. Review mobile credential exposure and provider policy. The Laravel-only `GEOAPIFY_SERVER_API_KEY` for Route Matrix/Routing must never enter Flutter. Backend-only ranking/routing does not grant Buyer provider-selection or live tracking endpoints.

Coordinates are optional complete pairs: latitude −90..90 and longitude −180..180. Device location requires an explicit user action/OS permission and denial/manual adjustment fallback. Never send names, phone numbers, Order contents or account IDs to map APIs; avoid provider calls/logs beyond approved address-geocoding need. Show attribution and accessible text controls when dragging is unavailable.

Address Book editing/deleting never rewrites placed Orders. Checkout snapshots the owned shipping/both row and optional coordinates; approved pre-processing correction is an Order mutation with separate rules. Tracking currently declares map unavailable; pinning an address does not make Courier location/route/ETA available.
