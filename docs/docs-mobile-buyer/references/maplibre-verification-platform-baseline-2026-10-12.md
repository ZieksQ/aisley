# MapLibre address-map verification — 2026-10-08

> Imported external Buyer Flutter report dated 2026-10-08; checks below were not rerun in the Laravel repository. Flutter source, tools, build configuration and credentials are not included in this documentation bundle.

Implementation branch: `feature/buyer-maplibre-address-map`. Adopted Laravel contract
baseline remains `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; no backend/wire changes.
Flutter remains 3.47.2 / Dart 3.13.2. `maplibre_gl`, its platform interface and web
implementation resolve to 0.27.1. Existing geolocator is retained; flutter_map,
latlong2 and their unused transitive dependencies are removed from the lockfile.

## Behavior

Geoapify still supplies intentional forward geocoding and light raster tiles.
MapLibre renders only the address-pin workflow. The same `GeoCandidate`, optional
coordinate pair, explicit confirmation and server-owned address/shipping contract
remain. The editor uses a fullscreen Material route with closed-loop keyboard focus;
this avoids `DialogRoute`'s opaque semantics overlay intercepting the web map.
A selected-pin tile probe detects initial provider denial/quota/offline and
malformed images before SDK construction; a 15-second deadline bounds map readiness.
It does not certify every later viewport tile because the SDK exposes no Dart tile
error callback. Numeric entry and manual saving remain available on map failure.

Late lookup, library, readiness, tap/drag and camera callbacks cannot restore private
state after logout/consent loss/account switching. A revoked dialog stays revoked
when another identity becomes active. Native GPS stays foreground-only; MapLibre's
own location tracking is disabled. Provider Fetch omits cookies/rejects redirects
and sends only an origin referrer to the two public Geoapify hosts; API behavior is
unchanged. No real credentials, accounts, addresses, uploads or authenticated writes
were used. No secret-bearing environment file was read.

## Checks

- `flutter pub get`: passed; approved MapLibre dependency resolved and lock updated.
- `flutter analyze --no-pub`: passed after the final route change, no issues.
- `dart format --output=none --set-exit-if-changed lib test`: 210 files, no changes.
- MapLibre/location focused tests: 29 passed, followed by the added system-back case
  passing. There are 16 MapLibre cases and 14 existing location cases. Covers
  explicit/lazy lookup, candidate/GPS recentering, tap/drag adapter updates, saved
  coordinates, pending readiness, quota/image/library/renderer/deadline failures,
  deliberate retry, numeric confirmation/cancel/system back, logout/consent/account switching,
  obsolete lookup and narrow doubled-text/landscape layouts.
- Existing location and communication contract/support focused rerun: 56 passed
  before the two additional map cases; the existing Geoapify/GPS/PSGC tests passed.
- `CHROME_EXECUTABLE=/usr/bin/chromium flutter test --no-pub --platform chrome test/web`:
  10 passed, including both Geoapify origin referrers, cookie/redirect isolation,
  binary/multipart transport, cancellation and secure-storage restoration/deletion.
- Full `flutter test --no-pub --concurrency=2`: 301 passed, 42 opt-in live tests skipped,
  one failed. Run before the final fullscreen route/system-back change. Desktop
  checkout accessibility fails because the address option is 36px high; the exact
  test also fails against the original HEAD in an isolated `/tmp` archive with its
  original lockfile. This pre-existing unrelated UI was not changed.
- Earlier concurrent full run had two communication timeout/race failures; both
  passed in a focused rerun and the final full run above.
- Release APK compilation passed with nonfunctional HTTPS API/storefront origins
  and existing debug signing. Final MapLibre-enabled build passed in 284.9 seconds,
  producing a 92.3 MB APK. Production signing/distribution acceptance remains open.
- Web release compilation passed with synthetic public map configuration, including
  the default Wasm compatibility dry run. Final `--no-wasm-dry-run` build with the
  fullscreen route and synthetic map/API/storefront flags passed in 194.1 seconds.
- `python3 tool/maplibre_browser_smoke.py` at `http://localhost:8766`: passed with
  Flutter accessibility enabled. Actual MapLibre synthetic raster rendering,
  pointer tap/drag, Geoapify lookup/recenter, retained instance across resizing,
  Cancel renderer disposal, quota fallback and deliberate Retry all passed. Only
  the synthetic login wrote to the intercepted API; no live provider/API traffic.
- `python3 -m unittest discover -s tool -p '*_test.py'`: 11 passed, including
  original-base links in verbatim progress archives and rejection of missing targets.
- `python3 tool/verify_bundle.py`: local links, all 22 spec lengths, all 19 PSGC
  checksums/registrations and Android boundaries passed; `git diff --check` passed.

The complete 159-line progress log was preserved under `docs/logs/` after crossing
the required 150-line threshold. Archive links retain their original `docs/` base;
the [archive index](../logs/README.md) supplies clickable evidence links.
- `adb devices`: no attached authorized device. Installed Android gestures, TalkBack,
  native permission/renderer behavior and production signing remain unverified.

## Repeating the renderer smoke

Build with explicit synthetic public map configuration; serve only the built Buyer
at its fixed origin. All API/provider responses are synthetic; CDN JS/CSS/worker
resources still use the plugin's default pinned loader. The harness blocks actual
Geoapify and placeholder API traffic, including worker fallback requests.

```sh
flutter build web --no-wasm-dry-run --dart-define=API_BASE_URL=https://api.example.invalid/api/v1 --dart-define=STOREFRONT_ORIGIN=https://shop.example.invalid --dart-define=MAPS_ENABLED=true --dart-define=GEOAPIFY_PUBLIC_API_KEY=synthetic-public-key
python3 -m http.server 8766 --bind 127.0.0.1 --directory build/web
python3 tool/maplibre_browser_smoke.py
```

The smoke checks the actual MapLibre engine, synthetic raster delivery, browser pin
click/drag, one explicit Geoapify lookup, retained map/recenter/resizing, Cancel
unmount, provider quota fallback and a deliberate fresh Retry. Synthetic screenshots
are Git-ignored under `build/verification/maplibre-screenshots/`. Compilation, fakes
and this browser check do not establish live provider credentials/terms/restrictions,
real-account CRUD/shipping or installed-device accessibility. G07 and other existing
release gates remain open. See [map guidance](../maps-location-api.md),
[setup](../setup.md) and [integration gaps](integration-gaps.md).
