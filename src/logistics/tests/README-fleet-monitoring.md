# Fleet monitoring browser checks

Run from the repository root against a Logistics production preview and isolated Chromium CDP instance. No new dependencies or actual accounts are used.

```sh
src/logistics/node_modules/.bin/tsc -b src/logistics
src/logistics/node_modules/.bin/vite build src/logistics
src/logistics/node_modules/.bin/vite preview src/logistics --host 127.0.0.1 --port 5187 --strictPort
# In another terminal, launch Chromium with a repository-local profile and CDP port 19359.
node src/logistics/tests/fleet-monitoring-browser.smoke.mjs
```

`LOGISTICS_UI_ORIGIN` and `LOGISTICS_UI_CDP` override the local addresses. The fixture extends the existing rates/fleet authentication harness and intercepts monitoring reads. Its 23-truck dataset exercises six availability states, outbound/empty-return work, approval-pending overdue departures, reported arrival, and 23-entry history pagination.

Checks cover three monitoring routes at 320/768/1440px in both themes, contained horizontal table scrolling, filters/deep links, detail and Back state, separate history navigation/paging, initial loading/error, stale refresh/error recovery, empty/missing/idle states, obsolete requests, hidden-tab polling, keyboard focus, consent/session loss and late reads after logout. Ignored screenshots, the rendered snapshot and verification JSON live under `src/logistics/node_modules/.cache/fleet-monitoring-browser/`.

API regression command:

```sh
php src/api/vendor/bin/phpunit --configuration src/api/phpunit.xml --bootstrap src/api/tests/bootstrap-isolated.php src/api/tests/Feature/Logistics/FleetMonitoringTest.php src/api/tests/Feature/Logistics/CompanyTruckLinehaulTest.php src/api/tests/Feature/Courier/LinehaulTripActionTest.php
```

The isolated API tests use in-memory SQLite and synthetic configuration, without reading application environment files. Actual PostgreSQL/deployed API, assistive technology and real-account acceptance remain separate checks. No Flutter completion is implied.

## Pickup and delivery map checks

Run `node src/logistics/tests/fleet-assignments-browser.smoke.mjs` against the same preview/CDP instance. The six synthetic assignments cover first-mile handoff/return, active and empty-return linehaul, and accepted/out-for-delivery last-mile work, coincident stops and a missing destination pin. The script expands that dataset to verify pagination. API/auth responses are synthetic; map tiles use the configured browser Geoapify provider and may be unavailable.

Checks cover map/list selection, grouped pins, keyboard activation, stage/search/deep links, independent truck filters, detail/Back navigation, pagination coverage, stale refresh/retry, empty/missing-pin states, obsolete reads, consent/session loss and late reads after logout at 320/390/768/1440px in both themes. Artifacts live under `src/logistics/node_modules/.cache/fleet-assignments-browser/`; they are local verification files, not production sample data.

Focused API command: `php src/api/vendor/bin/phpunit --configuration src/api/phpunit.xml --bootstrap src/api/tests/bootstrap-isolated.php src/api/tests/Feature/Logistics/FleetAssignmentMonitoringTest.php src/api/tests/Feature/Logistics/FleetMonitoringTest.php`.

On 2026-11-05 the broader CompanyTruckLinehaulTest/LinehaulTripActionTest run reached eight fixture-setup failures: their Seller pickup addresses lack the pin required by the current pickup policy (422 before monitoring is exercised). Do not describe that broader run as passing; keep its fixture repair separate from this monitoring change.

## Past-transfer navigation and map checks

Run `node src/logistics/tests/fleet-transfers-browser.smoke.mjs` against the preview/CDP above. Run browser suites sequentially so foreground-tab visibility does not interfere with animation frames and polling checks.

Covers current schedule preservation; separate terminal-history table and per-transfer details; Manila schedules; inbound/outbound Logistics labels; direct links, filters and history page retention; schematic past-hub connection; confirmed truck plate/location labels; current versus past map semantics; refresh recovery; empty/missing states; session disposal; and overflow at 320/768/1440px in both themes. Fixtures use synthetic API records and current saved hub pins. Screenshots, a rendered snapshot and results live under `src/logistics/node_modules/.cache/fleet-transfers-browser/`. Tile-provider availability is separate from marker/route verification.


## Outbound dispatch trip links

Run `node src/logistics/tests/linehaul-outbound-browser.smoke.mjs` with the same preview/CDP variables. This combines the existing transport and monitoring fixtures to cover separate status/actions, aligned compact cell insets, contained scrolling at 390/768/1440px in both themes, blocked release, action/navigation isolation, row/keyboard links, selected-section focus, Back, terminal-history fallback, missing selections, refresh recovery and changed truck assignments. No real accounts or operational mutations are used. Captures and results live under `src/logistics/node_modules/.cache/linehaul-outbound/after/`. The optional `--before` flag records layout evidence only and is intended for the original source before changes.
