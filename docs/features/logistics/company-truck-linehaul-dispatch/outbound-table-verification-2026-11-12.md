# Outbound table and selected-trip monitoring — 2026-11-12

## Result and design

- Split status and actions, aligned the table/header insets, used 8px vertical cell padding and a fixed-width stacked action column. Retained operational eligibility, blocked-lane messages and contained horizontal scrolling.
- Route links and non-interactive row clicks open the owned truck's monitoring page with the selected trip ID. The matching active section receives focus; terminal trips resolve to existing history details. Missing selections and changed assignments never display another trip in their place.
- Followed `docs/design.md` and design-taste-frontend's app/component guidance. Kept AISLEY Logistics blue/slate, Geist, existing themes, portal primitives and the surrounding composition. No draw/seed/redraw applies to this existing component fix. Idea: the outbound route becomes the direct entry to its recorded monitoring evidence. Live interaction: trip navigation with identity checking.
- No new imagery, generated artwork, dependencies, APIs, migrations or external mobile contracts. Example hubs, drivers, loads and extra-long labels exist only in synthetic browser fixtures; no production sample data was introduced.

## Verification

- Logistics TypeScript, production Vite build, scoped Oxlint, Taste source lint and whitespace checks passed. Existing large-bundle warning remains.
- New outbound suite: 34 synthetic Chromium checks passed, with six light/dark combinations at 390/768/1440px. Covered cell insets, button touch targets, status/action separation, blocked release, operational action isolation, row and keyboard links, selected-trip focus, Back, history fallback/filter preservation, unknown trip/truck, stale refresh/retry, changed assignment on refresh and empty results. No runtime exceptions.
- Existing production-preview monitoring suite: 79 checks across 18 responsive combinations passed. Existing past-transfer suite: 66 checks passed. Existing transport interaction suite passed, including dispatch capacity/actions, qualified driver controls, inbound decisions, confirmation routing and retry behavior. Development-server trial runs stopped at timing-sensitive readiness assertions; the intended production-preview runs passed.
- Browser fixtures intercept private APIs and use no real accounts. Basemap tiles were unavailable/intermittent in the past-transfer capture; the existing marker and schematic route fallback remained visible. Deployed/real-account acceptance remains open.
- Commands: `src/logistics/node_modules/.bin/tsc -b src/logistics`, `src/logistics/node_modules/.bin/vite build src/logistics`, scoped `src/logistics/node_modules/.bin/oxlint`, `node src/logistics/tests/linehaul-outbound-browser.smoke.mjs`, `node src/logistics/tests/fleet-monitoring-browser.smoke.mjs`, `node src/logistics/tests/fleet-transfers-browser.smoke.mjs`. Browser runs used `LOGISTICS_UI_ORIGIN=http://127.0.0.1:5188` and CDP port 19359. Transport interactions additionally used `LOGISTICS_UI_INTERACTIONS_ONLY=1`.
- Local ignored artifacts: `src/logistics/node_modules/.cache/linehaul-outbound/{before,after}/` contains table captures, standalone snapshots and Taste measurements. The final snapshot removes scripts and embeds CSS, fonts and logos so the inspector measures the captured authenticated screen without cross-origin asset reads. Final destination captures include matching active, terminal and unavailable trips.

- Taste final static inspection at 1440/768/390px: **0 failures, 2 warnings**. The existing shell/page duplicate h1 and the existing parcel-list/request-form height difference are outside this table fix. `tiny-text` is allowed only for the pre-existing sidebar Beta labels. Before inspection had 0 failures and 3 warnings, including a standalone-snapshot font-loading warning eliminated by embedding final assets. All final inspector images and live table/destination captures were reviewed.

## Visual review

ROUND 1
Seen in one second: outbound routes, with status and action controls mixed together.
Idea (one sentence): make each outbound route the entry to that exact trip's monitoring evidence.
Live thing: existing operational release/depart/cancel controls.
Layout words by section: dispatch=existing parcel list and request form / outbound=operational table.
Scores: design 6.5 · usability 6.5 · creativity 7 · content 8 → overall 6.7 (subjective component review).
Caps applied: app/component review; promotional imagery and motion requirements do not apply.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. `before/1440-light.png`: blocked-status text shifts action controls. Split Status and Actions into separate columns.
2. `before/1440-light.png`: cell insets differ from the header and load/driver text wraps prematurely. Match horizontal padding and give columns explicit proportions.
3. `before/390-dark.png`: row heights are dominated by wrapped controls outside the phone viewport. Stack controls in a fixed-width column and preserve a readable scrolling table.

ROUND 2
Seen in one second: route, truck, schedule and status, with a consistent trailing action stack.
Idea (one sentence): the outbound route opens its exact recorded trip, including when it has moved to history.
Live thing: native route links, row navigation and identity-safe monitoring selection.
Layout words by section: dispatch=existing composition / outbound=compact six-column table / monitoring=truck overview and selected trip.
Scores: design 7.5 · usability 8 · creativity 7 · content 8 → overall 7.6 (subjective component review).
Caps applied: app/component review under the repository design contract.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. `after/390-dark.png`: the operational table still requires horizontal scrolling. Deliberately retained all required fields with contained scrolling; no page overflow.
2. `after/inspect/desktop-page-01.jpg`: the existing parcel list and request form end at different heights. Outside this table fix; retain their working composition.
3. `after/inspect/desktop-fold.jpg`: existing shell and page both use h1 semantics; legacy sidebar Beta labels remain small. Outside this table fix; record inspector findings rather than restyling the shell.
