---
feature: address-book
title: Customer Address Book
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented foundation; order mutation integration deferred
role: Customer
scope: Customer storefront and Laravel API
---

# Customer Address Book

## WHAT

- **Purpose:** Let an authenticated Customer save, edit, delete, label, default, and select reusable shipping/billing addresses.
- **Current implementation:** Customer-scoped list/create/update/delete APIs, transactional default handling, the protected `/account/addresses` page, checkout selection, PSGC cascading fields, optional Geoapify pinning, and immutable checkout snapshots exist.
- One Customer has many Address rows. A saved row is mutable profile data; a placed Order owns an independent delivery snapshot.
- Address fields and manually reviewed PSGC names are authoritative. Optional coordinates are confirmed location metadata, not proof of serviceability.
- Logistics/Courier must consume the Order snapshot, never the Customer's current default Address Book row.
- **Non-goals:** delivery-zone decisions, shipping fees, route optimization, hub selection, courier assignment, live parcel tracking, or changing an existing Order outside the Order Modification contract.

```text
Customer opens /account/addresses
→ list saved rows
→ add/edit/delete or select a shipping-capable row
→ optional Pin location
→ checkout submits address_id
→ Laravel revalidates and copies the row into order_addresses
```

## MUST

### Authentication and ownership

- Require `auth:sanctum` and `customer.active` for every Address Book API and protected page.
- Derive ownership from the authenticated Customer. Reject any client `user_id`, `customer_id`, Shop, Seller, or Order owner field.
- Scope list, create, update, delete, and checkout selection through the Customer's `addresses` relationship.
- Return `401` for guests, `403` for wrong role/inactive status, `404` for a non-owned UUID, and `422` for invalid fields. Do not reveal another Customer's address existence.

### Address data and validation

- The current string-backed `AddressType` is `shipping`, `billing`, or `both`; a row may be eligible for both uses.
- Required fields are recipient name, contact number, address line 1, barangay, city/municipality, province, region, postal code, and country. Address line 2 and label are optional. `latitude` and `longitude` are optional but must arrive as a complete valid pair.
- Trim safe text and validate lengths, country, coordinate ranges, and any configured contact/postal rules server-side. Client validation is convenience only.
- Use Region → Province → City/Municipality → Barangay searchable cascading fields from the bundled `@aisley/psgc-address-data` package. Parent changes clear incompatible descendants.
- PSGC codes, provider IDs, autocomplete payloads, and map tile data are lookup/rendering aids; persist the reviewed names and optional coordinates, not provider identity.
- Duplicate human-readable addresses are allowed unless a separately approved deduplication policy exists.

### Provider and pin authority

- Manual entry remains available if local PSGC data, Geoapify, or map tiles are unavailable.
- Do not call a provider while the Customer types or selects PSGC values. After the Customer clicks **Pin location**, make one Philippines-scoped Geoapify forward-geocoding request for the completed address.
- Geoapify may provide only a latitude/longitude pair. It must not silently rewrite the Customer's reviewed address fields, claim deliverability, or select a shipping zone.
- The interactive pin uses Leaflet with Geoapify raster tiles; the Customer may click or drag the local marker to refine coordinates. Mapbox is not used.
- Restrict the public Geoapify key to the storefront origin, show Geoapify/OpenStreetMap/OpenMapTiles attribution, and never persist provider credentials or suggestion IDs.
- Changing a populated location field clears stale coordinates until the Customer pins again.

### Defaults, CRUD, and privacy

- A Customer may create multiple rows. `is_default` is updated in the same transaction as the row; a shipping default clears overlapping `shipping`/`both` rows, a billing default clears `billing`/`both`, and a `both` default clears all other defaults.
- There is no separate default route in the current API; create/update with `is_default` is the authoritative operation. The list returns defaults first, then newest rows.
- Update/delete affect only the Address Book row. Deleting or editing a row never rewrites historical Order snapshots. Checkout detects a deleted/stale selected row and requires another eligible address.
- The protected account UI requires delete confirmation and displays type, label, recipient/contact, summary, and whether a pin is saved. Sensitive address data is not logged or exposed to unrelated users.
- A Seller/Logistics/Courier may receive only the address snapshot required by an authorized Order/task. Do not expose a Customer's whole Address Book.

