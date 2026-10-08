# Voucher authoring verification

Run commands from the repository root. Specifications: [shared](spec.md), [Admin](../../admin/vouchers/spec.md), [Seller](../../seller/vouchers/spec.md), [Customer usage](../../customer/voucher-usage/spec.md).

## Backend

```sh
cd src/api
php artisan test --compact --filter='Voucher|CustomerCheckoutTest|FinanceAccessTest|FinanceLedgerTest|CommissionPolicyConfigurationTest|OrderLifecycleTest|CodAutomationTest'
php tests/Support/run-delivery-postgres.php 'VoucherAuthoringTest|VoucherCheckoutTest|VoucherFundingTest|VoucherBackfillTest|VoucherConcurrencyTest'
```

The existing PostgreSQL runner reads the local connection without printing credentials, creates a uniquely named `aisley_pod_test_*` database and drops it in `finally`. Concurrency tests require PostgreSQL and pcntl; they deliberately skip under SQLite. Never run their migration fixtures against an application database.

Coverage includes role/consent/approval/permission gates; Seller isolation on every read/mutation; strict term/ownership/targeting/benefit rejection; generated/normalized/global-unique codes and preserved legacy published codes; initial schedules; separate drafts, immutable versions/actions, replacement identity/limits, pause/resume/end/discard/copy; exact receipts/revision conflicts; server statuses/search; private UTC history and redacted legacy Customer targeting; baseline backfill; invisible/directly rejected drafts; unchanged App/per-benefit/reciprocal stacking limits; same-second stale quotes; draft saves preserving live quotes; cancelled usage and immutable historical savings; Seller/platform funding.

Independent PostgreSQL workers cover same-key creation/publication, distinct-key publication versus ending, last redemption, publication versus pause, and checkout versus replacement/pause/end. Workers use independent connections, a start barrier and bounded statement/alarm timeouts.

Funding tests place real authored-voucher Orders through checkout, Seller approval/readiness, Courier first-mile pickup and hub receipt. They simulate delivered status to isolate Finance, then check frozen commission/proceeds, balanced delivery ledger, full cleared remittance, Seller/Logistics payout amounts and duplicate-safe simulated successful transfers. Existing `OrderLifecycleTest` separately covers real final-mile/POD transitions without authored vouchers. These tests do not certify a live provider or physical delivery.

## Web

```sh
pnpm --dir src/admin build
pnpm --dir src/admin lint
pnpm --dir src/seller build
pnpm --dir src/seller lint
src/admin/node_modules/.bin/oxlint packages/voucher-ui/src
pnpm --dir src/webapp exec tsc --noEmit
pnpm --dir src/webapp lint
```

Serve the unchanged production builds in separate terminals:

```sh
pnpm --dir src/admin exec vite preview --host 127.0.0.1 --port 15195 --strictPort
pnpm --dir src/seller exec vite preview --host 127.0.0.1 --port 15196 --strictPort
```

Start an isolated headless Chromium using an installed binary, with its profile inside the repository:

```sh
chromium --headless --no-sandbox --disable-dev-shm-usage --no-first-run \
  --user-data-dir=src/admin/node_modules/.cache/voucher-chromium \
  --remote-debugging-port=19355 about:blank
node src/admin/tests/vouchers-browser.smoke.mjs admin
node src/admin/tests/vouchers-browser.smoke.mjs seller
```

Override addresses using `VOUCHER_UI_ORIGIN`/`VOUCHER_UI_CDP`. The runner owns and closes its own CDP target. It injects controlled HTTP fixtures before rendering; no build bytes are modified. Screenshots are written under each app's ignored `node_modules/.cache/voucher-browser` directory.

Checks cover `/vouchers`, `/vouchers/new` and `/vouchers/:id` at 390/768/1440px in light/dark (36 combinations), table overflow, keyboard/dialog focus/Escape, minimum form input, Seller shipping exclusion, pending differences, exact publication funding/terms, pause/resume/end, draft discard, independent duplication, list/history pagination, empty/read/history errors, field validation with retained input, sidebar/browser Back draft cancellation, exact create/pause retries after a committed but lost response, uncertain-navigation blocking, authorization cleanup and read-only Admin access. Mock browser checks do not establish live Laravel HTTP integration. Customer checkout changes are checked through backend tests and storefront type/lint; this work adds no Customer screen and does not certify external Flutter adoption.

## Local rollout

Apply only the additive migration after verifying the feature branch:

```sh
cd src/api
php artisan migrate --path=database/migrations/2026_10_08_000001_add_voucher_authoring.php --force
```

Existing terms/codes/counters/Order snapshots are preserved as published baselines. Permission records are provisioned through the migration and `AdminPermissionSeeder`; grant `vouchers.view` and, where appropriate, `vouchers.manage` through the environment's existing `admin_permissions` provisioning. Existing Admin grants are not broadened automatically. Seller gates remain approval/active account/consent plus authenticated Shop ownership. No activation job is required.

Final run counts, static checks and limits are recorded in the app-wide [progress log](../../../PROGRESS.md).
