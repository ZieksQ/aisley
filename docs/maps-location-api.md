# Maps, Address, and Location API Policy

## Purpose

This document defines the approved provider, privacy, fallback, and cost boundaries for Aisley features involving addresses, geocoding, coordinates, maps, pins, and road-distance ranking.

## Approved responsibilities

| Concern | Provider or component | Allowed use |
| --- | --- | --- |
| Philippine administrative hierarchy | Bundled PSA PSGC data in `packages/psgc-address-data/data` | Search, validate, and canonicalize Region, Province, City/Municipality, and Barangay. |
| Forward geocoding | Geoapify Geocoding API | Resolve a completed, user-confirmed Philippine address after an intentional action. |
| Interactive map and pin | Geoapify map tiles rendered with Leaflet | Display confirmed coordinates and let the user click or drag a local HTML pin. |
| Road-distance ranking | Geoapify Route Matrix API | Compare one Seller pickup coordinate with a bounded set of eligible Logistics hub coordinates server-side. |
| Current-device coordinates | Browser or mobile operating-system geolocation | Populate coordinates after explicit permission. |
| Persistence and validation | Laravel API and Postgres | Validate and save authoritative address fields and optional coordinates. |

PSGC names and manually reviewed address fields remain authoritative. Coordinates assist routing; they do not replace the readable address or prove deliverability. Mapbox is not used.

## Address pinning flow

The Customer and Seller Address Book flow is:

```text
Select cascading PSGC address
  -> complete street and postal fields
  -> intentionally choose Pin location
  -> one Geoapify forward-geocoding request
  -> render a Geoapify map with Leaflet only after a result exists
  -> confirm or adjust the local pin
  -> Laravel validates and persists the address and coordinates
```

There is no provider request while the user types. Changing a populated textual location field clears the coordinate pair; the user must pin again. Manual saving remains available when Geoapify is unavailable.

## Route Matrix ranking

- Call `POST https://api.geoapify.com/v1/routematrix` only from Laravel, using `GEOAPIFY_SERVER_API_KEY`; never expose this server credential to a browser bundle.
- Send one source and only bounded eligible hub targets. Each location uses GeoJSON order `[longitude, latitude]`; no names, phone numbers, street lines, Order contents, user IDs, or account IDs are sent.
- Use `mode=drive`. `sources_to_targets[0][n].distance` is authoritative metres and is converted to kilometres for display and persistence.
- Cache successful results by source and destination coordinate fingerprints. A changed pin produces a new fingerprint and cannot reuse the stale rank.
- Enforce a short timeout. An unconfigured key, absent coordinates, quota response, timeout, malformed response, or null route returns an unavailable distance and must not fabricate `0 km` or block manual selection of an otherwise eligible provider.
- Exact PSGC city/province/country matching is evaluated locally before road distance. Distance breaks ties and ranks eligible non-exact options only when authoritative values are available.
- Keep Geoapify and OpenStreetMap attribution visible wherever calculated distance is presented.

## Coordinate and privacy rules

- Latitude and longitude are optional unless a feature explicitly requires them, but they must be submitted as a complete pair and remain within `-90..90` and `-180..180`.
- Provider failures must not erase entered text or silently rewrite address fields.
- Do not put credentials, full addresses, or route payloads in logs.
- `NEXT_PUBLIC_GEOAPIFY_API_KEY` (Customer webapp) and `VITE_GEOAPIFY_API_KEY` (Seller dashboard) are origin-restricted browser keys for intentional forward geocoding and tiles. `GEOAPIFY_SERVER_API_KEY` is a separate server-only key for Route Matrix requests.

## Cost boundary

Geoapify usage shares the configured account allowance. A 1×N matrix consumes N baseline matrix cells/credits under the current pricing model. Treat free capacity as a launch allowance, meter requests and failures, and recheck pricing and terms before release or capacity changes.

## Official references

- [Geoapify Route Matrix](https://apidocs.geoapify.com/docs/route-matrix/)
- [Geoapify pricing](https://www.geoapify.com/pricing/)
- [Geoapify Geocoding API](https://apidocs.geoapify.com/docs/geocoding/)
- [Geoapify map tiles with Leaflet](https://apidocs.geoapify.com/docs/maps/map-tiles/leaflet/)
