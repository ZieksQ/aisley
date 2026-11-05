---
role: Logistics
feature: Fleet Monitoring
status: Implemented (API and web; live acceptance open)
canonical: true
---

# Logistics Fleet Monitoring

## WHAT

- Dedicated read-only `/fleet-monitoring` workspace for first-mile pickups, owned-truck linehaul and last-mile deliveries; `/fleet-monitoring/:truckId` retains owned truck details/history.
- Answer where trucks were last confirmed, what work they are assigned, their schedules, drivers, committed parcel capacity and recorded history.
- Registration and capability management stay in Company fleet; dispatch and receiving stay in their existing workspaces.
- Operational location only: the assignment map displays saved pickup, hub and delivery pins, never live Courier positions. No GPS collection, ETA, maintenance workflow, notifications or Courier client contract changes.

## MUST

- Existing Logistics Sanctum/RBAC, active-account and policy-consent middleware protect all reads. Derive organization from authentication; foreign/unknown truck IDs return scoped 404.
- Show all six existing availability states and summary counts across the entire owned fleet, independent of list filters.
- Search plate, make/model, active driver and active route hub names; filter availability and overdue departure. Paginate 20 rows by default, maximum 100, ordered by plate then ID.
- Overdue means pending acceptance or scheduled, scheduled time strictly before server time and no recorded departure. Approval-pending overdue trips remain separately labelled; no automatic state change.
- Resolve active trips independently of recent history. Include outbound and return assignments, including another hub scheduling an owned truck home.
- Truck rows show last confirmed hub, active route/driver/schedule and committed reserved/onboard count against current truck capacity. These are not measured physical occupancy.
- In transit, identify origin → destination separately from last confirmed hub. Unknown values remain unavailable.
- Details show home hub, identity, availability, active trip and paginated history including completed, rejected and cancelled trips.
- Timeline shows recorded decision, release, departure, driver arrival report, confirmed arrival and unloading closure. Missing timestamps are explicitly unrecorded; reported arrival never implies confirmed arrival.
- Display dates in Asia/Manila. API timestamps use ISO strings; include server time on all monitoring responses.
- Visible pages refresh every 30 seconds, on becoming visible, and manually. Prevent overlapping reads and ignore obsolete/account-switched responses. Show last successful refresh time; failed refresh retains explicitly outdated data for the same resource only.
- Logout or authorization loss clears private state. Loading, empty, missing truck, error and retry states are distinct.
- Search/filter/page state survives detail navigation and Back through URL parameters. History page uses its own URL parameter.
- Follow `docs/design.md`, shared portal primitives, keyboard/focus rules and mobile-first layouts in both themes. No new dependencies.

## HOW

### Active pickup and delivery assignments — 2026-11-05

- `GET /api/v1/logistics/fleet/monitoring/assignments`: `stage` (`first_mile`, `linehaul`, `final_mile`), `search` (max 100 characters), `page`, `per_page` (default 20, max 100). Returns `{data: Assignment[], meta: {current_page, last_page, per_page, total, server_time}}`, private/no-store under the existing Logistics access/consent gates. UI calls `final_mile` **Last-mile**.
- Each assignment represents one first-mile task, linehaul trip or final-mile task. The mirrored first-mile DeliveryTask is not counted again. Order by creation descending, stage then ID; paginate the union in SQL and eager-load the selected page.
- First-mile includes assigned/accepted tasks and picked-up parcels whose Shipment still awaits hub receipt. A completed pickup schedule does not hide parcels returning to the hub: pickup schedule completion records Seller handoffs, not hub custody. Cancelled schedules/tasks and terminal Orders are excluded.
- Final-mile includes currently assigned `delivery_assigned`, `delivery_accepted`, `picked_up_from_hub`, `in_transit` and `out_for_delivery` tasks under the current organization/hub custody, including work awaiting delivery validation. Rejected, unassigned, superseded, delivered and terminal Order records are excluded. Show current Courier, never historical offer recipients. Scheduled context comes only from matching tenant/hub/current-Courier membership; standalone re-offers may have no schedule.
- Linehaul includes owned trips in `pending_acceptance`, `scheduled`, `in_transfer` and `receiving`, including empty returns scheduled from another hub. It does not grant visibility to another organization's trucks merely because a trip visits the local hub.
- Assignment contains composite stage/ID, source ID, stage/status, reference, safe Courier ID/name, nullable schedule/reference/window, parcel count, nullable truck ID/plate and direction, recorded event timestamps and stop projections. Stops include kind, label, area summary and nullable coordinate pair. No contact fields, full street address, POD/documents or GPS history.
- Use immutable waybill pickup pins, the authoritative Order delivery address and saved hub pins. Invalid/missing coordinate pairs remain null; monitoring never geocodes, computes routes or writes operational state. Timestamp absence remains **Not recorded**.
- Map and list describe the same current assignment page; total results and **Map shows N on page P** explicitly distinguish page coverage. Stage/search/page live in `stage`, `assignment_search`, `assignment_page` URL parameters, independently of truck filters. Preserve both sets through truck details/Back.
- Use installed Leaflet with Geoapify raster tiles and browser-only origin-restricted credentials. Keep attribution visible. First-mile pickup/open-package icons are teal, linehaul/truck icons blue, last-mile delivery icons violet; hub icons are slate. Pair color with icons, stage labels and a legend. Truck icons at origin stops mean assigned origins, not current truck positions.
- Group coincident coordinates into one marker with a count and selectable assignment menu. Marker/row selection highlights the assignment stops and opens schedule, stop and recorded-event details with links to existing workspaces. Provide keyboard selection, zoom and **Fit shown stops**. Polling updates markers without resetting the operator's viewport.
- Retain the list/details when tiles, credentials or pins are unavailable. Show loading, tile failure/slow response and retry explicitly. An unconfigured map provider makes the map unavailable rather than fabricating a basemap. Keep visible-tab/manual refresh, same-resource stale notices and private-state disposal from existing monitoring.

