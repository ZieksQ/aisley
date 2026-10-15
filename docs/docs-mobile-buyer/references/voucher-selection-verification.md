# B09 Buyer voucher selection and names — 2026-10-15

Audit B09/F07 (Buyer-local G26 vouchers) is resolved in local source. This is distinct from audit G26 private media. No deployed or installed-device resolution is claimed.

## Contract and implementation

- Inspected Laravel `/api/v1` at AISLEY `40cf7d43120319f5a74017de436972121a1af1eb`: `CheckoutService::applyVouchers` already enforces one App voucher per benefit per batch and one voucher per benefit per Shop. Quote projections and `CheckoutBatchResource` already expose names. No API/schema/dependency change was needed.
- Buyer implementation branch: `feature/b09-buyer-voucher-selection`, based on `1d91863dae7304611640d7e40ec6a5da0a769927`. Earlier general/shipping/collection adoption records stay separate; this does not adopt unrelated later shipping/Order/messaging contracts.
- A focused selection helper reads current quote applied/candidate metadata. Selecting replaces the same UUID, same-benefit choices in the target Shop, and (for App selections) same-benefit App choices throughout the batch. Opposite benefits and unrelated Shop selections retain their explicit targets. Deselection removes only the matching UUID/target pair. Existing eligibility/current-quote and max-20 guards remain.
- Changes invalidate quote and require deliberate authoritative requote/review. Pending uncertain placement is never rewritten; retries keep the same frozen UUID key, quote ID, voucher IDs/targets and payload.
- Applied and Checkout Batch models retain server names with historical missing/null code fallback; malformed name types fail decoding. Review/results display name, secondary code, benefit and exact savings. Batch refresh uses the committed snapshot rather than current voucher definitions. Customer Order detail/history keeps its existing code/terms/currency contract.

## Checks actually run

- Before the fix, regression tests reproduced retained App/App and App/Shop same-benefit conflicts, same-Shop conflicts and cross-target deselection. After the fix, **35 new tests pass**, comprising 15 selection/recovery tests, five name/compatibility tests and 15 responsive/interaction widget tests.
- **197 focused tests pass** across the new suites and existing Cart/Checkout, shipping, quote/placement recovery, mount, thumbnails and voucher contract/state/widget suites. They use invented DTOs, fake transport, clock, session and UUID factory; they do not execute Laravel redemption.
- Coverage includes both benefit types, simultaneous batch/target-Shop replacement, same-Shop App/Shop replacement in either direction, Shop/Shop replacement, unaffected Shop choices, explicit App retargeting, exact-pair deselection, applied metadata without a candidate entry, stale/ineligible/unknown candidates, failed/repeated quote refresh, identity cleanup and exact uncertain-placement replay.
- Widget checks cover quote/Batch summaries at widths 320/390/600/800/1024/1440 and 800×390 landscape; 320px/landscape use doubled text and long names. Actual CheckboxListTile taps clear the old selection only after reviewed refresh. Batch names survive current-definition changes and GET refresh.
- `flutter analyze --no-pub` passes with no issues. Changed Dart files pass `dart format --output=none --set-exit-if-changed`. The browser harness passes Python syntax checks; both repository whitespace checks pass.
- `flutter build web --no-pub --dart-define=API_BASE_URL=https://api.example.invalid --dart-define=STOREFRONT_ORIGIN=https://shop.example.invalid` passes. Public placeholder origins are compilation inputs; no synthetic credential/API request reaches them.
- `python3 tool/browser_vouchers.py` against the built app at localhost:8766 passes **32 layouts / 11 synthetic journeys**, including existing collection/login-return/wallet/retry/public-credential checks plus B09 Shop/App and App/App replacement, opposite pairing with empty legacy stacking flags, deselection and explicit IDs/targets. All API paths are intercepted before app startup; no real placement runs. B09 screenshots at 320/390/768/1440 are under ignored `build/verification/vouchers/`; 320px and 1440px captures were visually reviewed.
- `flutter build apk --release --no-pub` with the same public placeholder origins passes (94.8 MB). Existing SDK XML tooling warning remains; this is compilation evidence, not an installed-device or signing approval.

Reproduce the focused suite with:

```sh
flutter test --no-pub test/features/checkout_voucher_selection_test.dart test/features/checkout_voucher_names_test.dart test/features/phase_3_cart_checkout_test.dart test/features/shipping_checkout_test.dart test/features/checkout_recovery_test.dart test/features/checkout_recovery_widgets_test.dart test/features/checkout_images_test.dart test/features/checkout_mount_test.dart test/features/voucher_contract_test.dart test/features/voucher_state_test.dart test/features/voucher_widgets_test.dart
```

The focused output is retained locally at ignored `build/b09-tests.log`; Chromium writes `build/verification/vouchers/report.json`. The Buyer bundle validator passes local links, all 22 Customer specs, 19 PSGC checksums/registrations and Android boundaries. The portable feature specs preserve their required 200–230 lines. B09 adoption sections are synchronized without replacing AISLEY's newer complete-route shipping addendum with the older Buyer copy.

## Remaining acceptance

Funding-specific client verification, controlled real-account voucher redemption/capacity/concurrency, deployed API/schema/provider revision and installed Android/TalkBack remain open. In-session exact replay tests do not prove server atomicity or process-restart recovery; G12 stays memory-only. Existing G21 Order pins, Shop-context adoption and unrelated audit findings remain open. No production deployment, database, migration, provider, SMTP or live-account mutation was performed. The original audit and dated historical evidence remain unchanged.
