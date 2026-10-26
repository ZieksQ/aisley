# Platform contract adoption — Buyer, 2026-10-26

Platform source: `1858785e9b5954f71a9be1d5fe7c411bbdc1fa4a`. Flutter parent: `1fd310a5e802719bb1b4a5ac87ad860ecbf819cb`. Implementation branch: `feature/platform-contract-sync`.

## Adopted behavior

- New chat image selections accept JPEG/PNG only, at most 8,000,000 bytes inclusive, 4,096 pixels per edge and 8,000,000 pixels. Header checks happen before upload. Historical committed WebP/documents, received MP4/documents and unchanged committed-send replay remain available; video/document uploads remain outside the mobile composer.
- New provider choices and placement require complete local/planned shipping routes and a serviceable quote. Incomplete-route quotes show recovery guidance. Historical unplanned quote/Batch/Order data remains readable. Definitive QUOTE_STALE requires refreshed reviewed intent; uncertain placement preserves the exact original payload/key.
- Buyer consumes authoritative direct assigned-to-delivered Order projections and supplied payment/review permissions without fabricating pickup/transit history. Courier proof/intent submission does not mutate the Buyer Order. Existing server-returned conversation permissions retain their authority.
- Selective contract merges preserve the newer marketplace overhaul, image-only Home campaign nullability, combined Messages/header search, per-channel cursors, configuration, design and implementation evidence.

## Verification

- `flutter analyze --no-pub`: no issues. All 97 focused media/shipping/recovery/direct-delivery checks pass. The bounded full-suite run passes 945 tests with 42 intentional opt-in/platform skips, explicitly excluding only the six inherited inbox cases documented below. The ordinary default suite still includes those six failures.
- `flutter build web --no-pub` and `flutter build apk --release --no-pub` pass for final application source using isolated synthetic public configuration and unchanged locked dependencies. SDK XML/deprecation warnings remain.
- Chromium passes the existing combined-Messages regression at 320/390/600/800/1024/1440px plus foreground unread updates, channel filters/thread entry and partial-failure retry. All API responses are synthetic/intercepted; reviewed the phone inbox capture. Evidence is in `build/platform-sync/build/verification/messages/`.
- Buyer bundle validation and its four negative regression tests, affected specification lengths/local links, changed Dart formatting, and Git whitespace pass. Concurrent runs hit the existing 200 ms synthetic API deadlines; the final bounded run passes without source or timeout changes.

 Evidence stays in ignored `build/sync-*.log`; builds use isolated `build/platform-sync/` source copies and synthetic public configuration. Original environment files, signing keys and credentials are excluded. Verification artifacts are not configured deployment releases.

Representative commands (build commands run inside the isolated synthetic-config copy):

```sh
flutter analyze --no-pub
flutter test --no-pub --no-test-assets --concurrency=2 --name '^(?!(?:shop|logistics|courier) refresh supersedes delayed append (?:success|failure)$).*'
flutter build web --no-pub
flutter build apk --release --no-pub
python3 tool/verify_bundle.py
python3 -m unittest discover -s tool -p 'verify_bundle_test.py'
```

## Inherited test failures

The six `list_recovery_test.dart` cases named Shop/Logistics/Courier “refresh supersedes delayed append” (success/failure) fail identically on the untouched parent commit. An isolated pre-task source run produces 10 passes and these same six failures; evidence is `build/sync-baseline-tests.log`. Inbox controller/test behavior was preserved because it is outside this sync. The obsolete shipping expectations are updated under this task.

## Remaining acceptance

No Android device/emulator was attached. Controlled deployed API/provider/media exchange, installed Android/GPS/TalkBack and production signing remain unverified. No backend schema/deployment/environment/dependency changes are included. Prior live/device evidence and historical archives retain their original scope.
