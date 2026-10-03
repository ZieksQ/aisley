# Fresh Customer Flutter project setup

These commands are implementation instructions to run **in the destination Flutter repository**, not commands executed in this documentation task. No Flutter project, package installation or backend configuration was created here.

## Stable baseline and compatibility evidence

Use **Flutter 3.35.4 stable / Dart 3.9.2** (Flutter revision `d693b4b9dbac2acd4477aea4555ca6dcbea44ba2`). This is a concrete compatible baseline, not a claim to be the latest SDK. Official release metadata and package constraints inspected on 2026-10-03 are recorded in [package-baseline.json](references/package-baseline.json). [Flutter archive](https://docs.flutter.dev/install/archive)

Install/select the baseline through your approved SDK tooling, then verify `flutter --version` and `flutter doctor -v`. Resolve dependencies and commit pubspec.lock in the application repository. All direct SDK constraints accept this baseline; flutter_map 8.2.2 accepts latlong2 ^0.9.1. Transitive resolution, Android toolchain/plugin behavior and browser compatibility are still required checks, not established by metadata inspection.

| Package | Pin | Purpose / constraint evidence |
| --- | --- | --- |
| [go_router](https://pub.dev/packages/go_router/versions/16.2.4) | 16.2.4 | Routes; Dart ^3.7 / Flutter≥3.29 |
| [dio](https://pub.dev/packages/dio/versions/5.9.0) | 5.9.0 | JSON, cancellation, multipart; Dart≥2.18 <4 |
| [flutter_secure_storage](https://pub.dev/packages/flutter_secure_storage/versions/10.0.0) | 10.0.0 | Token only; Dart≥3.3 <4 / Flutter≥3.19 |
| [image_picker](https://pub.dev/packages/image_picker/versions/1.2.0) | 1.2.0 | XFile photo adapter; Dart ^3.6 / Flutter≥3.27 |
| [shared_preferences](https://pub.dev/packages/shared_preferences/versions/2.5.3) | 2.5.3 | Guest recency and nonsecret choices; Dart ^3.5 / Flutter≥3.24 |
| [url_launcher](https://pub.dev/packages/url_launcher/versions/6.3.2) | 6.3.2 | Reviewed external recovery/policy links; Dart ^3.6 / Flutter≥3.27 |
| [flutter_markdown_plus](https://pub.dev/packages/flutter_markdown_plus/versions/1.0.12) | 1.0.12 | Product/policy Markdown; Dart ^3.4 / Flutter≥3.27.1 |
| [flutter_map](https://pub.dev/packages/flutter_map/versions/8.2.2) | 8.2.2 | Optional raster pin editor; Dart≥3.6 <4 / Flutter≥3.27 |
| [latlong2](https://pub.dev/packages/latlong2/versions/0.9.1) | 0.9.1 | Optional coordinates; Dart≥3 <4 |
| [geolocator](https://pub.dev/packages/geolocator/versions/14.0.2) | 14.0.2 | Optional foreground GPS; Dart ^3.5 |

## Create and copy

```sh
flutter create --platforms=android,web --org com.aisley --project-name aisley_buyer .
```

Run in an empty prepared destination; use the deployment owner's application ID if different. Copy this bundle's contents into `docs/`. If root AGENTS.md is absent, copy docs/AGENTS.md to root. If it exists, selectively merge Buyer rules preserving project-specific instructions; do not overwrite it. The docs paths resolve from the Flutter repository root. Existing repositories adapt the blueprint deliberately, avoiding unapproved replacement of their established stack.

Declare the following in the created pubspec.yaml (preserve name/description/version and generated dev_dependencies, including flutter_test/flutter_lints):

```yaml
environment:
  sdk: '>=3.9.2 <4.0.0'
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
- Customer browser CORS must allow exactly http://localhost:8766 while preserving existing origins; required methods/preflights and Authorization, Content-Type, Idempotency-Key. Expose Retry-After. Current defaults omit this origin/header exposure.
- Keep token-only Buyer browser origin outside Sanctum stateful domains; credentials disabled. Validate no same-host web-guard cookie contamination because Sanctum tries web identity before bearer fallback.
- Suitable public Geoapify credentials with browser-origin restrictions and provider-supported Android restrictions/quotas. If the provider cannot safely support the intended native use, keep pinning disabled pending an owner-approved mediation design.
- Map attribution/tile terms and trusted storefront reset-link deployment. Native reset app links and production browser security remain separate decisions.

Do not modify server configuration to satisfy these inputs from the mobile task. Source compatibility inspection does not establish any build, live exchange, permission, device or browser acceptance result.
