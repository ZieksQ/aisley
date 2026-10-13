# Accessibility journeys verification — 2026-10-10

This records local Buyer Flutter evidence for accessibility across customer
journeys. It does not certify live API behavior or installed-device acceptance.

## Changes

- Set the shared light theme to standard density with 48px minimum button and
  icon targets. Kept compact navigation labels within the desktop header and
  raised account, catalog-action and section-action targets where needed.
- Put Cart and Product purchase actions into the scroll flow in compact-height
  layouts. Checkout also uses inline actions at enlarged text so keyboard focus
  follows the visible content instead of jumping between its sticky bar and
  address choices.
- Added a shared dirty-form exit guard for Android/browser Back, Cancel and
  route navigation, with duplicate prompts coalesced and explicit Stay/Leave
  choices. Profile email and policy Markdown can be selected/copied.
- Kept safe photo reads from blocking navigation; exposed large selection/save
  actions and made Order cancellation details and actions scroll together when
  the keyboard or enlarged text reduces dialog space.

## Checks run

Using Flutter 3.47.2 / Dart 3.13.2:

- `dart format --output=none --set-exit-if-changed` on the 16 changed Dart files:
  passed; no formatting changes required.
- `flutter analyze --no-pub`: passed with no issues.
- `flutter test --no-pub --reporter expanded`: passed, 541 tests passed and 42
  opt-in tests skipped. Includes 32 cross-route size/text-scale cases,
  accessibility guidelines and checkout/order dialog keyboard-inset checks.
- `python3 tool/verify_bundle.py`: passed (839 local links, 22 Customer specs,
  PSGC checksums/registrations and Android boundary checks).
- `flutter build web --no-pub`: passed (109.1s).
- `flutter build apk --release --no-pub`: passed (140.2s; 92.3MB). The local
  Android SDK emitted an XML metadata-version warning, but the release build
  completed.
- Synthetic browser accessibility command, run against `http://localhost:8766`
  with all API traffic intercepted by synthetic responses:

  ```sh
  BUYER_SCREENSHOT_DIR=build/verification/accessibility-screenshots \
    python3 tool/browser_accessibility.py \
    --accessibility-report build/verification/accessibility-journeys-browser.json
  ```

  The report covers 17 Buyer routes at 320×640, 390×844, 640×320 and 1440×900;
  it reports zero accessibility/layout failures. The sweep checks semantic
  names, visible controls at least 48px in both dimensions, resizing without
  extra API requests, keyboard focus, and browser Back/Stay/Leave with draft
  retention. The combined browser run also completes synthetic
  Search/Add-to-Cart/selected-Cart/quote/cancelled-placement/sign-out flows.

## Remaining acceptance gates

`adb devices` returned an empty device list. No installed Android run or
TalkBack session was available; real orientation, split-screen, keyboard and
system-Back acceptance on Android remains open. The browser run used headless
Chromium and synthetic identity/data, not a screen reader or a live development
API. Verify the same journeys with a controlled account and assistive
technology before closing the broad device/API acceptance criterion.

No Laravel/API behavior, dependency pins, or backend contracts changed. No new
integration gap was identified.