### Company truck monitoring

- `GET /api/v1/logistics/fleet/monitoring`: query `search` (max 100 characters), `availability` (existing enum), `overdue` (0/1), `page`, `per_page`. Returns `{data: Truck[], meta: {current_page, last_page, per_page, total, server_time, summary}}`.
- `GET /api/v1/logistics/fleet/monitoring/{truck}`: `{data: Truck, meta: {server_time}}`.
- `GET /api/v1/logistics/fleet/monitoring/{truck}/trips`: `page`, `per_page`, newest created time then ID; `{data: Trip[], meta: {current_page, last_page, per_page, total, server_time}}`.
- Truck contains safe identity fields, active flag/availability, home and last-confirmed hub IDs/names, capacity, committed parcel count, remaining capacity and nullable active Trip.
- Trip contains ID, direction/status, route hub IDs/names, assigned driver ID/name, parcel count/capacity snapshot, schedule, overdue flag and recorded event timestamps. No parcel references, personal documents or driver email/contact fields.
- Use a focused monitoring service, Form Requests and Resources; eager-load only relevant active trips for lists, paginate historical reads at the database. Responses are `private, no-store`.
- Add role-owned monitoring types, API client, polling hook, tables, detail components and route composition. Existing management APIs and trip lifecycle stay compatible; no schema migration.
- API acceptance covers isolation/access gates, validation, stable pagination, filters, time boundaries, old active assignments, return trips and truthful timestamps.
- Browser acceptance covers filters/Back, details/history, refresh failures/retry, obsolete responses, logout, keyboard use, light/dark themes and 320/768/1440px overflow.
- Run focused API regressions, Logistics TypeScript/lint/build checks and record actual browser checks separately from live deployment acceptance.

## Verification — 2026-11-05

- Pickup/delivery extension: 13 focused isolated API tests (206 assertions), Logistics TypeScript/build/lint, scoped Pint and whitespace checks passed. Chromium passed 68 assignment checks, 74 existing monitoring checks and 2 unconfigured-provider checks. Both theme inspections passed at 1440/768/390px with documented functional-map/shell allowances.
- Eight broader linehaul tests fail during existing unpinned Seller fixture setup, before monitoring is exercised. Actual PostgreSQL/deployed/real-account acceptance remains open. See [verification and design review](verification-2026-11-05.md).

## Verification — 2026-11-04

- Isolated SQLite monitoring, company-truck linehaul and Courier trip-action suites passed: 15 tests, 425 assertions. Covered scoped ownership, active-role/consent gates, old active assignments, filtering, literal wildcard search, pagination, overdue boundaries, visiting/empty returns, recorded timestamps and mutation-free reads.
- Logistics TypeScript, production Vite build, Oxlint, scoped Pint and whitespace checks passed. Existing large-bundle warning remains. Direct installed binaries were used because the pnpm launcher cannot write its external operation lock under this workspace sandbox.
- Synthetic Chromium passed 74 checks, including 18 route/viewport/theme combinations at 320/768/1440px, filters/deep links/Back, history expansion/paging, refresh/initial errors, obsolete responses, hidden-tab behavior, consent/session loss and late responses after logout. Final light/dark phone and desktop captures reviewed.
- Taste source lint: 0 failures/warnings. Final rendered snapshot inspection at 390/768/1440px: 0 failures/warnings with `tiny-text` allowed only for the pre-existing sidebar Beta labels (9px); those labels are outside this feature. No promotional imagery or motion is appropriate for this operational table.
- Browser reproduction and artifact locations: [fleet monitoring checks](../../../../src/logistics/tests/README-fleet-monitoring.md). Live PostgreSQL/deployed API, real-account and assistive-technology acceptance remain open. No migration or external Flutter change.

### Visual review

ROUND 1
- Seen in one second: fleet availability and trucks needing departure attention.
- Idea: put confirmed location, assignment and schedule together per truck.
- Live thing: searchable fleet table and truck event history.
- Layout: existing Logistics shell / availability strip / filters / operational table; detail overview / active-trip events / history.
- Scores: design 7.5 · usability 8 · creativity 7 · content 8 → overall 7.7 (subjective review).
- Caps applied: none; portal contract controls the visual system.
- Problems: desktop Apply button occupied an oversized second row; overdue checkbox spacing was cramped; source rendering blocks were difficult to scan. Fixed the filter grid and checkbox alignment and separated trip event presentation with readable JSX.

ROUND 2
- Seen in one second: truck state, confirmed hub and departure attention.
- Idea/live thing: unchanged; existing Logistics blue/slate tokens and shared portal controls identify the product.
- Scores: design 8 · usability 8 · creativity 7 · content 8 → overall 7.8 (subjective review).
- Caps applied: none. Final desktop/mobile light/dark screenshots and all inspector captures reviewed; no further feature-specific visual defect identified. Tablet review also identified compressed table columns; a 960px table minimum now preserves readable columns inside labelled scroll regions, verified by explicit browser assertions. Long history is paginated.