### Checkout and future Order changes

- Checkout accepts only a Customer-owned `address_id` with `shipping` or `both`, revalidates completeness/serviceability, and snapshots all required delivery fields plus optional coordinates into `order_addresses` in the same transaction as the Order.
- The snapshot retains a nullable source-address reference for traceability but never reads the mutable source for delivery.
- The Customer Order Modification feature, not Address Book, updates an already-placed Order snapshot during its approved pre-Seller-processing window. Its delivery-address endpoint accepts only an existing shipping-capable Address Book row; Address Book CRUD itself never edits an Order snapshot.
- After Seller accepts an Order (`placed → seller_processing`), Address Book edits cannot reroute it; post-pickup changes and returns/refunds are deferred.

### UX, accessibility, and acceptance

- Show loading, empty, loaded, validation, forbidden/session, save, delete-confirmation, stale/deleted, Geoapify failure, map-unavailable, and retry states. Never claim success before Laravel persistence.
- Forms use semantic labels, field-level errors, keyboard-operable comboboxes, visible focus, announcements for pin/errors, and non-color-only default/type cues.
- [x] Guests and wrong-role/inactive sessions cannot manage addresses.
- [x] Customer CRUD is ownership-scoped and rejects forged owner IDs.
- [x] Defaults are serialized transactionally and overlapping defaults are cleared.
- [x] PSGC fields use bundled local data with manual fallback; no Customer dropdown request depends on a remote address API.
- [x] Pin location performs optional Geoapify forward geocoding and supports a Leaflet click/drag pin without Mapbox.
- [x] Checkout and placed Orders use immutable address snapshots.
- [x] Delivery-address changes on an already-placed Order are implemented by Customer Order Modification, with a new immutable snapshot version; item, quantity, and repricing changes remain deferred.

## HOW

### Current interfaces and implementation

- API routes are `GET/POST /api/v1/customer/addresses`, `PATCH /api/v1/customer/addresses/{address}`, and `DELETE /api/v1/customer/addresses/{address}` under `auth:sanctum` + `customer.active`.
- Laravel uses `AddressController`, `AddressService`, `StoreAddressRequest`, `UpdateAddressRequest`, and `AddressResource`; `AddressService` locks the Customer row and clears overlapping defaults transactionally.
- The existing `addresses` migration/model stores UUID ownership, string-backed type, normalized fields, optional decimal coordinates, and `is_default`; do not edit the executed migration.
- The Webapp uses `/account/addresses`, `AddressBookContent`, `AddressForm`, `PsgcAddressFields`, `GeoapifyLocationPicker`, and shared checkout client/types. Checkout links back to this page for selection.
- PSGC data is loaded from `@aisley/psgc-address-data/data`; the Customer UI does not call `/api/v1/address-options/*` for its dropdowns.

### Data flow and tests

- Create/update: validate → normalize → lock Customer → clear overlapping defaults if requested → persist → return safe Resource. Delete follows the same ownership lock.
- Pin: validate completed fields locally → one `filter=countrycode:ph`/`limit=1` Geoapify request → save only coordinates after Customer review/refinement.
- Checkout: resolve `address_id` through Customer scope → revalidate → copy required fields into `order_addresses` before commit.
- API tests cover ownership, role/status gates, fields/coordinates, default races, CRUD, checkout selection, and snapshot independence. Storefront checks cover combobox keyboard behavior, map fallback, pin invalidation, retry, and accessible errors.
- Follow `docs/workspace.md`, `docs/schema.md`, `docs/domains/Buyer.md`, and [`docs/references/user-registration-requirements.md`](../../../references/user-registration-requirements.md). The repository has no separate `docs/maps-location-api.md`; the shared workspace/schema provider contract is authoritative.
