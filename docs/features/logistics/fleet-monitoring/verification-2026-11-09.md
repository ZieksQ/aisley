# Fleet location clarity and past transfers — 2026-11-09

## Delivered behavior

- Truck markers use the saved last-confirmed hub, with plate and location labels. Assigned origin/destination hubs use square hub markers. In-transit status says the truck has left its confirmed hub and its current position is unavailable.
- Preserve current schedule, driver, commitments and event details. Sending organization/hub is Outbound Logistics; receiving organization/hub is Inbound Logistics, including returns.
- Past transfers buttons open a truck-specific, paginated terminal-history table. View transfer opens a separate details page with schedule, organizations, capacity snapshot, references, events and a hub map. Preserve fleet filters and history pagination through navigation.
- Only past details draw the dashed origin/destination connection. It is a schematic hub pair, not a travelled road. Without a manifest, identify the scheduled hub pair explicitly. Stored trip hub IDs are preserved; displayed names/pins resolve from current saved hubs.
- Existing Logistics access/consent gates protect the new read. Scope both truck ownership and trip membership; active trips and foreign/other-truck IDs return 404. No migrations, GPS collection, routing-provider calls or external Flutter contract changes.

## Verification

- Focused isolated SQLite API suites: `FleetMonitoringTest` and `FleetAssignmentMonitoringTest`, 15 tests / 264 assertions passed. Includes tenant/role/consent protection, terminal-only history, trip membership, organization identities, coordinate pair validation, unavailable pins, confirmed location independent of assigned origin, and existing monitoring behavior.
- Logistics TypeScript and production build passed. Existing large-bundle warning remains. Scoped Oxlint, PHP Pint and whitespace checks passed.
- Synthetic Chromium: transfer suite passed 66 checks covering four routes at 320/768/1440px in both themes, current schedules, URL/Back/history paging, map labels/connections, refresh recovery, missing/empty data and logout. Existing monitoring suite passed 65 checks across 18 responsive/theme combinations, including filtering, stale reads, session/consent and obsolete responses. Existing assignment suite passed 68 checks across 8 responsive/theme combinations, including grouped markers, stage/search/page filters, viewport retention and private-state disposal. Updated stale labels/navigation selectors and waited for search clearing before changing stages in that harness.
- Browser fixture APIs are synthetic. Map tiles use the configured browser provider and were intermittent; saved markers/route and fallback text remained available. Actual PostgreSQL, deployed provider/account and real-truck acceptance remain open.
- Screenshots and rendered snapshot: `src/logistics/node_modules/.cache/fleet-transfers-browser/`; existing suites retain their documented cache directories. Run browser suites sequentially to avoid tab-visibility interference.

## Design review

- Applied Taste and Uncodixfy under `docs/design.md`. Draw: Achromatic ledger, seed 703027611, keeping existing palette/type. Logistics blue/slate surfaces, action colors, shell and feature-required map markers override conflicting skill preferences; no palette/type redraw or new assets/dependencies.
- Question: where was this truck last confirmed, what is its current schedule, and what happened on a past transfer? The confirmed-hub marker/plate is the primary map cue; current work stays visible while historical detail opens separately.
- Round 1: reviewed phone and desktop light/dark captures. Added explicit inbound/outbound labels, retained schedule/timeline distinctions, and increased map-fit padding to prevent clipped location labels.
- Round 2: reviewed the revised phone route map. Placed destination labels below destination markers so labels no longer obscure the connection. Existing typography, table scroll frames and role themes are preserved.
- New-component Taste source lint: zero failures/warnings. Rendered current-map snapshot inspection at 1440/768/390px: zero failures after documented `icon-chips` allowance for required stage/map icons and `tiny-text` allowance for existing sidebar Beta labels. One below-fold warning remains for the existing monitoring workspace composition. Static Leaflet snapshots do not recompute map positions on resize; live browser checks establish responsive overflow behavior.
- Subjective final review: usability 8/10, visual clarity 8/10, content 8/10. Intermittent basemap tiles and live operational acceptance remain the practical limitations. No stock/generated imagery or production sample content was added.
