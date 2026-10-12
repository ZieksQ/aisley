# Phase 2 implementation and verification

Date: 2026-10-04. Branch: `feature/buyer-phase-2-discovery-account`, created
from `fix/buyer-api-origin-config`. Adopted local Laravel contract baseline:
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`. Running localhost backend revision
is unidentified. No backend, database, server configuration or other checkout changed.

## Implemented scope

- Server-backed Home, explicit Products/Shops search, category-filtered Shop
  directory, Shop keyword/category browsing and public Product detail.
- Ordered media, safe Markdown with validated image destinations, server-listed
  variants, stock-bounded quantity and nullable display fields. Purchasing,
  Orders, messaging, Q&A and reviews remain unavailable in this phase.
- Separate profile, password, authenticated avatar bytes/multipart photo and
  promotional-preference workflows. Identity stays read-only; birthdays stay
  date-only. Uncertain writes require reconciliation or reauthentication.
- Owned addresses with complete requests, shipping/billing defaults and list
  refetch after writes. No placed Order snapshot changes.
- Nineteen unchanged PSGC assets, lazy regional parsing, cascading selectors,
  NCR/direct-city handling, reviewed compatibility text and manual fallback.
- Optional intentional Geoapify geocoding, candidate review, map/pin adjustment,
  numeric coordinate confirmation and foreground GPS requested only after a tap.
- Cursor Wishlist/history, batched heart status, serialized per-Product Wishlist
  writes and immediate private cleanup on identity or consent loss.
- At most twelve persisted public guest Product ID/time hints, corruption/storage
  denial handling and acknowledged-only merge after verified authentication.
  Login does not wait for the merge. Private history never enters guest storage.
- Public snapshots: 60-second freshness, 64-entry bounds; personalized Home is
  separately scoped to Customer UUID/session generation and cleanup epoch.
- Typed query scalars, empty 204, authenticated binary responses, byte multipart,
  JSON 15-second/upload 60-second deadlines, cancellation and no upload retry.
  Native progress reports transport bytes; browser upload progress stays
  indeterminate because Fetch cannot report transferred bytes truthfully.

Existing theme, constructor injection, ChangeNotifier/session lifecycle, GoRouter
and Home/Shops/Cart/Account branches are preserved. Safe sign-in return routes
resume implemented destinations and never perform a saved mutation automatically.

## Executed verification

| Command/check | Result and scope |
| --- | --- |
| `flutter pub get --offline --enforce-lockfile` | Passed; approved pins and lockfile preserved. |
| `dart format --output=none --set-exit-if-changed lib test` | Passed. |
| `flutter analyze --no-pub` | Passed; no issues. |
| `flutter test --no-pub` | 101 unit/widget tests passed; 13 opt-in live tests skipped in this command. |
| `CHROME_EXECUTABLE=/usr/bin/chromium flutter test --no-pub --platform chrome test/web` | Eight tests passed, including real WebCrypto synthetic credential storage and browser binary/multipart integrity. |
| `BUYER_LIVE_API=1 flutter test --no-pub test/live` | 13 public/denial checks passed against localhost:8000; no authenticated writes. |
| `python3 tool/browser_smoke.py` | Isolated Chromium passed Home, Products/Shops search, Product/Shop detail, protected account/Cart guards, policies, Fetch settings, CORS and synthetic invalid-bearer denial. |
| `flutter build web --no-pub` with HTTPS placeholder defines | Passed; final release source compiled. |
| `flutter build apk --release --no-pub` with HTTPS placeholder defines | Passed; final release source compiled, APK 58.6 MB. |
| All PSGC byte counts/SHA-256, hierarchy traversal and source-byte equality | Passed for all 19 files and all 18 regions. |
| Revised spec lengths, local documentation links, Android XML, Python syntax, privacy review and `git diff --check` | Passed; eight Phase 2 specs remain 215 physical lines. |

Release build defines are public, nonfunctional `https://api.example.invalid` and
`https://shop.example.invalid`. Existing debug signing is preserved; compilation
is not distribution signing or deployed-API acceptance. Dependency Java 8 and
Geolocator deprecation warnings do not prevent Android compilation.

Synthetic tests cover exact requests/envelopes, casing/nullability, deadlines,
204/binary delivery, multipart boundary/content integrity, strict photo limits,
picker cancellation/recovery, uncertain mutations, profile/password errors,
public/private Home separation, A→B→A switching, consent cleanup, stale responses,
recommendation deduplication/200 cap, variant stock, Shop filters, address default
refetch, owned cursor deduplication, Wishlist serialization and partial recency
acknowledgement with a newer guest timestamp preserved.

Location checks cover every offline hierarchy, parent resets, NCR/manual text,
unavailable assets, configuration gating, provider rejection, coordinate pairing,
foreground denial/permanent denial and disabled services. Widgets cover narrow
360px layouts at doubled text scale, scrollable manual/profile forms, Home cards,
search with keyboard insets on a short viewport, Product controls, disabled
purchases and dirty-draft cancellation. Discovery headers scroll with the keyboard.
Existing Phase 1 keyboard/focus, labels/contrast/touch-target checks still pass.

## Runtime command and remaining acceptance gates

The requested command was executed unchanged and served Buyer at localhost:8766:

```sh
flutter run -d web-server --web-port 8766 --dart-define=API_BASE_URL=http://127.0.0.1:8000
```

- `MAPS_ENABLED=false` and `GEOAPIFY_PUBLIC_API_KEY=''` are defaults. Both must be
  configured before maps/GPS become available. No provider key was used or stored.
  Provider implementation follows [Geoapify geocoding](https://apidocs.geoapify.com/docs/geocoding/)
  and [tile attribution](https://apidocs.geoapify.com/docs/maps/map-tiles/), reviewed
  2026-10-04; map displays linked Geoapify/OpenStreetMap attribution. Suitable
  Android/browser public-key restrictions, live geocoding/tiles/GPS and installed
  device permissions remain deployment acceptance gates.
- Private workflows have synthetic verification only. Controlled live account
  profile/password/photo/preferences, address ownership/defaults, Wishlist/history,
  consent publication, account switching and token revocation remain open.
- Installed Android, actual picker/process interruption, keystore, TalkBack,
  system Back, location settings and physical-device accessibility remain open.
- Live public discovery/denials match local typed contracts in the tested scope;
  no new runtime conflict was observed. G04 browser Retry-After exposure, G15
  backend upload hardening and G23 deployed NCR shipping coverage remain open.
- No real credentials, private payloads/uploads or reset links were read, logged,
  committed or used. Broad feature acceptance criteria remain unchecked until
  their complete live/device requirements are demonstrated.
