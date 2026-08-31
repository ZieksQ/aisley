# Maps, Address, and Location API Policy

## Purpose

This document is the required architecture and provider policy for any Aisley feature involving addresses, place suggestions, geocoding, GPS, latitude/longitude, maps, or map pins. Read it before implementing or changing location behavior in the Customer, Seller, Admin, API, or external Courier integration.

## Non-negotiable rule: no Mapbox Permanent Geocoding

**Aisley must not use the Mapbox Permanent Geocoding API.** Do not send Mapbox Geocoding requests with `permanent=true`, and do not add another Mapbox Search product as a substitute for Geoapify autocomplete without an explicit architecture and cost-policy change.

The following are prohibited for address entry and stored location data:

- Mapbox Permanent Geocoding API requests.
- Mapbox Geocoding, Search Box, Address Autofill, geocoder controls, or search SDKs for suggestions or reverse geocoding.
- Persisting a Mapbox geocoding/search response, feature, place result, or provider identifier.
- Giving the browser Mapbox token unnecessary Search or Geocoding permissions.

Mapbox is approved only for rendering a map and allowing a Customer or authorized user to view, place, drag, or recenter a pin using latitude and longitude obtained from an approved non-Mapbox source.

## Approved provider responsibilities

| Concern | Authoritative provider or component | Allowed use |
| --- | --- | --- |
| Address suggestions and forward geocoding | Geoapify Address Autocomplete | Suggest Philippine addresses and return structured fields plus latitude/longitude. |
| Philippine administrative hierarchy | Bundled PSA PSGC Q2 2026 data through Laravel | Search, validate, and canonicalize Region, Province, City/Municipality, and Barangay. |
| Interactive/read-only map and pin | Mapbox GL JS | Render map tiles/styles, center on coordinates, and display or move a pin. |
| Current-device coordinates | Browser or mobile operating-system geolocation | Populate latitude/longitude after the user grants permission. |
| Persistence and validation | Laravel API and Postgres | Validate and save the submitted address fields and coordinates. |

The approved flow is:

```text
Geoapify suggestion
  -> structured address fields + latitude/longitude
  -> searchable PSA PSGC fields canonicalize/correct the hierarchy
  -> Mapbox GL JS displays those coordinates and the pin
  -> Laravel validates and persists the submitted address and coordinates
```

Geoapify improves entry speed but is not the final authority for Philippine administrative names. The searchable PSA PSGC controls remain available so the user can complete or correct Region, Province, City/Municipality, and Barangay when a suggestion is incomplete or inaccurate.

## API usage

### Geoapify

The storefront currently calls:

```text
GET https://api.geoapify.com/v1/geocode/autocomplete
```

Requests must be restricted to the Philippines, debounced, and cancelled or ignored when stale. A selected result may populate only equivalent structured fields; it must not guess one administrative level from another. Broad place results such as a city must not be copied into the street/building field.

Recognize Geoapify's applicable Philippine locality variants, then match provider values to canonical PSA PSGC names. Selecting a new suggestion replaces the previous location hierarchy instead of retaining stale values. Missing values remain blank and editable.

Geoapify supplies the suggestion's latitude and longitude. Those coordinates may be persisted with the address and passed to Mapbox GL JS for map display. Geoapify/OpenStreetMap attribution must remain visible wherever required by the provider terms.

### PSA PSGC address options

Laravel exposes the bundled hierarchy through the role-neutral endpoints:

```text
GET /api/v1/address-options/regions
GET /api/v1/address-options/provinces?reg={regionCode}
GET /api/v1/address-options/municipalities?reg={regionCode}&prv={provinceCode}
GET /api/v1/address-options/barangays?reg={regionCode}&prv={provinceCode}&mun={municipalityCode}
```

The Seller-compatible `/api/v1/seller/auth/address-options/*` routes remain available where already used. These endpoints are backed by repository data rather than a third-party runtime request and are throttled. Parent changes must clear incompatible child values.

PSGC codes are lookup and relationship keys. Unless a feature specification explicitly changes the data model, persist the existing address names, not provider identifiers or PSGC codes.

### Mapbox

Mapbox GL JS may use the configured style and public browser access token to:

- Create an interactive or read-only map.
- Center or zoom using supplied latitude/longitude.
- Render a pin.
- Update coordinates after an intentional map click or pin drag.
- Recenter the map on permission-granted GPS coordinates.

It must not make a Mapbox Geocoding or Search request. Map interaction does not rewrite the textual address unless a separately approved non-Mapbox reverse-geocoding flow is implemented.

