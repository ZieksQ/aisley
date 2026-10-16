# Audit G26 local runtime and Android acceptance — 2026-10-15

Audit G26 is private chat media, tracked as Buyer G27; Buyer voucher G26 is a
separate finding. This work verifies the existing media implementation against a
real isolated Laravel runtime, Chromium, and installed Android test APKs. No
production application code, API, schema, dependency or media limit changed.

## Verified scope

| Layer | Fresh result |
| --- | --- |
| Laravel runtime | 16 checks across seven conversation contexts, real private local storage, queued processing, FFmpeg/ffprobe and ClamAV |
| Laravel regression suites | 17 tests / 314 assertions; includes the live ClamAV test |
| Harness isolation | Six tests; secret/storage/database/cache exclusion, source-tree refusal and credentialed redirect denial |
| Buyer Flutter | 64 focused media, transport, export and channel tests; analyzer clean |
| Courier Flutter | 106 focused media, transport, export and actual-thread identity/pagination tests; analyzer clean |
| Chromium | Eight checks per app: four widths, real image send/replay, MP4 controls, byte-matched PDF download, actual logout/cleanup |
| Installed Android | Six checks per app: image send/replay, playback/lifecycle/temporary cleanup, Save As cancel, unavailable-picker recovery, exact PDF export and actual logout |
| Builds | Standard web and release APK builds pass for both apps; test web and debug APK builds also pass |

All runtime relationships passed: Customer–Shop, Customer–Logistics,
Seller–Logistics, first-/final-mile Logistics–Courier, Customer–Courier and
Seller–Courier. Uploads remained pending until the dedicated worker processed
them. Checked ordered binding/history, exact upload/message replay, changed-intent
conflicts, role/participant denial, MP4 poster/ranges and byte-identical video/PDF
delivery. Real antivirus test content was rejected and could not bind to a message.
Scanner outage disabled uploads and exhausted the real bounded job attempts;
restoration plus explicit retry recovered. Worker pause/restart retained pending
work. Disabled uploads preserved text and committed reads; expired unbound bytes
were cleaned up. Ended-task and ended-custody history remained available only to
original participants. Replacement Couriers/organizations did not inherit media.

Browser media requests went directly to Laravel, with no synthetic API interception
or proxy. Each app recorded 19 authorized API requests and 19 credential-free CORS
preflights; unauthenticated private requests and off-origin bearer leakage were zero.
The player did not autoplay; Play/Pause, keyboard seeking and Escape disposal passed.
Downloads matched the generated PDF exactly. Logout revoked the actual bearer and
removed private cards/players. The checker allows transient accessibility live-region
announcements to settle and uses a fresh download directory for every run.

Android verified the production native player, private temporary file, Back/close
cleanup, pausing active playback on background and the system document picker. Cancelling Save As
wrote no document. Temporarily disabling DocumentsUI in the disposable emulator
produced recoverable picker failure; restoring it allowed one exact export. This
does not simulate provider failure during a write. Logout produced HTTP 401 for the
revoked bearer, removed private playback state, and preserved the explicit saved
copy. Screen labels/bounds were exercised through Android accessibility nodes;
this is not a TalkBack acceptance claim.

## Source and environment

Production-source snapshots: Laravel `e6dc2cb4a7322dc3c5be649f467460c7e1114328`,
Buyer `dddaafa4eda56a32cd818fafffcf072f10b76ea6`, and Courier
`d36b11c90b5c92b407a26fd250ff6d252a97ec5f`. Test-only fixtures/scripts are added by
this change; production sources remain at those snapshots. Media adoption remains
the historical `28fc740` contract; this test does not adopt unrelated newer APIs.

The API used a fresh copied application and disposable SQLite/private filesystem,
with WAL/IMMEDIATE transactions and a 30-second busy timeout only in that copy.
Source environment files, existing storage/databases and compiled configuration
were excluded. Child processes received synthetic configuration. Fixture setup
transitions bypassed fulfillment effects; no delivery/accounting workflow was tested.
The custody supplement was run against the retained runtime and added to its report.

Runtime tools: Flutter `3.47.2` / Dart `3.13.2`, Chromium `154.0.8037.97`,
FFmpeg/ffprobe `n9.0.2`; ClamAV `1.5.4`, signatures `28153` dated
2026-10-14. Real clean/infected scanner checks passed. Android was API 35, default
x86_64 image revision 2, emulator `37.2.12`, KVM/software graphics, serial
`emulator-5580`. Its SDK/image/AVD were created under ignored build directories;
the installed host SDK was unchanged. Standard release builds retained existing
signing configuration; the existing SDK XML warning remains.

Installed test APK SHA-256 values:

