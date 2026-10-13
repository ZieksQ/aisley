# Live Geoapify verification — 2026-10-08

Verification branch: `test/geoapify-live-address-maps`. App implementation is
`5a524ad`, using `maplibre_gl` 0.27.1. Laravel contract baseline remains
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; no backend or wire changes.

At the user's explicit request, only the Geoapify key entry from `.env` was used.
The file was not modified; the key was not printed, added to source or committed.
Public Flutter build inputs were supplied through an ignored, owner-readable
temporary define file. No real Customer credentials, private addresses or uploads
were used. Lookup used a public Manila landmark; Laravel replies remained synthetic.

## Actual results

| Check | Result |
| --- | --- |
| Live forward geocoding without browser headers | HTTP 200; finite, ranged Philippine coordinate pair |
| Live raster tile without browser headers | HTTP 200; PNG content type and signature valid |
| Same tile with localhost Origin, before provider change | HTTP 401; renderer correctly unavailable, numeric fallback retained |
| Same tile with referrer only | HTTP 200; isolated rejection to the Origin header |
| Same tile with localhost Origin and referrer, after user update | HTTP 200; PNG valid |
| Live MapLibre browser smoke at `http://localhost:8766` | Passed with Flutter accessibility enabled |
| Existing synthetic MapLibre browser smoke | Passed; actual provider traffic blocked |
| Python tooling suite | Eleven tests passed |
| Live-key web release build | Passed; 98.0 seconds |
| Attached Android device | None; native renderer/GPS/TalkBack not verified |

The live browser smoke verifies real Geoapify tile delivery and MapLibre raster
content without SDK errors, map tap and pin drag, one explicit live geocode,
candidate selection/recentering, retained map across viewport resizing, Cancel
renderer disposal and deliberate Retry. The quota failure is an injected HTTP 429;
actual provider quota exhaustion was not exercised. Only the synthetic login wrote
to the intercepted API; no Laravel write or real account was used. Live screenshots
are disabled, and diagnostics include status/counts only, without URLs or payloads.

The initial key rejected requests carrying `Origin: http://localhost:8766`.
Requests without Origin and requests with referrer alone succeeded. After the user
added the local origin in MyProjects, the same request and full browser smoke
succeeded. Geoapify documents [allowed-origin and referrer settings](https://myprojects.geoapify.com/help/api-keys/).
The test did not bypass origin restrictions or modify the provider account.

## Repeating the browser check

Provide an approved public key through a Git-ignored define file with the existing
`API_BASE_URL`, `STOREFRONT_ORIGIN`, `MAPS_ENABLED=true` and
`GEOAPIFY_PUBLIC_API_KEY` fields. Use the synthetic HTTPS API/storefront origins from
the [initial MapLibre evidence](maplibre-verification.md) to keep Laravel isolated.

```sh
flutter build web --no-pub --no-wasm-dry-run --dart-define-from-file=build/verification/maplibre-live-config.json
python3 -m http.server 8766 --bind 127.0.0.1 --directory build/web
python3 tool/maplibre_browser_smoke.py --live-geoapify
```

The default command without `--live-geoapify` retains synthetic provider replies.
Remove temporary define files after testing. Compiled Flutter map configuration is
public; key restriction/quotas/production suitability, installed Android rendering,
physical GPS/permissions/TalkBack and real-account CRUD/shipping remain release gates.
These results verify this key and local browser origin, not every deployment.
