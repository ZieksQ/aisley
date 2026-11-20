# Linehaul driver selection context — 2026-11-11

## Change

Qualified driver selection now shows availability, blocking assignment stages, schedule times in Asia/Manila, truck plates, planned routes/areas and event-derived operational location. Busy drivers remain readable with selection disabled. Available drivers sort first; refresh removes a driver who becomes busy. The API and transactional scheduling share work queries, including current delivery acceptance/transit states that the old conflict check missed.

Location comes from existing operational records. Planned origins/stops do not establish physical presence; driver-reported arrival remains explicitly unconfirmed; historical trip receipt shows its timestamp. Missing evidence remains unavailable. No GPS collection, schema migration, dependency, or external mobile contract change.

## Automated verification

- New `LinehaulDriverAvailabilityTest`: **7 tests, 135 assertions** passed after final API changes. Covers qualification/order, foreign-driver exclusion, overdue and completed-but-unreceived pickups, all active linehaul stages and arrival uncertainty, historical receipt, current delivery stages, schedule/task grouping, multiple work types, foreign-work redaction and real scheduling rejection after delivery acceptance/in-transit even with a completed dispatch schedule.
- The new tests plus existing `FleetAssignmentMonitoringTest` and `CourierScheduleConflictTest`: **16 tests, 343 assertions** passed. These tests use SQLite; PostgreSQL concurrent-worker acceptance remains open.
- Logistics TypeScript, Vite production build, scoped application/test Oxlint, scoped Pint and whitespace checks passed. The existing large-bundle warning remains. Used installed executables directly because the pnpm engine-store lock is outside the writable workspace.
- `CompanyTruckLinehaulTest` has **two existing fixture failures**: Seller pickup requests return 422 because fixture pickup addresses are unpinned. Reproduced the same failures by preloading the original HEAD `LinehaulTripService` through an ignored local PHPUnit bootstrap. This happens before driver selection or scheduling logic; unrelated fixtures were left unchanged.

## Browser verification

- Production-preview Chromium with synthetic session/API fixtures passed the existing **48 route/theme/viewport layout checks**, including six expanded driver-modal states at **390/768/1440px**, light/dark. Checked busy-row disabling, full-opacity readable details, schedule/timezone labels, operational location, modal overflow and Escape/focus restoration.
- Interaction verification covers search by truck plate, rejection of busy-row clicks, selected-location fallback, refresh invalidation and disabled submission, Tab/Enter selection of an available driver, and the existing truck-capacity, request payload, network, dispatch, inbound rejection, proof/COD retry and recovery flows.
- The first interaction attempts exposed harness timing and native keyboard-event omissions: wait for refresh completion before reopening, focus the search input before Tab, include Chromium's Enter text event, and target the open last-mile picker rather than an existing hidden dialog. These were corrected in the browser harness; no product keyboard handler was added. `LOGISTICS_UI_INTERACTIONS_ONLY=1` permits the interaction pass without repeating unchanged layout captures.
- Captures and local inspection adapters are ignored artifacts under `src/logistics/node_modules/.cache/transport-browser` and `linehaul-taste`.

## Visual review

Applied compatible Uncodixfy and Taste app-screen guidance under `docs/design.md`, retaining the current blue/slate palette, Geist typography and searchable modal layout. This focused component change needs no new direction draw or assets.

- Initial screenshot review found the shared disabled-button opacity faded the very details needed to explain blocking work. Option rows now retain full opacity while their native disabled state and Busy label communicate ineligibility.
- Reviewed all six final theme/viewport picker screenshots and all six final Taste inspector frames. Readable schedule/location wrapping and contained modal scrolling remain intact.
- Taste inspector: **0 failures, 2 warnings** at 1440/768/390px with documented allowances: `heavy-shadow` is the actual floating modal; `covered-text` is background content covered by that modal; `tiny-text` is the existing sidebar Beta labels. Warnings concern existing shell/page heading duplication and unequal-height underlying parcel/form panels; changing them is outside this fix.
- Self-review: design 7.5/10, usability 8/10, content clarity 8/10. Remaining limitation: busy drivers have readable text but are skipped by native button keyboard navigation; search and ordinary reading expose their reasons. Long concurrent assignments can require internal scrolling.

Deployed accounts, live PostgreSQL concurrency and production-volume acceptance were not exercised. Browser APIs are synthetic and do not prove deployed data correctness.
