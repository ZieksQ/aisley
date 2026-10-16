# G26 private media consumption — 2026-10-12

Implemented receive-only MP4 playback and document download in the external Buyer and Courier Flutter apps, against Laravel `28fc740` and the inclusive 8,000,000-byte new-image/video contract. Mobile selection/send remains image-only. The API, schema, authorization and media enablement configuration are unchanged.

The apps validate role-relative attachment identity, ready state, permitted filename/format/MIME and historical retrieval bounds. Streaming enforces response MIME, metadata length and byte limits before export/playback; Buyer guards the adapter before Dio can buffer. Players receive private temporary files on Android or revocable blob URLs on web. Android document export uses a two-phase Storage Access Framework picker; no bytes reach native storage until a current destination is chosen. Explicit downloaded documents are user-owned copies. Private buffers, players, previews and temporary handles clear on close, controller/identity replacement or access loss.

The approved plugin evaluation led to `video_player` 2.11.1, `path_provider` 2.1.6 and `web` 1.1.1. `file_saver` was excluded after inspecting its unreleased web blobs and byte-bearing Android picker; focused native/browser export adapters implement the required lifecycle without broad storage permissions. New images accept 8,000,000 bytes exactly; permanent upload 422 requires removal/replacement. Historical committed images below 10 MiB and videos up to 30 MiB remain readable without granting new binding permission.

## Verification

- Laravel `ChatMediaTest`: 11 tests / 276 assertions passed with isolated SQLite and fake private storage/scanner. Existing coverage includes decimal size boundaries, committed replay, role/participant isolation, scanner/processing failure, cleanup and video ranges.
- Laravel `ChatMediaInspectionTest`: 5 tests / 35 assertions passed, including actual media inspection fixtures. These are source tests, not deployed scanner/storage acceptance.
- Courier full suite passed 916 tests before the final viewer extraction/export tests. Final focused run passed 80 tests after those changes, including the 25 retained B07 identity/pagination cases and 55 media regressions.
- Buyer final full suite passed 681 tests with 42 live opt-in skips at concurrency two. Its first loaded run encountered a Dio internal receive-timeout initialization race in an unrelated notification test; the isolated notification file passed 24 tests and the final full run passed without source changes to that workflow.
- Both final Flutter analyzers report no issues. Production web builds passed for both apps. Final Android release builds passed with unchanged Gradle settings and a temporary 2 GiB heap: Courier APK 109,518,953 bytes; Buyer APK 95,279,900 bytes. The initially parallel builds competed for memory; Courier was stopped and rerun, while Buyer finished before the final serial verification.
- Final actual-browser checks passed 15 Courier / 11 Buyer journeys in the production app themes: four widths, supported themes, doubled text, poster/viewer, no autoplay, Play/Pause, seeking controls, keyboard/Escape disposal, document download, chunked oversize rejection, redirect denial and scope cleanup plus scrollable playback controls in a 390×400 dialog. Screenshots were inspected. Downloaded synthetic PDF bytes matched exactly. A missed synthetic tap during parallel browser pages was rechecked with Buyer alone; the final matrix passed. All media calls used synthetic authenticated local endpoints; redirect traps and unauthenticated calls remained zero. Flutter fetched public CanvasKit/Roboto CDN assets; no external media/API request occurred.

The repeatable tools live in each Flutter repository under `test/manual/private_media_browser_fixture.dart`, `check_private_media_browser.mjs` and `private_media_server.py`. Representative screenshots and machine-readable results are build artifacts, not committed private media.

## Reproduction

Run from the relevant Flutter repository. Generate a two-second H.264 fixture and JPEG poster in `build/g26-media` using FFmpeg's `color` input. Set `G26_VIDEO_BYTES` to the generated MP4 size. Build the fixture with `flutter build web --no-pub --target=test/manual/private_media_browser_fixture.dart --dart-define=VIDEO_BYTES="$G26_VIDEO_BYTES" --output=build/g26-browser`. Serve it through `python3 test/manual/private_media_server.py --root build/g26-browser --port 8765 --role courier`, or port 8766 / role customer for Buyer. Start local Chromium with CDP port 9348, then run the checker with `FIXTURE_ORIGIN`, `MEDIA_ARTIFACTS` and Buyer `MEDIA_BUYER=1`.

Run `flutter test --no-pub --concurrency=2` and `flutter analyze --no-pub`. Scoped regressions are `test/core/private_media_test.dart`, `private_media_transport_test.dart` and `private_document_export_test.dart`; Courier additionally retains its actual-thread B07 tests. Standard web/APK release builds validate integration. When local parallel Gradle heaps contend, the checked alternative is `./gradlew --no-daemon --max-workers=2 -Dorg.gradle.jvmargs=-Xmx2g :app:assembleRelease --offline` from `android/`; this does not change repository Gradle settings.

## Remaining release gates

Source completion does not certify private Azure/local runtime storage, worker/scanner readiness/signatures, deployed cross-role exchanges, or installed Android Save As/playback/lifecycle/TalkBack acceptance. No real accounts, provider calls, production media, migrations, seeds or deployment operations ran. Historical video/document upload capabilities in Laravel/web remain separate from this receive-only mobile release. Preserve these gates and other unrelated adoption statuses until their owning evidence exists.

