# Buyer addresses, PSGC and optional pinning

The bundle supplies all address reference data and a selected optional Flutter adapter. The external Buyer project reports Android/browser controls implemented with partial acceptance; installed-device and real-account coverage remain unverified; the October 8 public-provider/local-browser report is linked below. Canonical locality names and Laravel shipping decisions are authoritative; coordinates assist and never prove deliverability. This preserves the platform Geoapify/privacy boundary while adapting its web Leaflet renderer to Flutter.

## Exact assets and typed loading

Use [assets/psgc/list-of-all-regions.json](assets/psgc/list-of-all-regions.json), the eighteen referenced regional JSON files, [attribution/checksum manifest](assets/psgc/manifest.json) and [asset registration](assets/psgc/pubspec-assets.yaml). All nineteen data files match the existing workspace source bytes; no converted hierarchy is needed. Dataset provenance is PSA PSGC Q2 2026 per the source package; original-publication accuracy was not independently audited.

| Type | Exact fields |
| --- | --- |
| RegionIndexEntry | psgc_code:string, name:string, file:string (relative regional path) |
| RegionPayload | source:string, region:PsgcNode |
| PsgcNode | psgc_code:string, name:string, correspondence_code:string, geographic_level:string, children:PsgcNode[] |
| Supplemental metadata | urban_rural:string?, population_2024:int?, and other descriptive source fields; ignore for address selection |

Codes retain leading zeroes and are never integers. Decode AssetBundle.loadString through jsonDecode into immutable models; validate the index as a list and each payload.region.psgc_code matches its requested entry. Require safe index-relative paths from the nineteen-file allow-list; never accept user-supplied asset paths. Lazy-load/cache one region at a time by code; evict failed load futures so Retry can recover. Sorting options by natural/case-insensitive name never rewrites source bytes. Account switches can retain this public administrative cache, but clear form selections.

## Hierarchy and cascade

Regions contain provinces and may contain direct cities/municipalities. Provinces contain cities/municipalities; city/municipality children lead to Barangays. Traverse descendants under the selected city to find geographic_level barangay rather than assume every parent depth is uniform. Preserve the actual geographic_level strings and extra children; reject invalid parent/code combinations.

Select Region → Province where a real province exists → City/Municipality → Barangay. Each is a searchable dropdown: opening shows its available choices and typing filters the menu. Search text never counts as a selection, including when it exactly matches an option. A parent change clears descendant selections and stale coordinates. Do not attach a direct city to an invented Province node. Offer region-direct cities separately from province-owned cities where both occur.

NCR's region node has direct cities and **no Province nodes**. Keep the Province dropdown visible and offer `National Capital Region (NCR)` as its compatibility choice because the API requires a province string. This is a selected Flutter form convention, not a claim that NCR is a province or an upstream validation exception. For other direct cities, do not infer a province from a name or neighboring node. Explain that the required Province mapping is unavailable and block saving that hierarchy. Verify NCR/direct-city coverage live before release, and never claim geocoding overrides it.

Store lookup codes in local form state only. Requests save canonical names from explicitly selected entries through existing snake_case fields; no PSGC code, provider_place_id or replacement address API field is invented. Existing-address names that do not match entries remain visible for review but cannot be submitted until valid options are selected within the hierarchy. Missing, corrupt or incomplete assets show Retry and block saving; custom Region/Province/City/Barangay text is never a fallback. Failed loader results are evicted so Retry can recover. Recipient, contact, street/building, unit/additional line and postal code remain text fields. Country is restricted to Philippines. No network is required for normal selectors.

Auxiliary public address-options APIs return `{options:[{code:string,name:string}]}`: regions has no input; provinces requires reg; municipalities requires reg and optional prv; barangays requires reg, optional prv and mun. Each code is a ten-digit string. They return503 ADDRESS_DATA_UNAVAILABLE on missing/invalid data and422 on invalid filters. The current storefront helper actually loads the same local JSON despite its fetchPsgcOptions name. Flutter uses bundled assets; these APIs are optional fallback diagnostics, not mandatory per-selection calls.

## Intentional pin assistance

Manual reviewed address → **Pin location** → one Geoapify forward-geocode → review result/map → optional move/GPS → confirm pair → Save. No autocomplete/geocode request while typing or changing selectors. Keep provider/network traffic off until intentional action and configured credentials exist.

