# Buyer Order images — G30 and T02 verification

Date: 2026-10-11. Inspected Laravel image contract: `5d55ecf379c7646dedcae5a3170cfcb61093db26`.
Implementation branches: `feature/fix-buyer-order-images` in aisley and the external Buyer repository.

## Implemented behavior

- Buyer `ItemPreview` and shared `SnapshotItem` parse optional nullable `imageUrl`; older omission remains compatible. Wrong field types are decode failures.
- Orders list previews and every purchased item in Order detail show a 64px square thumbnail beside wrapping facts. Current Product media complements frozen names, quantities, variants and prices; it is not immutable purchase evidence.
- The existing `CatalogImage`/Discovery public-media loader validates API origin and permitted paths, omits bearer/cookies, rejects redirects and uses loading/unavailable fallbacks. Missing, foreign, inaccessible or corrupt media never disables Order actions. No Product lookup or storage URL construction was added.
- API response shapes and runtime implementation remain unchanged. T02 tests exercise real owned quote, placement, committed replay, history/detail and batch endpoints. Checkout thumbnails remain outside Buyer G30 presentation scope; shared batch parsing adopts the field.

## Local results

- Laravel: 27 focused Order image/status/Checkout tests passed, 521 assertions, using isolated in-memory SQLite. Ten new image cases cover approved Variant precedence, Product default/first approved gallery fallback, pending/rejected/deleted/foreign Variant media, pending default, no media, removed Product/Variant relations, unchanged stored snapshots and foreign-Customer denial.
- Buyer: full Flutter suite passed 630 tests with 42 live opt-in tests skipped; final focused image suite passed 23 tests. Parser/widget/transport tests cover null/omitted/empty/wrong types, decoded bytes, missing previews, safe URL refusal, corrupt/unavailable bytes, credential omission, four widths with doubled text and delayed replies after logout/account switch/consent loss/navigation.
- Chromium: 23 synthetic checks passed on actual Orders/Order detail screens at 320/390/768/1440px, light theme, 320px doubled text/long names, missing/broken/corrupt/foreign media, loading/release, late image after logout and keyboard focus/navigation. Representative normal, fallback, desktop and enlarged-text screenshots were inspected. Zero fixture-page external HTTP requests or recorded runtime/overflow exceptions.
- Buyer web and Android release builds passed using non-secret placeholder HTTPS origins; APK 92.9 MB.
- Formatting, analyzer, PHP syntax/Pint, changed-document local links, both bundles’ spec/JSON checks, G30 parity and Git whitespace checks passed. Buyer bundle validation passed 872 links, 22 Customer specs and 19 PSGC assets/registrations; broad live/device acceptance remains separate.

## Reproduction

From aisley, run `php src/api/vendor/bin/phpunit --configuration src/api/phpunit.xml src/api/tests/Feature/Customer/CustomerOrderImagesTest.php src/api/tests/Feature/Customer/CustomerOrderStatusTest.php src/api/tests/Feature/Customer/CustomerCheckoutTest.php`.

In the authorized Buyer repository, run `flutter test --no-pub test/features/order_images_test.dart`, `flutter test --no-pub --concurrency=2`, and `flutter analyze --no-pub`. Release builds use `API_BASE_URL=https://api.example.invalid/api/v1` and `STOREFRONT_ORIGIN=https://shop.example.invalid`; these are compilation placeholders.

Build the browser fixture with `flutter build web --release --no-pub --no-web-resources-cdn --no-wasm-dry-run --output build/order-images-browser -t test/manual/order_images_browser_fixture.dart`. Serve that directory at localhost:8766 and start isolated Chromium CDP on port 9345. Run `node test/manual/check_order_images_browser.mjs`; FIXTURE_ORIGIN/CDP_ORIGIN may override local origins. Reports/screenshots live under ignored `build/order-images-evidence/`.

## Limits

Browser authentication, Order DTOs and image transport are synthetic. Checks exercise actual Order screens and the public-media loader, not live cookie/bearer integration or deployed media/storage. External/legacy storage URLs outside the existing trusted-media loader use the placeholder.

No live account/API/database/provider/deployment, installed Android/TalkBack or release-signing checks ran. No schema, migration, dependency or API payload changes were made. G30 and T02 have local implementation/test evidence; deployed behavior and device acceptance remain open. Other adoption/release gaps and the historical audit are preserved.