Creating a Mapbox GL JS `Map` is a billable map load under Mapbox's current pricing model. Recenter, zoom, click, and drag interactions on the same map instance do not each create another map load. Avoid unnecessary map reinitialization.

### GPS/geolocation

GPS is optional and permission-gated. A denial, timeout, unavailable sensor, or unsupported browser must leave manual address entry usable. GPS returns coordinates, not a trustworthy postal address; it must not invent Region, Province, City/Municipality, Barangay, postal code, or street text.

## Address and coordinate behavior

- Region, Province, City/Municipality, and Barangay remain independently searchable through the cascading PSA PSGC controls.
- Users can manually review and correct every address field before saving.
- Street/building/unit and postal details remain editable and must not be inferred from unrelated provider fields.
- Geoapify selection can set both structured fields and coordinates.
- Manual changes to administrative address fields clear coordinates when they may no longer describe the edited address; the user can then choose a suggestion, GPS, or the map again.
- Map click, pin drag, or GPS can update latitude/longitude without silently rewriting the textual address.
- Latitude and longitude must remain validated numeric values within `-90..90` and `-180..180`, respectively.
- Address saving must still work without coordinates when the feature's existing validation permits them to be nullable.

## Failure and fallback requirements

Location entry must degrade safely:

- If Geoapify is unavailable or unconfigured, keep the PSA PSGC search controls and manual fields usable.
- If the PSGC endpoint is unavailable, retain the form's supported manual-entry fallback rather than blocking address submission solely because reference data failed.
- If Mapbox, WebGL, or the style fails, show an accessible availability message and preserve the textual address and coordinate inputs.
- If GPS fails or permission is denied, explain the failure without clearing already entered data.
- Never fall back to Mapbox Geocoding or Search when Geoapify fails.

## Credentials, privacy, and attribution

- `NEXT_PUBLIC_GEOAPIFY_API_KEY` is the browser key for Geoapify autocomplete. Restrict it to approved application origins/domains using Geoapify controls.
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is the public browser token for Mapbox GL JS. Apply URL restrictions and grant only the scopes required for approved map styles/tiles; do not grant Search/Geocoding capabilities.
- Never place secret provider credentials in a `NEXT_PUBLIC_*` variable or commit credentials to the repository.
- Send only the location query and contextual filters needed for autocomplete. Do not send account, order, or unrelated personal data to a map provider.
- Keep required Geoapify, OpenStreetMap, and Mapbox attribution visible.

## Free-tier and cost boundary

Provider pricing can change. The figures below were verified against the official provider pages on **2026-08-31** and must be rechecked before capacity planning or release decisions:

- Geoapify's Free plan currently includes 3,000 credits per day; one Address Autocomplete request consumes one credit. Debouncing reduces unnecessary requests.
- Mapbox GL JS currently includes up to 50,000 map loads per month at no charge. Usage beyond that allowance is billed.
- Mapbox Permanent Geocoding has no free tier for this use and requires separate permanent-geocoding entitlement. Aisley's approved flow makes zero Permanent Geocoding requests.

Therefore, the current architecture can remain at **$0 Mapbox usage only while monthly Mapbox GL JS map loads stay within Mapbox's current free allowance**. It does not promise unlimited free Mapbox use, and it does not use the Mapbox Permanent Geocoding API.

## Implementation checklist

Before merging any maps/location change, verify that:

- Geoapify, not Mapbox, performs address autocomplete/geocoding.
- Searchable PSA PSGC controls remain available for Region, Province, City/Municipality, and Barangay.
- Mapbox receives only coordinates needed to render or move the map/pin.
- No code calls Mapbox Geocoding/Search endpoints or sets permanent-geocoding mode.
- Provider tokens are restricted and attribution is present.
- Manual, provider-failure, WebGL-failure, and GPS-denial paths remain usable.
- Coordinates and administrative relationships are validated by Laravel.
- Tests cover stale suggestions, incomplete provider results, hierarchy corrections, and unavailable-provider fallbacks where applicable.
- This document and the relevant role feature specification are updated if the approved architecture changes.

## Official references

- [Geoapify Address Autocomplete API](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/)
- [Geoapify pricing](https://www.geoapify.com/pricing/)
- [Mapbox GL JS guide](https://docs.mapbox.com/mapbox-gl-js/guides/)
- [Mapbox GL JS pricing guide](https://docs.mapbox.com/mapbox-gl-js/guides/pricing/)
- [Mapbox Geocoding API documentation](https://docs.mapbox.com/api/search/geocoding/)
- [Mapbox pricing](https://www.mapbox.com/pricing)
- [Mapbox attribution guidance](https://docs.mapbox.com/help/getting-started/attribution/)
