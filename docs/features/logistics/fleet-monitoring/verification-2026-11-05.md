# Pickup and delivery fleet monitoring — 2026-11-05

Fleet monitoring now includes assigned/underway first-mile, owned-truck linehaul and last-mile work, with a synchronized assignment map/list, stage icons/colors, grouped stops, recorded events and existing-workspace links. These are saved assignment locations; no live Courier GPS or mobile contract change is implied.

## Verification

- Focused isolated API suites: **13 tests, 206 assertions passed** (`FleetAssignmentMonitoringTest`, `FleetMonitoringTest`). Covers organization/current-hub isolation, owned returns, active/terminal states, pickup schedule completion versus physical hub receipt, mirrored-task deduplication, current Courier re-offers, safe fields, null/invalid pins, stable pagination/filtering, read-only/provider-free behavior and access/consent gates.
- Logistics TypeScript, production Vite build, scoped Oxlint, scoped Pint and whitespace checks passed. Vite retains its existing large-bundle warning; no dependency, schema or migration changes.
- Chromium: **68 assignment checks across 8 width/theme combinations**, **74 existing monitoring checks across 18 route/width/theme combinations**, and **2 unconfigured-provider checks** passed with no runtime exceptions. Covered map/list selection, coincident stops, keyboard activation, preserved map viewport, page coverage/clamping, independent filters/Back, missing pins, empty/loading/error/stale recovery, obsolete reads, consent/session loss and late responses after logout. Tile errors were forced through Chromium network blocking; saved markers/list and retry remained usable. Configured Geoapify tiles also rendered in final captures.
- API/auth data in browser tests is synthetic. No sample assignments ship in application code. Geoapify/OpenStreetMap/OpenMapTiles attribution remains on the map. Actual PostgreSQL/deployed API, real-account/volume and assistive-technology acceptance remain open.
- Broader regression attempt: **8 failures** in CompanyTruckLinehaulTest and LinehaulTripActionTest during Seller pickup fixture setup, before monitoring is exercised. The existing `HubRoutingFixtures::sellerShop` address lacks the pin required by the current pickup policy, producing 422. Those unrelated fixtures were left unchanged; the broader run is not passing.

## Design-taste review

App-screen direction: **Achromatic ledger**, seed **1284875936**, with palette/type kept. No redraws. The Logistics contract overrides the sheet's monochrome-action/color-budget prescriptions: blue/slate shell, Geist, light/dark themes and the agreed stage hues remain authoritative. The face is the existing AISLEY Logistics shell; the signature element is three fulfillment stages sharing one selectable geographic assignment workspace.

Question: **Which Couriers have assigned or underway work, and where are its recorded stops?** Idea: AISLEY's separate Seller handoff, owned-truck transfer and Customer delivery assignments become one geographic index without implying GPS telemetry. The live interaction is map/list selection with operational details.

ROUND 1
- Seen in one second: pickup, linehaul and delivery stages above a map and active work list.
- Idea/live thing: the three stage assignments share stops and selection.
- Layout: existing shell / stage-search controls / map and work list / selected events / existing truck availability and history navigation.
- Scores: design 7.2 · usability 7.5 · creativity 7 · content 8 → overall 7.3 (subjective).
- Caps: promotional imagery/motion rules are inapplicable to this app screen; familiar operational-map composition limits creativity to 7.
- Three fixes: removed a duplicate page h1 because the shell already names the screen; replaced Leaflet zoom's fallback font with inherited typography; added loading/slow-tile recovery so an incomplete basemap is explicitly explained. Initial dark snapshot table contrast findings were an artifact of lost doctype/quirks mode; both browser harnesses now preserve standards mode in saved HTML.

ROUND 2
- Seen in one second: three fulfillment stages with their stop map and named active Couriers.
- Idea/live thing and layout: retained; selected work highlights its own stops and exposes truthful event timestamps.
- Scores: design 8 · usability 8.2 · creativity 7 · content 8.3 → overall 7.9 (subjective).
- Final light/dark inspection: **0 FAIL, 0 WARN** at 1440/768/390px after explicit allowances. Reviewed all final fold and page captures plus live-browser selected-state/phone captures. No further feature-specific visual defect identified.
- Allowances: `icon-chips` applies to required functional stage/hub map markers; `tiny-text` applies to existing 9px sidebar Beta labels; `purple` permits the agreed last-mile data category; `below-fold` preserves the existing secondary truck inventory below the new primary assignment workspace. Source lint has 0 failures and 4 framework-color warnings for the contract's required Logistics blue, retained intentionally. No promotional imagery, generated raster assets or decorative motion were added.
- Static inspector captures measure layout/type; the real-browser suite reloads Leaflet at each viewport to verify its responsive positioning. No claim of live production tracking or complete deployment acceptance is made.

## Reproduction and local artifacts

See [browser commands](../../../../src/logistics/tests/README-fleet-monitoring.md). Run commands from the repository root. Use the configured origin-restricted browser key for map tests; an empty `GEOAPIFY_API_KEY` build with `FLEET_NO_MAP=1` exercises provider-free list/details. Restore the ordinary build afterward.

- Browser results/captures: `src/logistics/node_modules/.cache/fleet-assignments-browser/` and `fleet-monitoring-browser/`.
- Design direction and before/after inspector results: `src/logistics/node_modules/.cache/fleet-monitoring-taste/`.
- Browser HTML captures are local ignored artifacts and may reference the browser map credential; do not publish them as deployment artifacts.
