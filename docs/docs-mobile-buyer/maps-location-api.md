# Buyer addresses, PSGC and optional pinning

The bundle supplies all address reference data and a selected optional Flutter adapter. The external Buyer project reports Android/browser controls implemented with partial acceptance; installed-device and live coverage remain unverified. Canonical locality names and Laravel shipping decisions are authoritative; coordinates assist and never prove deliverability. This preserves the platform Geoapify/privacy boundary while adapting its web Leaflet renderer to Flutter.

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

Optional flutter_map/latlong2 shows Geoapify raster tiles only after a valid result or explicit GPS/pin operation. Configure the provider's raster URL such as `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=<public-key>`, TileLayer userAgentPackageName for native identification and a persistent attribution control. Keep visible Geoapify, OpenStreetMap contributors and applicable OpenMapTiles attribution with accessible links; verify attribution for the selected style. Tile failures retain a coordinate summary/text-only address. [Official tile API/attribution](https://apidocs.geoapify.com/docs/maps/map-tiles/), [flutter_map provider guidance](https://docs.fleaflet.dev/layers/tile-layer/tile-providers)

Allow tap/drag pin plus accessible numeric latitude/longitude adjustment and explicit Confirm/Cancel. GPS uses geolocator only on **Use current location**, checks service availability and permission, handles denied/deniedForever/approximate/timeouts, and offers Settings or text-address continuation. No background permission/listener. Never prompt GPS at startup, block a valid text address on pin denial, or treat approximate location as verified delivery evidence.

Latitude and longitude are optional, but paired and range-validated: latitude−90…90, longitude−180…180. Provider GeoJSON arrays use longitude first; latlong2/Address adapters use named latitude/longitude. Editing any populated location field clears old pair; recipient-only edits need not discard the address pin. A failed provider request does not erase text or retain a mismatched pair.

## Credentials and deployment gates

Use suitable **public** Geoapify credentials with exact browser origin restrictions, quotas and provider-supported native restrictions. Bundled mobile keys are extractable; browser referrer restrictions do not by themselves secure Android use. If suitable credential/provider deployment cannot be approved, keep MAPS_ENABLED false and deliver text-only addresses. No server proxy/new endpoint is authorized by this handoff.

Check every regional hierarchy, dropdown opening/filtering, exact-match text without selection, parent resets, saved-address hydration, NCR compatibility, unsupported direct-city mappings, failed-asset Retry, coordinate order, denied GPS, provider timeout/quota/empty result, attribution and unchanged Order snapshots. Documentation checksum checks are completed; Flutter loading, physical GPS, live provider and shipping coverage acceptance remain pending. [Setup](setup.md), [Address spec](features/customer/address-book/spec.md), [release gaps](references/integration-gaps.md).
