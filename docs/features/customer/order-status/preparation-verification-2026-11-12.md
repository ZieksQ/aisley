# Preparation deadline verification — 2026-11-12

Implemented `order-preparation-v1` in Laravel, Customer web and the sibling Buyer Flutter checkout on feature branches. This is local verification, not deployed commerce or installed-device acceptance.

## Verified behavior

- Acceptance history starts the initial 72-hour preparation window, including existing Orders and acceptance events outside the embedded tracking preview. Expiry is inclusive; missing acceptance evidence disables the actions.
- One Buyer extension starts 72 hours at approval, does not alter payment/stock/status, and does not emit another Seller-acceptance notification. Exact retries preserve the deadline, including after later cancellation.
- Overdue processing cancellation retains pending-COD/downstream safeguards and releases reserved stock exactly once. Address changes remain placed-only. Late readiness closes both actions, and cancelled Orders invalidate bulk pickup atomically.
- PostgreSQL independent workers verify extension/cancellation and readiness/cancellation races plus duplicate extension retries.
- Web confirms each decision, preserves uncertain request keys/reasons across navigation within the session, blocks competing writes and Escape while unresolved, refetches conflicts and isolates account/session responses. The focused panel/dialog captures were reviewed at phone, tablet, desktop and short-height sizes.
- Buyer typed parsing hides extension on older responses, preserves exact uncertain retries and clears private pending state on identity loss. Its Order-detail confirmation reaches the committed extended-deadline state. Panel widgets pass light/dark checks at 320/390/768/1440 pixels; existing image/address/direct-delivery behavior remains covered.

## Commands and results

Platform commands use the platform repository root unless noted:

- `php src/api/vendor/bin/phpunit -c src/api/phpunit.xml src/api/tests/Feature/Customer/OrderPreparationTest.php src/api/tests/Feature/Customer/CustomerOrderStatusTest.php src/api/tests/Feature/Seller/SellerAcceptOrderTest.php src/api/tests/Feature/Orders/OrderPreparationConcurrencyTest.php`: **24 passed, 351 assertions**; three PostgreSQL-only cases skipped on SQLite.
- From `src/api`, `php tests/Support/run-delivery-postgres.php 'OrderPreparationTest|OrderPreparationConcurrencyTest'`: **10 passed, 116 assertions** in a uniquely named disposable PostgreSQL database.
- Customer `next build --webpack`, TypeScript and scoped ESLint: passed. Scoped PHP Pint and Git whitespace checks: passed.
- `node src/webapp/tests/order-preparation-browser.mjs`: passed at 320×740, 390×844, 768×1024, 1440×900 and 390×400, plus cancellation, stale disabling, pending Escape, frozen exact retry after remount, conflict refresh and session response disposal.
- `node src/webapp/tests/order-contact-browser.mjs` and `node --test src/webapp/tests/order-contact.test.mjs`: existing browser suite and **12 unit tests passed**.
- Buyer `flutter test --no-pub test/features/order_preparation_test.dart test/features/phase_3_orders_test.dart test/features/order_images_test.dart test/features/order_contact_pins_test.dart test/features/direct_delivery_order_test.dart`: **59 passed**.
- Buyer full `flutter analyze --no-pub`: no issues; scoped Dart formatting check: no changes. `flutter run -d web-server --web-hostname 127.0.0.1 --web-port 8766 --no-pub` compiled the app; interactive hot reload completed with **no client connected**.
- Changed portable JSON/schema/examples parse, operation IDs remain unique, and affected Buyer specs remain within 200–230 lines.

The initial browser/build runs required sandbox network/socket escalation; reruns passed. Test fixtures were corrected for required pins and second-precision stored times. No application dependency was added.

## Rollout and remaining acceptance

Apply the additive `2026_11_12_120000_create_order_preparation_extensions_table` migration before deploying the backend/client changes. Existing Orders use recorded acceptance time immediately, so some become overdue at rollout. There is no automatic cancellation worker.

Browser/API transport fixtures are synthetic except the isolated PostgreSQL service tests. No deployed migration, production traffic, live provider, physical Android/TalkBack or release APK verification is claimed. Debug web compilation and a no-client hot reload do not certify installed-device behavior. No Courier contract changed.