Use a separate credential-free provider client for `GET https://api.geoapify.com/v1/geocode/search` with URL-encoded `text` made only from address fields, `filter=countrycode:ph`, `limit=1`, `format=json`, and public `apiKey`. Read `{results:[{lat:number,lon:number,formatted:string?,country_code:string?,rank:object?}]}`; reject empty/malformed/nonfinite/out-of-range results and non-Philippine country indication. Review the candidate before assigning coordinates; do not copy formatted provider text over manual fields. [Official geocoding API](https://apidocs.geoapify.com/docs/geocoding/)

Do not send recipient names, phones, account IDs, tokens, Order contents or private notes to the provider. Forward geocoding necessarily sends the confirmed address location; explain this at the Pin action. No address/credential/query-string logging. Never call server Route Matrix or Routing from Buyer; GEOAPIFY_SERVER_API_KEY stays server-side. No Mapbox, live Courier GPS/ETA or automatic route calculation.

MapLibre (`maplibre_gl` 0.27.1) renders the existing light Geoapify raster tiles only after an explicitly reviewed candidate, GPS result or saved pin is selected. An inline style uses `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=<public-key>` with an encoded public key; no remote style, font or sprite provider is added. The renderer receives no Laravel bearer or account fields. Keep visible Geoapify, OpenStreetMap contributors and applicable OpenMapTiles attribution with accessible links; verify attribution for the selected style. Tile failures retain a coordinate summary/text-only address. [Official tile API/attribution](https://apidocs.geoapify.com/docs/maps/map-tiles/), [MapLibre platform setup](https://maplibre.org/flutter-maplibre-gl/getting-started/)

Allow tap/drag pin plus accessible numeric latitude/longitude adjustment and explicit Confirm/Cancel. GPS uses geolocator only on **Use current location**, checks service availability and permission, handles denied/deniedForever/approximate/timeouts, and offers Settings or text-address continuation. No background permission/listener. Never prompt GPS at startup, block a valid text address on pin denial, or treat approximate location as verified delivery evidence.

Latitude and longitude are optional, but paired and range-validated: latitude−90…90, longitude−180…180. Provider GeoJSON arrays use longitude first; MapLibre/Address adapters use named latitude/longitude. Editing any populated location field clears old pair; recipient-only edits need not discard the address pin. A failed provider request does not erase text or retain a mismatched pair.

## Credentials and deployment gates

Use suitable **public** Geoapify credentials with exact browser origin restrictions, quotas and provider-supported native restrictions. Bundled mobile keys are extractable; browser referrer restrictions do not by themselves secure Android use. If suitable credential/provider deployment cannot be approved, keep MAPS_ENABLED false and deliver text-only addresses. No server proxy/new endpoint is authorized by this handoff.

Check every regional hierarchy, dropdown opening/filtering, exact-match text without selection, parent resets, saved-address hydration, NCR compatibility, unsupported direct-city mappings, failed-asset Retry, coordinate order, denied GPS, provider timeout/quota/empty result, attribution and unchanged Order snapshots. Documentation checksum checks are completed; Externally reported synthetic loading and localhost Geoapify lookup/tiles passed; installed Android/GPS, production provider configuration and real-account shipping remain open. [Setup](setup.md), [Address spec](features/customer/address-book/spec.md), [release gaps](references/integration-gaps.md).

## Map renderer lifecycle — external report, 2026-10-08

`MapLocationService` retains Geoapify forward lookup and foreground geolocator access. `AddressPinMap` owns loading/retry/deadline/cancellation, while an injectable `AddressMapAdapter` owns the MapLibre platform view, pin and camera. The dialog returns the same reviewed `GeoCandidate`; address DTOs and Laravel operations are unchanged.

The pin editor uses a fullscreen Material route with closed-loop keyboard focus and explicit Confirm/Cancel. This avoids Flutter's `DialogRoute` opaque web semantics layer intercepting map pointers when accessibility is enabled; other address dialogs are unchanged.

Each initial map attempt or deliberate Retry fetches and decodes the zoom-16 tile containing the selected point through the isolated provider client, before creating the SDK view. This catches provider denial/quota, offline and malformed-image failures. It is one extra tile request per attempt, not a geocode or a shipping decision. The SDK has no Dart tile-error callback; this probe does not certify every later viewport tile. Missing later tiles never disable numeric entry or address saving.

The complete preparation/style/pin operation has a 15-second deadline. Failures show a fixed message and Retry without raw provider/SDK errors. A draggable pink annotation is created only after style readiness. Updates before readiness retain the latest selected pair; map tap/drag changes the pair without recentering, while candidate/GPS selection recenters. Closing, logout or consent loss removes the view, cancels the tile probe/deadline and rejects obsolete callbacks.

Web uses the plugin's pinned default MapLibre GL JS/CSS loader only after the pin tile check; `web/index.html` needs no map scripts. It requires WebGL2 and reachability of `https://unpkg.com` (including worker resources); failure preserves coordinate entry and manual saving. Android uses the existing foreground permissions, minSdk 24 and JDK 21 build runtime. No background location, native offline regions or tracking are enabled. See [MapLibre verification](references/maplibre-verification.md) for executed checks and limits.

Live Geoapify lookup and MapLibre raster interaction at `http://localhost:8766` passed after the provider key's allowed-origin setting was updated. See [live-key verification](references/geoapify-live-verification.md); installed Android and production credential suitability remain open.
