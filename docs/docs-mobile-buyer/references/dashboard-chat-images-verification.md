# Dashboard and chat image verification — 2026-10-11

Scope: the unchanged-gap audit row for Courier dashboard and external Buyer/Courier chat media. Adoption is images only, using existing Flutter dependencies. Video/document clients remain open (Buyer project G26; portable Buyer G27). No schema or package changes.

## Implemented behavior

- Courier `GET /api/v1/courier/dashboard?version=2` supplies bounded notification, available-task and active-task sections. Default/explicit v1 retains the legacy scaffold. Courier cards distinguish empty, failed and permitted stale sections; final-mile offers open batch acceptance. Owning workflows refetch before mutations.
- Courier Logistics/Seller/Buyer and Buyer Shop/Logistics/Courier messages accept ready image IDs with optional captions. Upload timeout retries preserve bytes/context/key; uncertain message retries preserve caption/context/ordered IDs/key. Explicit Send waits for every selected image. Processing polls are bounded and stop in background.
- Authenticated previews and an explicit image viewer accept only the matching role's API-relative private media URLs, reject redirects, and evict private image providers on scope loss/disposal. Confirmation clears selected uploads while preserving authorized history. Buyer consent review drops image buffers but retains frozen pending IDs for reconciliation. There is no persistent media cache or offline send queue.

## Local checks

- Full Flutter suites passed: Courier 839; Buyer 606 with 42 live opt-in cases skipped. Final web and Android release builds passed for both projects (Courier APK 107.4 MB; Buyer 92.9 MB). Buyer was rerun with two workers to avoid short-deadline synthetic transport failures during simultaneous build load. An additional all-channel logout regression confirms private viewer notifications happen before disposal.

- Laravel: 42 focused dashboard, notification and three messaging/media suites passed, 737 assertions, using explicit isolated in-memory SQLite. V2 tests cover bounds/order, assigned/accepted states, other Couriers and organizations, custody changes, role/affiliation gates, selector rejection, safe partial query failure, privacy and repeated read-only snapshots. Existing v1 and attachment suites remain passing.
- Courier final dashboard/media regressions: 18 passed, including strict timestamps/reasons/duplicates, partial stale retention, legacy fallback, private image lifecycle and a real 320px viewport at doubled text. Transport tests exercise actual multipart and private-read adapters with synthetic bearer credentials, no redirects and obsolete-denial protection.
- Buyer final image/transport regressions: 13 passed, including all three channels' image-only response loss, exact frozen retries after consent review, selected-file limits, pending processing and private image cleanup. Existing communication accessibility suite: 37 passed after scrolling the message detail into view before focusing its lazy form.
- Chromium: Courier 26 checks and Buyer 13 checks passed at 320/390/768/1440px; Courier both themes, Buyer light-only; doubled text at 320px, selected image, private-widget viewer, unavailable uploads, uncertain upload, processing, offline placeholder and three channel-labelled uncertain-send controls. Courier checks include the actual DashboardScreen with a synthetic repository. Representative narrow, large-text, viewer and dashboard screenshots were inspected. Fixture pages made zero external HTTP requests; no runtime exceptions were recorded.
- Browser media controls are a synthetic harness around production media widgets, not end-to-end production chat screens or real transport. Production channel controllers and transport are checked independently by Dart tests. The PNG and all accounts, DTOs, IDs and credentials are synthetic.
- Dashboard contract/example copies match across canonical, portable and Courier documentation. Six affected Courier specs stay within 200–230 lines. Buyer bundle, JSON, local links, formatting, analyzer, PHP syntax/Pint and whitespace checks are verified separately before staging.

## Reproduction and artifacts

In each Flutter project, `test/manual/chat_images_browser_fixture.dart` compiles the synthetic fixture. Build with `flutter build web --release --no-pub --no-web-resources-cdn --no-wasm-dry-run --output build/chat-images-browser -t test/manual/chat_images_browser_fixture.dart`. Serve that directory locally; run `node test/manual/check_chat_images_browser.mjs` against an isolated Chromium CDP instance. Set FIXTURE_ORIGIN/CDP_ORIGIN as needed and MEDIA_BUYER=1 in Buyer. Screenshots and results live under `build/chat-images-evidence/`; build/test logs and binaries are ignored build artifacts.

## Acceptance limits

No live account/API/database/media worker, production provider, deployment, PostgreSQL concurrency or installed-device/TalkBack checks ran. Deploy dashboard v2 before its client; its v1 fallback is retained. Image uploads remain gated by the existing server capabilities/runtime readiness. Android release compilation does not establish installed-device selection, camera behavior, signing or store acceptance. Pending state is memory-only and lost on restart; inspect refreshed server history before repeating an uncertain operation.

Only aisley is committed. aisley_app and aisley_mobile_buyer implementation, tests and affected docs remain staged without commits as requested. Backend baseline is 61f302c plus feature/courier-dashboard-chat-images; v2 is the dashboard contract version. Flutter feature branches contain local adoption evidence, not a deployed baseline.
