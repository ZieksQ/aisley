# Sorting revision verification — 2026-10-06

This feature is implemented on `feature/sort-plan-versions-lane-recovery`. Verification uses isolated test databases and a local production Logistics build. No physical dock, camera, printed label, external Flutter client or production deployment was tested.

## Laravel and PostgreSQL

From `src/api`:

```sh
php artisan test --compact --filter='SortingVersionsTest|FinalMileFulfillmentTest|CompanyTruckLinehaulTest|HubRoutingTest|LinehaulReceivingTest|LinehaulTest|DemoCheckoutSeederTest|CustomerCheckoutTest'
php tests/Support/run-delivery-postgres.php 'SortingVersionsTest|SortingConcurrencyTest|FinalMileFulfillmentTest|CompanyTruckLinehaulTest|HubRoutingTest|CustomerCheckoutTest'
php vendor/bin/pint --dirty --test
```

The PostgreSQL runner reads the local Laravel connection internally, creates a uniquely named temporary database, and drops it in `finally`. It must have permission to create disposable databases; it never runs migrations against the application database. The concurrency class requires PostgreSQL and `pcntl`, uses independent workers/connections and a bounded statement timeout, and verifies:

- Activation racing a scan produces one internally consistent frozen version/lane snapshot.
- Identical concurrent captures return the same result with one scan and one sorting event.
- Identical concurrent activations return one recorded outcome.

`SortingVersionsTest` covers draft/published isolation, lane 1 → lane 5, renaming and committed-result replay, independent duplication with shared lanes, distinct scheduled times/cancellation/archival, overdue scan and quotation catch-up, invalid activation retention, selected-lane Pause/manual fallback/unaffected lanes, dispatch blocking/Resume, durable damage/repeated attempts/carry-over/recovery, tenant isolation, ORM/database immutability, and additive legacy import with unknown historical labels left null.

The existing final-mile and company-truck tests also cover frozen dispatch provenance after version changes, blocked existing linehaul reservations/departure, and validation of the same pending Courier pickup evidence after Resume. Existing SQLite-specific historical migration reconstruction checks are explicitly skipped on PostgreSQL; the new version migration/import is tested on both engines.

Final verification results: the complete affected SQLite suite passed **70 tests / 1,585 assertions**. The final PostgreSQL checks passed **9 tests / 261 assertions** across bounded version/recovery, activation/scan race, and retry-race runs. Earlier affected PostgreSQL dispatch/checkout/routing regressions passed; two historical SQLite-only reconstruction checks were explicitly skipped there. Interrupted runs and fixture/migration issues were corrected and rerun; inactive temporary databases from interruptions were removed.

## Logistics browser and build

From the repo root:

```sh
pnpm --filter logistics lint
pnpm --filter logistics build
pnpm --filter logistics exec vite preview --host 127.0.0.1 --port 15176
```

Start an isolated Chromium profile exposing local CDP on port `19226`, then run:

```sh
node src/logistics/tests/sorting-browser.smoke.mjs
```

The harness creates a fresh browser target and installs controlled tenant/auth/sorting/dispatch API fixtures before navigation. It checks 390/768/1440px in light/dark across Sort plan, Sorting, last-mile Dispatch and company-truck Dispatch; table containment, keyboard focus/native-dialog Escape, disabled held-lane selection and blocked-trip reasons, original identity/body on uncertain plan/copy/release retries, documented damage release and selected recovery requests, and loading/empty/error reads.

Offline capture is checked by disconnecting the capture context, verifying no mutation is sent, reloading with the same IndexedDB outbox, and confirming prompt synchronization displays the API lane. The mocked API intentionally confirms lane 5 while its cached routing points at lane 1. Committed retry behavior is separately verified through Laravel/PostgreSQL tests; mock responses do not certify live integration.

Screenshots are written only to ignored `src/api/storage/framework/testing/sorting-browser-shots`. Mobile and desktop captures were visually inspected. The new version/lane/exception JSX was expanded for review using the installed TypeScript formatter and checked for identical compiled JavaScript before/after formatting. No dependency was added. Vite retains its existing large-chunk warning.

## Operational adoption

The new additive migration was applied to local PostgreSQL; a read-only import check found four plans/four initial versions, no invalid active selection and no duplicate active hubs. For other environments, apply only `2026_10_06_000004_add_sorting_versions_and_recovery.php` and keep Laravel's existing scheduler running for one-minute activation recovery. Authoritative reads/scans also catch up overdue selections. Operators must reconcile participating device outboxes before closing a session and physically rescan recovered parcels.

Canonical Sorting, dispatch, routing, shared fulfillment/workspace/schema and affected Courier handoff contracts were updated. The portable Courier bundle received only affected contract sections and an attributed documentation progress entry; its Flutter implementation/adoption/acceptance status and archived logs remain unchanged.

## Sort plan UI revision — 2026-10-07

The Sort plan workspace now uses lane Activate/Deactivate, plan-row three-dot menus with a confirmed numbered copy action, a separate searchable published-version browser, visible preserved-destination/difference tables, and dismissible five-second success messages. Historical API lane states and dispatch behavior remain compatible; the browser harness no longer attempts the removed lane-state controls.

Run `php src/api/vendor/bin/phpunit -c src/api/phpunit.xml src/api/tests/Feature/Logistics/SortingPlanCopyTest.php` from the repository root for automatic naming, draft/published mapping isolation, replay, archived names, Unicode length and tenant isolation. Existing SortingVersions/HubRouting regressions cover destination-aware lane changes and preserved assignments/accepted connections. These focused SQLite runs passed 32 tests / 557 assertions; scoped PHP Pint and Logistics lint/type/build passed. Vite retains its existing chunk-size warning.

The updated browser harness checks the published-version modal and copy confirmation in all six Sort plan viewport/theme combinations, keyboard focus/Escape, no duplicate-name field or mapping disclosure, independent plan/version searches, exact uncertain-copy retries, successful-copy focus restoration, manual dismissal and automatic expiry. The existing Sorting/dispatch responsive, exception-release/recovery and offline checks remain in the harness. Browser checks use controlled API fixtures and are separate from live API/PostgreSQL/device verification.

Final Chromium run passed all 24 existing viewport/theme states, including the six revised Sort plan modal/menu combinations, and the additional copy/search/notice/focus checks. Mobile light and desktop dark published-version screenshots were visually inspected. No live HTTP, PostgreSQL concurrency or physical-device checks were rerun for this revision.
