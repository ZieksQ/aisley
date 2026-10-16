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

Buyer and Courier changes are staged without commits for user review. Only the main repository's canonical/portable documentation and app-wide progress follow its automatic commit rule.


## Audit G26 local runtime and emulator acceptance — 2026-10-15

[Fresh real-runtime and Android evidence](private-media-runtime-verification.md) records 16 real storage/worker/scanner/relationship checks, both clients' connected Chromium and installed API 35 emulator journeys, focused regressions and standard web/release builds. The isolated local slice is verified; deployed Azure/release pairs, physical devices, full-app login/account switching and actual TalkBack remain open. Earlier results above retain their original scope.