- Buyer: `238d2609069d12cfc38da4c2348b355853ba3c2e054d49d9e1fe4bcf404fd633`
- Courier: `1d5ea397d505ffb7d5761c136e81c3da8d8818ec59596e890921feb89400a7c6`

## Reproduction and evidence

The backend-owned harness is `src/api/tests/Support/private-media-runtime/` in
AISLEY. Its README documents scanner startup, guards, fresh runtime creation,
session renewal and cleanup. Run its six guard tests and start `runtime.py` with
`--api-source src/api --workspace build/g26-runtime --serve` from AISLEY.

In either Flutter project, set `G26_RUNTIME` to the generated absolute `run-*`
directory and `G26_ROLE`/`G26_PORT` to `customer`/`8766` or `courier`/`8765`.

```sh
flutter build web --no-pub --target=test/manual/private_media_runtime_fixture.dart --output=build/g26-runtime-web
python3 test/manual/private_media_runtime_server.py --root build/g26-runtime-web --runtime "$G26_RUNTIME" --role "$G26_ROLE"
FIXTURE_ORIGIN="http://localhost:$G26_PORT" MEDIA_ARTIFACTS=build/verification/g26-runtime/browser MEDIA_EXPECTED_DOCUMENT="$G26_RUNTIME/api/storage/framework/testing/chat-browser/details.pdf" node test/manual/check_private_media_runtime.mjs
flutter build apk --debug --no-pub --target=test/manual/private_media_runtime_fixture.dart --dart-define="MEDIA_SESSION_URL=http://10.0.2.2:$G26_PORT/fixture-session"
python3 test/manual/check_private_media_android.py --serial emulator-5580 --role "$G26_ROLE" --runtime "$G26_RUNTIME" --apk build/app/outputs/flutter-apk/app-debug.apk --output build/verification/g26-runtime/android
```

Start isolated Chromium CDP on port 9348 before its checker. Install/start the test
APK on the specified disposable emulator before the Android checker, which restarts
its selected test app. Keep fixture servers running in separate terminals. Renew test
sessions through the backend CLI after each successful logout; do not run browser
and Android logout matrices concurrently for the same role. The fixture uses
memory-only bootstrap credentials and production repositories/widgets/adapters.
It does not verify full application navigation, secure-storage login or account switch.

Ignored evidence is under each app's `build/verification/g26-runtime/` plus
`build/g26-*.log`. The final real runtime is Buyer
`build/g26-runtime/run-drv94kct/results.json`; generated media hashes are recorded
there. Browser/Android reports and synthetic screenshots are beside their checkers'
outputs. Earlier failed harness runs are superseded, not application failures.
Temporary bootstrap credentials and private bytes must never be committed. Stop
the owning runtime to revoke generated tokens/remove bootstrap files, then stop
the fixture hosts, browser, emulator and task-owned scanner.

Regression commands were `flutter analyze --no-pub` and `flutter test --no-pub
--concurrency=2` with the five `test/core/{chat_media,chat_media_transport,private_media,
private_media_transport,private_document_export}_test.dart` files. Buyer additionally
ran `test/features/chat_images_test.dart`; Courier additionally ran
`test/core/chat_image_identity_test.dart` and
`test/features/chat/{chat_image_pagination,chat_controller}_test.dart`.
Standard builds used `flutter build web --no-pub` and `flutter build apk --release
--no-pub`, public `.invalid` API/storefront defines, and a bounded 2 GiB Gradle heap.
Laravel ran `env -i PATH=/usr/bin:/bin CHAT_MEDIA_LIVE_SCANNER=1 php vendor/bin/phpunit
--do-not-cache-result tests/Feature/Messaging/ChatMediaTest.php
tests/Unit/ChatMediaInspectionTest.php tests/Feature/Messaging/LiveChatMediaScannerTest.php`
inside the disposable copy; its regression DB was in-memory SQLite. The runtime
matrix used the separate persistent disposable database. Scoped Dart formatting,
PHP Pint, Buyer bundle validation (1024 links/22 specs/19 PSGC checks), four bundle
regressions, copy/history checks and Git whitespace checks pass.

Shutdown was verified: the generated bearer count was zero and credential bootstrap
files were removed. The API/worker, fixture hosts, isolated browser, emulator and
task-owned scanner were stopped. Generated bytes, build outputs and reports remain
ignored for review.

## Remaining gates

This closes the isolated local runtime/browser/emulator slice of audit G26.
Deployed API/client pairs, private Azure storage, production worker/scanner health
and signature maintenance, production CORS/configuration and signing, physical
Android codecs/providers, actual TalkBack, full-app login/account switching and
in-flight provider write failure remain unverified. Mobile video/document uploads
remain outside this receive-only release. Historical [media verification](private-media-verification.md)
keeps its original scope; no broad release gate is marked complete from this run.
