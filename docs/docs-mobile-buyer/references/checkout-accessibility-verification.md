# Checkout address accessibility — 2026-10-09

Branch: `fix/checkout-address-accessibility`, starting at `25f88e5`.
Adopted Laravel baseline remains `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`.
Shipping/media adoption G25/G26 and live/device acceptance remain open.

## Reproduction before presentation changes

- The initial checkout accessibility run stopped at `canPlace` in all eight layouts.
  The recently synced quote example has the current shipping projection; the
  implemented parser still requires the adopted shipping fields (G25).
- Isolated accessibility tests with a synthetic op-029 snapshot from `3e0685f`,
  matching the adopted contract. Shared examples, harness and production parsers
  remain unchanged; this fixture does not certify current shipping adoption.
- `flutter test --no-pub test/features/phase_5_accessibility_test.dart --plain-name 'checkout accessibility'`:
  seven passed; 1440×900 at scale 1 failed with address semantics 824×36px,
  reproducing the [historical report](maplibre-verification.md).
- Inspection found a 120px full tile, partially scrolled behind the 56px app bar:
  `ensureVisible` had aligned an already-visible placement action to the viewport
  top. The 36px report measures the clipped semantics, not the full tile height.
- The new desktop target regression also fails against unchanged presentation in
  an isolated HEAD archive: the radio control measures 40×40px instead of 48×48px.

## Changes and coverage

Address radios explicitly use padded targets, standard density and a minimum
48px tile height. Native merged labels retain the title or recipient fallback,
address details, checked/enabled states and keyboard radio-group behavior.
Tests reveal controls before measuring; action checks keep already-visible
controls in place instead of introducing a clipped viewport fragment.

Below 500px of available height, checkout actions join the page scroll instead
of a restricted bottom bar. This resolves the keyboard-open landscape failure
and doubled-text action clipping found by the new tests. Existing selection,
quote invalidation, placement guards and action-state ownership are retained.

Five added scenarios cover two addresses, long text, null-label fallback,
48px control/semantics bounds, Tab/Shift-Tab, arrow selection, focus retention,
disabled selection during quoting, keyboard opening/closing and fully visible
review/placement controls. Selection invalidates the quote; resizing preserves
it; reviewing never places an order. The existing eight-layout matrix remains.

## Checks and limits

- `flutter test --no-pub test/features/phase_5_accessibility_test.dart test/features/checkout_mount_test.dart`:
  **38 passed** (37 accessibility cases plus one mount case).
- The broader run including `test/features/phase_3_cart_checkout_test.dart`
  exposed ten shipping-fixture failures. An unchanged `25f88e5` archive reproduces
  the same ten failures (five pass, nine assertion failures, one null-quote error).
  These precede the presentation changes and remain under G25; shared fixtures
  were deliberately not converted into legacy API authority.
- `flutter analyze --no-pub`: passed, no issues.
- `dart format --output=none --set-exit-if-changed lib test`: 210 files, no changes.
- `python3 tool/verify_bundle.py` and `git diff --check`: passed.

The reproduced accessibility case now passes with controls checked in their
visible viewport. These are synthetic widget checks; no live API/provider calls,
web/APK builds or installed Android/TalkBack/visual browser-focus acceptance ran.
No backend, dependencies, credentials or wire contracts changed.