At the original G26 handoff, Buyer and Courier changes were staged without commits for user review. Only the main repository's canonical/portable documentation and app-wide progress followed its automatic commit rule. The B08 follow-up below records the later committed client revisions.

## B08 verification — 2026-10-12

Audit B08 is resolved in the current local source: the later G26 implementation already aligned both mobile clients and their copied contracts with the inclusive 8,000,000-byte new-image limit. This follow-up reran the existing owning-application regressions; no application code, API, schema, dependency or client contract change was needed.

| Source snapshot | Revision | Fresh result |
| --- | --- | --- |
| Laravel / canonical and portable contracts | `4da8c41b95fbd115da54205474dc16201145e2ae` | `ChatMediaTest`: 11 tests, 276 assertions, exit 0 |
| Courier Flutter | `177eac1d1d132916cef25054cfc959e223fa409c` | Six selected test files: 78 tests passed, exit 0 |
| Buyer Flutter | `7924cf06158817a2dcd709ec19a7442e3496dda5` | Four selected test files: 36 tests passed, exit 0 |

### Cases verified now

- Both clients dispatch selections of 7,999,999 and 8,000,000 bytes and reject 8,000,001 bytes before upload. Their draft validation, picker bounds and composer copy use the decimal limit. These boundary tests use synthetic byte buffers and fake pickers/upload repositories, not actual gallery files or server decoding.
- Permanent upload HTTP 422 marks the draft rejected, blocks Send and suppresses explicit retry/reupload of the unchanged bytes. Explicit removal restores readiness. Separate transport and thread tests verify accepted image uploads and image-only sends, including frozen IDs/context/key through lost responses. Buyer exercises Shop, Logistics and Courier channels.
- Client historical-read validation accepts already-committed images above the new limit within the former strict 10 MiB bound. Laravel exercises image/video upload and rewritten-byte boundaries, rejects an oversized unbound legacy attachment, and permits authorized retrieval and exact replay after the committed attachment is marked above the new limit. Scanner/inspection and storage are synthetic; this does not certify deployed historical objects.
- Courier's 25 existing B07 image-identity and actual-thread pagination regressions also passed. Both selected suites include narrow/doubled-text composer or media-control states and private scope cleanup; no new browser or installed-device check ran.
- The canonical, portable and external media-contract copies agree on the inclusive boundary, unchanged five-file/50 MiB aggregate limits, document limits and committed historical compatibility. Both external working trees were clean before and after testing.

### Isolation and reproduction

All commands were launched from the AISLEY repository. Unchanged `lib`, `test`, assets and required Buyer example fixtures were copied into ignored `build/b08-verification/` projects. Package configuration rebased each project's own root to its copy and resolved existing dependency roots; installed packages were reused with `--no-pub`. Tests used Flutter's installed Dart/tool snapshot with `--no-version-check --suppress-analytics test --no-pub --concurrency=2 --reporter expanded`.

Courier selected `test/core/{private_media,chat_media,chat_media_transport,chat_image_identity}_test.dart` plus `test/features/chat/{chat_image_pagination,chat_controller}_test.dart`. Buyer selected the first three core files plus `test/features/chat_images_test.dart`.

Laravel ran from a separate copied application, with installed Composer dependencies copied locally and no environment files or existing bootstrap cache. The successful root command was:

```sh
php build/b08-verification/api/vendor/phpunit/phpunit/phpunit -c build/b08-verification/api/phpunit.xml --do-not-cache-result build/b08-verification/api/tests/Feature/Messaging/ChatMediaTest.php
```

Each test command ran inside `bwrap` with the original filesystem read-only, only the scratch directory writable, a disposable `/tmp`, and an isolated network namespace. Laravel used in-memory SQLite, array cache/session/mail, and fake private storage/queue/scanner. Local test sockets required sandbox escalation. An initial namespace setup failure and two Composer-mount attempts failed before tests loaded and supplied no application verdict; the copied-dependency run above passed. Flutter emitted read-only SDK-stamp warnings; the mount prevented SDK/cache writes and the namespace prevented external downloads.

Raw outputs and source-revision/hash metadata remain ignored local build artifacts under `build/b08-verification/`. The external audit report is preserved. This establishes current-source regression evidence for B08; actual client/API release combinations, deployed storage/worker/scanner readiness, live cross-role exchange and installed Android/TalkBack acceptance remain open. Previous full-suite, analyzer, build and browser results above were not rerun or reclassified.


## Audit G26 real runtime and emulator acceptance — 2026-10-15

[Three-project verification](../../../docs-mobile-buyer/references/private-media-runtime-verification.md) records 16 real private local-storage/worker/FFmpeg/ClamAV/relationship checks, both Flutter clients' real Chromium and installed API 35 emulator flows, focused regressions and standard builds. The new opt-in harness lives under `src/api/tests/Support/private-media-runtime/`; source environment/storage/database/cache files are excluded and fixture credentials are revoked on normal shutdown. Isolated local media acceptance is verified; deployed/Azure/release pairs, physical devices/providers/TalkBack, full-app identity and signing remain open. Existing production application/API/schema/dependency behavior is unchanged.
