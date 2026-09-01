# Maps, Address, and Location API Policy

## Purpose

This document defines the provider and cost boundaries for Aisley features involving addresses, forward geocoding, coordinates, maps, or map pins.

## Approved responsibilities

| Concern | Provider or component | Allowed use |
| --- | --- | --- |
| Philippine administrative hierarchy | Bundled PSA PSGC Q2 2026 data in `packages/psgc-address-data/data` | Search, validate, and canonicalize Region, Province, City/Municipality, and Barangay. |
| Forward geocoding | Geoapify Geocoding API | Resolve a completed, Customer-confirmed textual address to one latitude/longitude pair after an intentional action. |
| Interactive map and pin | Geoapify map tiles rendered with Leaflet | Display the geocoded coordinates and let the Customer click or drag a local HTML pin. |
| Current-device coordinates | Browser or mobile operating-system geolocation | Populate coordinates after explicit permission when a feature requires it. |
| Persistence and validation | Laravel API and Postgres | Validate and save the submitted address fields and optional coordinates. |

The Customer Address Book flow is:

```text
Customer selects the cascading PSGC address
  -> Customer completes street and postal fields
  -> Customer clicks "Pin location"
  -> one Geoapify forward-geocoding request returns latitude/longitude
  -> a Geoapify map is created only after a result exists
  -> Customer may click the map or drag the local HTML pin
  -> Laravel validates and persists the address and coordinates
```

There is no provider-backed autosuggest request while the Customer types. PSGC data is the authority for Philippine administrative names, and the Customer reviews every field before requesting coordinates.

## PSGC address data

The shared dataset lives under:

```text
packages/psgc-address-data/data
```

Laravel exposes the hierarchy through the existing role-neutral and Seller-compatible endpoints. The browser controls use those endpoints, and the API reads the same shared package data locally. PSGC codes remain lookup keys; persist the existing address names unless a feature specification changes the schema.

## Geoapify usage

### Forward geocoding

The storefront calls this endpoint only after an intentional “Pin location” click:

```text
GET https://api.geoapify.com/v1/geocode/search
```

The query contains only the completed address text, is restricted to the Philippines with `filter=countrycode:ph`, requests one result, and does not include account, order, or unrelated personal data. A failure or no-result response must keep manual address entry and saving usable.

Changing a populated textual location field clears the stored coordinate pair and hides the old map. The Customer must pin again so stale coordinates are not saved with a changed address.

### Map and pin

Leaflet renders Geoapify raster map tiles. The map is created only after forward geocoding succeeds, avoiding tile requests when a Customer merely opens or edits the form. The pin is a local HTML element; do not call Geoapify Marker Icon API for the single address pin.

Clicking the map or dragging the pin updates latitude/longitude without rewriting textual address fields. Panning or zooming can load additional tiles, so the interface must explain this and avoid unnecessary map reinitialization or automatic camera movement.

## Coordinates and fallbacks

- Latitude and longitude are optional unless the affected feature explicitly requires them.
- Validate them as a complete numeric pair within `-90..90` and `-180..180`.
- Coordinates do not prove deliverability or replace the Customer-readable address.
- Address saving must remain usable when Geoapify is unconfigured, unavailable, returns no result, or the browser cannot render WebGL.
- Provider failures must not clear already entered text.
- Map interaction must not silently reverse-geocode or rewrite address fields.

## Credentials, privacy, and attribution

- `NEXT_PUBLIC_GEOAPIFY_API_KEY` is the public browser key for forward geocoding and map tiles. Restrict it to approved origins and only the required Geoapify APIs.
- Never commit credentials or put secret credentials in `NEXT_PUBLIC_*` variables.
- Keep Geoapify and OpenStreetMap attribution visible. Geoapify map styles include map attribution metadata; the surrounding form also shows provider links for the geocoding action.
- Serialize full addresses only to authorized consumers and avoid putting sensitive address text in logs.

## Free-plan and credit boundary

Pricing was rechecked against Geoapify’s official pages on **2026-09-02**:

- The Free plan includes **3,000 shared credits per day**, requires attribution, permits limited commercial use, and has no credit-card requirement.
- One forward-geocoding request costs **1 credit**.
- One map tile costs **0.25 credit** (four tiles per credit).
- Geoapify estimates about **14 tiles per initial interactive map view** (roughly 3.5 credits) and about **50 tiles per interactive session** (roughly 12.5 credits).
- A separately requested Marker Icon costs 1 credit, which this flow avoids by using a local HTML marker.

All approved Customer Address Book provider calls draw from the same 3,000-credit daily allowance. The architecture can cost $0 only while total daily geocoding and tile consumption stays within the current Free-plan terms. Monitor Geoapify usage and recheck pricing before capacity or release decisions.

## Credit-saving checklist

- Do not query while the Customer types or changes a PSGC dropdown.
- Require an intentional “Pin location” click for forward geocoding.
- Request one Philippine geocoding result.
- Do not create the map before geocoding succeeds.
- Clear/hide stale coordinates after textual address changes.
- Use a local HTML marker rather than the Marker Icon API.
- Keep one map instance while the pinned address is unchanged.
- Avoid automatic camera movements and explain that pan/zoom loads more tiles.
- Monitor daily credits and provider errors before raising traffic limits.

## Official references

- [Geoapify pricing](https://www.geoapify.com/pricing/)
- [Geoapify pricing details](https://www.geoapify.com/pricing-details/)
- [Geoapify Geocoding API](https://apidocs.geoapify.com/docs/geocoding/)
- [Geoapify map tiles](https://apidocs.geoapify.com/docs/maps/)
- [Geoapify map tiles with Leaflet](https://apidocs.geoapify.com/docs/maps/map-tiles/leaflet/)
