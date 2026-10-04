# Fresh Customer Flutter project setup

> Implementation, SDK/package resolution, tests, builds and browser results in this guide are reports from the external Buyer Flutter project and were not rerun here. This bundle contains documentation; `lib/`, tests, tools, lockfiles and build reports belong to that project. Current shipping-contract adoption remains [G25](references/integration-gaps.md).

## Phase 5 local readiness

Run `python3 tool/verify_release.py` for locked dependencies, formatting, analysis,
unit/widget/Chromium/tooling checks, portable documentation/assets/Android validation
and placeholder web/release APK builds. Use `--live --browser` only with the authorized
API and an already running Buyer at localhost:8766. Missing requested prerequisites
are reported as blocked with a nonzero exit. Focused reruns use `--checks`.
See [Phase 5 evidence and acceptance runbook](references/phase-5-verification.md)
for report format, commands, signing limitations and remaining owner/device gates.

## Current Phases 1–4 local development

The ten approved package pins support implemented auth, discovery/account, commerce and communication.
Maps/uploads/PSGC/preferences are implemented; no dependency was added for Phases 3–4. Preserve
historical SDK/package checks; current results are in [Phase 4 evidence](references/phase-4-verification.md).

The authorized API is `http://localhost:8000/api/v1`. Buyer browser testing stays at
`http://localhost:8766`; the documented recovery storefront default is `http://localhost:3000`.
Debug builds default to these origins. Android uses the emulator host alias `10.0.2.2`
on ports 8000/3000. Only localhost, 127.0.0.1 and 10.0.2.2 may use debug HTTP;
release configuration requires explicit HTTPS origins. Do not substitute a phone's own
localhost for the development computer; installed-device connectivity remains unverified.

`API_BASE_URL` accepts either an origin such as `http://127.0.0.1:8000` or the full
`http://127.0.0.1:8000/api/v1` base. The app normalizes both to `/api/v1`, including
an optional trailing slash. Open Buyer at `http://localhost:8766` for its CORS origin.

```sh
flutter pub get --enforce-lockfile
flutter run -d web-server --web-port 8766 --dart-define=API_BASE_URL=http://127.0.0.1:8000
flutter build apk --debug
flutter test
BUYER_LIVE_API=1 flutter test test/live/public_api_test.dart
CHROME_EXECUTABLE=/usr/bin/chromium flutter test --platform chrome test/web
python3 tool/browser_smoke.py
```

The browser smoke tool needs an already running Buyer web server/API plus Chromium and
chromedriver; it uses an isolated temporary profile, sends no real credentials, and creates
no accounts. Live tests cover public discovery/policies, denial and CORS/idempotency preflight only. Authenticated live flows
and installed Android acceptance remain open. No backend process/configuration is managed here.

The original fresh-project instructions and historical checks follow.

Creation, build and runtime commands below are implementation instructions for a destination Flutter repository. Executed SDK, dependency-resolution and analysis checks are recorded separately below. This documentation correction preserves the existing scaffold and application dependencies; feature packages were resolved only in a temporary verification project, and backend configuration was unchanged.

## Selected project SDK and compatibility evidence

Preserve this project’s selected **Flutter 3.47.2 stable / Dart 3.13.2** (Flutter revision `d3b14c876900e553bc736ca19295fc09e3853e8e`), verified with `flutter --version --machine` on 2026-10-04. Its existing pubspec.yaml requires `sdk: ^3.13.2`; the historical Dart 3.9.2 baseline cannot satisfy that constraint. Do not downgrade the SDK or loosen the project constraint to follow the old handoff. [package-baseline.json](references/package-baseline.json) preserves historical package metadata unchanged; [imported client baseline](references/imported-client-baseline.json) records the externally reported SDK verification and dependency resolution separately.

