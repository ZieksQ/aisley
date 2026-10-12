# Marketplace UX verification — 2026-10-04

Implemented on `feature/buyer-marketplace-ux`, branched from the active `main`.
Adopted Laravel contract baseline remains `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`;
no backend, API/wire contract, dependency, storage adapter or authorization change.
Android and responsive web share one Flutter app. Running backend revision remains
unidentified; the authorized local API was unavailable during this work.

## Delivered presentation

Light pink/purple theme, 8px corners, readable fields/buttons/tabs/feedback and
16/24/32px padding; 560px forms and 1200px shopping bounds. Phone/tablet retain
Home/Shops/Cart/Account; desktop adds marketplace search/navigation and explicitly
separate notification/Shop/Logistics/Courier utilities. Protected details share
chrome; checkout is compact; unresolved identity/consent exposes no shopping chrome.

Home categories, campaigns/deals, rails and recommendation grids; square Product
cards with server prices/discount/rating/sold metadata; Products/Shops search tabs
and query/pagination; gallery/variant/quantity purchase layout with reserved mobile
actions. Cart uses image rows and optional Shop grouping from unique Product-detail
reads (four concurrent maximum), with ungrouped failure fallback. Selection, prices,
availability and commerce authority remain in existing controllers/DTOs.

Checkout addresses, Shop quote items/vouchers, COD and summary use one responsive
page: explicit “Review order”, current quote/expiry, placement confirmation and frozen
uncertain-request recovery. Orders have status tabs, clear cards and chronological
numbered tracking. Account groups shopping/details/help/settings, with desktop form
navigation. Authentication/recovery/approval/consent use shared focused forms;
consent remains unchecked. Notifications, Q&A, reviews/photos, support and independent
message channels share readable sections/composers. Desktop message threads add a
channel inbox; hidden panes do not poll. Draft/read-only/read-marker/retry behavior
remains controller-owned.

## Executed checks

- `dart format lib test` and `flutter analyze --no-pub`: formatting applied and clean analysis.
- `flutter test --no-pub`: 273 passed; 42 opt-in live cases skipped because no live API was selected.
- `CHROME_EXECUTABLE=/usr/bin/chromium flutter test --no-pub --platform chrome test/web`: ten passed, including encrypted secure storage, credential isolation, multipart/private bytes and mutation headers/replay.
- Mounted resize matrix covers 32 screens at 320, 360, 390, 412, 600, 800, 1024 and 1440 pixels; portrait/landscape, scales 1/1.5/2, keyboard insets and repeated breakpoints. Checks preserve draft/focus and request counts; first desktop inbox exposure may perform its initial channel read.
- Accessibility guidelines cover 32 feature/layout cases: Android 48px targets, labels and text contrast, plus keyboard/Tab checks. Header tests cover intermediate scales 1.01/1.1/1.25/1.3 at desktop boundaries and verify named 48px controls, focused search draft through resizing, search submission/history, access-gated chrome and pink/purple text contrast.
- Cart metadata tests verify deduplication, maximum concurrency, failure fallback, unchanged selection and rejection of removed-line/identity-loss responses. Cart has a standalone labeled checkbox node instead of merged section semantics; Chromium verifies its checkbox role and actual selection. A foreground-visibility regression checks hidden inbox timer/focus/resume suppression. Existing suites retain quote expiry/uncertain replay, Cart mutation recovery, sign-in/consent races, cleanup, message draft/read-only and upload checks.

- `python3 tool/verify_release.py --report-name marketplace-final`: all nine checks passed (locked dependencies, formatting, analysis, unit/widget, Chromium, tooling, documentation/assets/security, web and release APK). Filtered report: ignored `build/verification/marketplace-final.json`.
- `python3 -m unittest discover -s tool -p '*_test.py'`: ten passed. `python3 tool/verify_bundle.py`, Python syntax compilation and `git diff --check` passed. All 22 Customer specs remain 200–230 physical lines; no feature contract was revised.
- `BUYER_SCREENSHOT_DIR=docs/references/marketplace-screenshots python3 tool/browser_smoke.py --synthetic-only`: exact CDP content viewports at 320/390/600/800/1024/1440 and landscape, signed-out guards/reload/Back, protected routes, all three channels, Q&A/reviews/support, and mobile/desktop purchase journeys. Every API path is intercepted before startup/reloads; unknown calls fail locally. Search Enter/back, two deliberate Cart additions, preserved selection, four explicit quotes, cancelled placement (zero placement writes), no guest merge and sign-out are asserted. Focused diagnosis uses `--synthetic-journey-only` without substituting for the complete matrix.

## Synthetic screenshots

| Screen | 390px mobile | 1440px desktop |
| --- | --- | --- |
| Home | [Mobile Home](marketplace-screenshots/home-390.png) | [Desktop Home](marketplace-screenshots/home-1440.png) |
| Product | [Mobile Product](marketplace-screenshots/product-390.png) | [Desktop Product](marketplace-screenshots/product-1440.png) |
| Selected Cart | [Mobile Cart](marketplace-screenshots/cart-390.png) | [Desktop Cart](marketplace-screenshots/cart-1440.png) |
| Reviewed checkout | [Mobile checkout](marketplace-screenshots/checkout-390.png) | [Desktop checkout](marketplace-screenshots/checkout-1440.png) |
| Shop messages | [Mobile thread](marketplace-screenshots/messages-390.png) | [Desktop split](marketplace-screenshots/messages-1440.png) |

Fixtures contain only synthetic profiles, addresses, catalog and messages. They use
image-unavailable placeholders and a server-declared read-only message example; no
real media, credentials or private uploads were captured. Screenshots demonstrate
presentation and distinct states, not actual backend permissions or commerce success.

## Remaining acceptance gates

Synthetic fixtures/screenshots and builds do not certify real stock, shipping,
vouchers, reservations, counterpart permissions or installed Android behavior.
Controlled authenticated/live acceptance, deployed backend revision, Retry-After CORS
exposure, installed Android/TalkBack/picker/permission checks and production signing/
application ID remain open. Compilation uses public nonfunctional HTTPS placeholders
and existing debug signing. No real-account credentials/private uploads/live writes,
new packages or backend/database changes were used.
