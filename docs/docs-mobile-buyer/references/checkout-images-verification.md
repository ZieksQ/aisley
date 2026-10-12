# Buyer Checkout thumbnails — G31 verification

Date: 2026-10-12. Buyer implementation branch: `feature/fix-g31-checkout-thumbnails`.
Image API contract remains Laravel `5d55ecf379c7646dedcae5a3170cfcb61093db26`; other adopted contracts and the unidentified deployed revision are preserved.

## Implemented behavior

- `QuoteItem` now parses optional nullable `imageUrl`, matching existing batch `SnapshotItem` compatibility. Wrong field types produce decode failures; old-server omission remains supported.
- Checkout review shows a 64px Product thumbnail alongside the existing name, quantity, selected options and prices inside each outlined item card. Results show thumbnails alongside existing item names/quantities.
- Orders and Checkout share `ProductItemRow` in discovery presentation. The existing `CatalogImage` and public-media repository validate the trusted API origin/path and load without bearer/cookies. No Product lookup, storage URL construction, image viewer or dependency was added.
- Missing, empty, unsafe, unavailable and corrupt media use the existing fallback; delayed media uses the existing indicator. Image failure/loading never determines checkout eligibility or blocks its actions.
- Quote expiry, totals, provider/voucher selection, confirmation, frozen placement payload/key, exact retry and result navigation retain their established behavior. Media describes current Products, rather than immutable purchase evidence.

## Local checks

- Focused Checkout/Order-image run: 64 tests pass (41 new Checkout cases and 23 existing Order-image cases). Coverage includes optional/null/invalid parsing, decoded thumbnails and semantics, credential omission, rejected URLs without dispatch, missing/unavailable/corrupt media, loading with usable actions, late replies after logout/consent/navigation, multiple Shops and confirmed review-to-result placement. The confirmed placement excludes image fields and retains an idempotency key.
- Checkout viewport tests pass at 320/390/600/800/1024/1440 logical pixels and 640×320 landscape, with doubled text and long names. Images stay 64×64; actions remain reachable without rendering exceptions.
- Initial full-suite run found the existing voucher Checkout harness lacked its newly required discovery dependency. The fixture now supplies the existing repository; all ten voucher widget tests and the final full suite pass.
- Final full Flutter suite: 722 pass, 42 explicitly opt-in live tests skipped, concurrency two. Analyzer passes. Production web and Android release builds pass using non-secret placeholder origins; Android reports an existing SDK XML-version warning.
- Chromium: 23 actual-screen synthetic checks pass at 320/390/768/1440px, normal/fallback/loading media, 320px doubled text/long names, loading release, delayed logout and keyboard focus/result navigation. Representative thumbnail, fallback, enlarged-text and desktop screenshots were inspected. Zero external fixture-page HTTP requests or recorded runtime/overflow exceptions.
- Final formatting and analyzer pass; bundle validation passes 883 local links, all 22 Customer spec lengths and 19 PSGC assets/registrations plus Android boundaries. Node syntax and Git whitespace checks pass. Browser driver waits for the async-enabled Review action and scrolls thumbnails into view; fixture controls live in routed semantics.

## Reproduction

Run from the authorized Buyer repository:

```sh
flutter test --no-pub test/features/checkout_images_test.dart test/features/order_images_test.dart
flutter test --no-pub --concurrency=2
flutter analyze --no-pub
dart format --output=none --set-exit-if-changed lib test
python3 tool/verify_bundle.py
flutter build web --release --no-pub --dart-define=API_BASE_URL=https://api.example.invalid --dart-define=STOREFRONT_ORIGIN=https://shop.example.invalid
flutter build apk --release --no-pub --dart-define=API_BASE_URL=https://api.example.invalid --dart-define=STOREFRONT_ORIGIN=https://shop.example.invalid
flutter build web --release --no-pub --no-web-resources-cdn --no-wasm-dry-run --output build/checkout-images-browser -t test/manual/checkout_images_browser_fixture.dart
```

Serve the compiled fixture at localhost:8766 and start isolated Chromium CDP on port 9345. Run `CHECKOUT_IMAGE_ARTIFACTS=build/checkout-images-evidence node test/manual/check_checkout_images_browser.mjs`. `FIXTURE_ORIGIN`/`CDP_ORIGIN` can override local origins. Evidence/logs are ignored build artifacts.

## Limits

Widget/browser authentication, checkout DTOs and image transport are synthetic. These checks do not establish a deployed backend/storage release or installed Android/TalkBack behavior. Existing external/legacy URLs outside trusted API media paths use the fallback.

No live account/API/database/provider/deployment, migration, installed-device or production-signing checks ran. No backend/schema/endpoint/dependency changes were made. G31 has local source/test evidence; live/deployed/device gates and unrelated audit findings remain open. The external historical audit report is preserved.