For a fresh destination, select the same SDK through approved tooling and verify `flutter --version` and `flutter doctor -v`; preserve the selected SDK in the external Flutter project. Keep pubspec.lock committed. On 2026-10-04, `flutter pub get --enforce-lockfile` passed for the existing scaffold and `flutter analyze --no-pub` reported no issues. Separately, all ten package pins below resolved together with `sdk: ^3.13.2` in an isolated temporary manifest, including the optional map packages. The application’s dependencies and lockfile were unchanged. This proves dependency resolution, not feature implementation, plugin runtime behavior, Android/web builds or target acceptance; later phase reports separately record compilation and synthetic/browser checks; live/device and distribution gates remain open.

| Package | Pin | Purpose / constraint evidence |
| --- | --- | --- |
| [go_router](https://pub.dev/packages/go_router/versions/16.2.4) | 16.2.4 | Routes; Dart ^3.7 / Flutter≥3.29 |
| [dio](https://pub.dev/packages/dio/versions/5.9.0) | 5.9.0 | JSON, cancellation, multipart; Dart≥2.18 <4 |
| [flutter_secure_storage](https://pub.dev/packages/flutter_secure_storage/versions/10.0.0) | 10.0.0 | Token only; Dart≥3.3 <4 / Flutter≥3.19 |
| [image_picker](https://pub.dev/packages/image_picker/versions/1.2.0) | 1.2.0 | XFile photo adapter; Dart ^3.6 / Flutter≥3.27 |
| [shared_preferences](https://pub.dev/packages/shared_preferences/versions/2.5.3) | 2.5.3 | Retired guest-key cleanup and nonsecret choices; Dart ^3.5 / Flutter≥3.24 |
| [url_launcher](https://pub.dev/packages/url_launcher/versions/6.3.2) | 6.3.2 | Reviewed external recovery/policy links; Dart ^3.6 / Flutter≥3.27 |
| [flutter_markdown_plus](https://pub.dev/packages/flutter_markdown_plus/versions/1.0.12) | 1.0.12 | Product/policy Markdown; Dart ^3.4 / Flutter≥3.27.1 |
| [flutter_map](https://pub.dev/packages/flutter_map/versions/8.2.2) | 8.2.2 | Optional raster pin editor; Dart≥3.6 <4 / Flutter≥3.27 |
| [latlong2](https://pub.dev/packages/latlong2/versions/0.9.1) | 0.9.1 | Optional coordinates; Dart≥3 <4 |
| [geolocator](https://pub.dev/packages/geolocator/versions/14.0.2) | 14.0.2 | Optional foreground GPS; Dart ^3.5 |

## Fresh destination creation and copy

```sh
flutter create --platforms=android,web --org com.aisley --project-name aisley_buyer .
```

Run in an empty prepared destination; use the deployment owner's application ID if different. Copy this bundle's contents into `docs/`. If root AGENTS.md is absent, copy docs/AGENTS.md to root. If it exists, selectively merge Buyer rules preserving project-specific instructions; do not overwrite it. The docs paths resolve from the Flutter repository root. Existing repositories adapt the blueprint deliberately, avoiding unapproved replacement of their established stack.

Declare the following in the created pubspec.yaml (preserve name/description/version and generated dev_dependencies, including flutter_test/flutter_lints):

```yaml
environment:
  sdk: '^3.13.2'
dependencies:
  flutter:
    sdk: flutter
  go_router: 16.2.4
  dio: 5.9.0
  flutter_secure_storage: 10.0.0
  image_picker: 1.2.0
  shared_preferences: 2.5.3
  url_launcher: 6.3.2
  flutter_markdown_plus: 1.0.12
  # Optional pinning only; omit these three for a text-only delivery.
  flutter_map: 8.2.2
  latlong2: 0.9.1
  geolocator: 14.0.2
flutter:
  uses-material-design: true
  assets:
    - assets/psgc/list-of-all-regions.json
    # Add every region directory from assets/psgc/pubspec-assets.yaml below.
```

Copy `docs/assets/psgc/` to `assets/psgc/`, excluding the manifest/README/pubspec helper from runtime assets. Add the eighteen regional directory entries listed in [the complete asset snippet](assets/psgc/pubspec-assets.yaml). Flutter directory registration is not recursive; registering only assets/psgc/ omits the nested addresses.json files. Preserve bytes and validate [manifest](assets/psgc/manifest.json) before/after copying.

```sh
flutter pub get
dart format --output=none --set-exit-if-changed lib test integration_test
flutter analyze
flutter test
flutter build apk --debug --dart-define=API_BASE_URL=https://api.example.invalid/api/v1 --dart-define=STOREFRONT_ORIGIN=https://shop.example.invalid
flutter build web --dart-define=API_BASE_URL=https://api.example.invalid/api/v1 --dart-define=STOREFRONT_ORIGIN=https://shop.example.invalid
flutter run -d web-server --web-hostname localhost --web-port 8766 --dart-define=API_BASE_URL=https://api.example.invalid/api/v1 --dart-define=STOREFRONT_ORIGIN=https://shop.example.invalid
```

The .invalid hosts are placeholders; replace with authorized origins. Create tests before invoking absent integration_test paths. Use `flutter test integration_test -d <android-device-id>` after writing target tests; browser automation uses the running localhost app with configured API/mock fixtures. Release APK signing/Play distribution are deployment work, not certified by debug compilation.

## Public configuration and Android

AppConfig reads compile-time API_BASE_URL, STOREFRONT_ORIGIN, MAPS_ENABLED (default false), GEOAPIFY_PUBLIC_API_KEY (optional), and approved destination hosts. Validate an absolute HTTPS API base ending /api/v1, HTTPS storefront origin, and exact trusted origins. Never put tokens, server credentials, storage keys or GEOAPIFY_SERVER_API_KEY in dart-define, assets, logs or source. Build configuration is public.

Android emulator development API may use http://10.0.2.2:<port>/api/v1; a physical phone needs a reachable approved host. Use only a debug-scoped cleartext exception for that specific development host. Release defaults stay HTTPS. No application database, seed or API configuration is copied into Flutter.

Set Android minSdk to **24** for the combined baseline and compileSdk **35 or greater** as required by the selected plugins; use the SDK's generated compatible Gradle/AGP/JDK tooling and verify with doctor/build. Main manifest needs INTERNET. Optional GPS adds ACCESS_COARSE_LOCATION and ACCESS_FINE_LOCATION; never add background location. GPS denial/disabled service/permanent denial preserve text-only operation. Image picker uses the system picker/camera intent; avoid broad storage permission. Follow the selected plugin's Android recovery/permission requirements. [geolocator Android setup](https://pub.dev/packages/geolocator/versions/14.0.2), [image_picker setup](https://pub.dev/packages/image_picker/versions/1.2.0)

Disable Android auto backup or exclude secure-storage preferences using Android backup/data-extraction rules; test storage restoration/deletion/reinstallation explicitly. Initialize WidgetsFlutterBinding before secure-storage calls. Web storage requires HTTPS or localhost and is origin-bound; keep localhost:8766 fixed. [secure-storage setup](https://pub.dev/packages/flutter_secure_storage/versions/10.0.0)

## Inputs required from deployment owners

- Reachable API/storefront origins, approved test Customer accounts, approval/consent state and representative visible Products/rates/vouchers/Orders.
- Customer browser CORS must allow exactly http://localhost:8766 while preserving existing origins; required methods/preflights and Authorization, Content-Type, Idempotency-Key. Expose Retry-After. Localhost origin and required preflights pass; Retry-After exposure remains open.
- Keep token-only Buyer browser origin outside Sanctum stateful domains; credentials disabled. Validate no same-host web-guard cookie contamination because Sanctum tries web identity before bearer fallback.
- Suitable public Geoapify credentials with browser-origin restrictions and provider-supported Android restrictions/quotas. If the provider cannot safely support the intended native use, keep pinning disabled pending an owner-approved mediation design.
- Map attribution/tile terms and trusted storefront reset-link deployment. Native reset app links and production browser security remain separate decisions.

Do not modify server configuration to satisfy these inputs from the mobile task. The historical metadata inspection and current dependency-resolution/scaffold-analysis checks do not establish any build, live exchange, permission, device or browser acceptance result.
