---
feature: address-book
title: Customer / Buyer Address Book
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Address Book

## WHAT
- **Purpose:** Let authenticated Buyers save and manage multiple reusable shipping and billing addresses for faster checkout.
- **Canonical role:** `BUYER`.
- **Source-defined capabilities:**
  - save multiple addresses
  - manage shipping and billing addresses
  - categorize addresses such as `Home` or `Office`
  - quickly select an address during checkout
  - optionally validate/geographically verify addresses for more accurate logistics routing
- **Source-defined data relationship:** one Buyer has many Address records.
- **Architecture:**
  - Next.js/React owns address list/forms, selection UI, validation feedback, and checkout integration.
  - Laravel owns authentication, Buyer ownership, validation, normalization, persistence, address selection rules, and integration with checkout/order workflows.
  - Laravel/Eloquent data is authoritative.
- **Recommended route:**
```text
/account/addresses
```
or the Customer Account route convention selected by the project.
- **Recommended core flow:**
```text
Buyer opens Address Book
→ view saved addresses
→ add / edit / delete an address
→ optionally label it Home / Office / custom label
→ checkout
→ select saved shipping/billing address
→ Laravel validates selected Buyer-owned address
→ checkout snapshots required address fields into the order
```
- **Important boundary:** saved Address Book records are reusable profile data; placed orders must preserve the delivery/billing address used for that order.
- **Feature boundaries:**
  - Customer Auth establishes the authenticated Buyer.
  - View Cart/Checkout selects an eligible saved address.
  - Order Modification/Cancellation owns changing an already-placed order address within its allowed pre-processing window.
  - Logistics/Courier consume the order's delivery destination, not a live mutable Address Book record.
- **Non-goals:**
  - defining shipping fees
  - choosing logistics sorting centers
  - live courier routing
  - geofencing delivery zones
  - changing an order address outside the Order Modification rules
  - making Google Maps mandatory
  - inventing country-specific address fields not established by the project

## MUST
### Authentication and ownership
- Address Book requires an authenticated `BUYER`.
- Every Address record is scoped by the authenticated Buyer ID.
- Laravel must never trust a client-supplied `buyer_id`.
- A Buyer must not:
  - list another Buyer's addresses
  - view another Buyer's address
  - update another Buyer's address
  - delete another Buyer's address
  - use another Buyer's address during checkout
- Use scoped Eloquent relationship queries or equivalent ownership enforcement.
- Return project-standard:
  - `401` unauthenticated
  - `403` forbidden when appropriate
  - `404` when a Buyer-scoped address does not exist
  - `422` validation failure
  - `409` stale/conflicting update when applicable

### Address collection
- Buyer may store multiple addresses.
- The source explicitly requires a one-to-many relationship:
```text
Buyer
└── Addresses[]
```
- Address collection size limit is not defined by the source.
- Do not invent a maximum unless product/performance requirements establish one.
- Address list does not require pagination for a small bounded personal collection unless the project later permits unusually large collections.

### Address fields
- The source does not define the exact address schema.
- Required fields must come from the selected country/checkout requirements.
- A conceptual address may need:
  - recipient/full name
  - contact number
  - street/address line
  - locality/city/municipality
  - region/province/state
  - postal code when applicable
  - country/region code
  - label/category
- These fields are recommendations, not source-defined mandatory names.
- Do not hard-code a country-specific hierarchy until the project address requirements establish it.
- Laravel remains authoritative for required-field validation.

### Labels/categories
- Source explicitly supports categorization such as:
```text
Home
Office
```
- Labels are for Buyer convenience.
- Exact label behavior is Open:
  - predefined only
  - custom text allowed
  - both
- Labels must not control delivery eligibility.
- Validate label length/content server-side.

### Shipping vs billing
- Source explicitly says Address Book supports both shipping and billing addresses.
- The model may represent this by:
  - address type flags
  - separate default references
  - checkout-time usage without storing type
- Exact persistence strategy is Open.
- One saved address may be eligible for both shipping and billing if product requirements allow it.
- Do not duplicate identical records solely because one is used for shipping and billing unless the schema intentionally requires this.

### Default addresses
- The source does not explicitly require a default shipping/billing address.
- Defaults are recommended for faster checkout but remain optional.
- If implemented:
  - at most one default shipping address per Buyer
  - at most one default billing address per Buyer
  - a single record may be both defaults
  - default changes must be transactional
- Deleting a default address must follow a defined fallback:
  - clear the default, or
  - select another eligible address
- Do not silently select a replacement unless the product explicitly defines that behavior.

### Create address
- Conceptual endpoint:
```http
POST /api/buyer/addresses
```
- Laravel must:
  1. authenticate Buyer
  2. validate fields
  3. normalize safe address components
  4. optionally run configured address validation
  5. create the Address using authenticated Buyer ownership
  6. apply default rules if supported
  7. return a safe Address Resource
- The client cannot set another owner.
- Duplicate addresses are allowed unless the product explicitly wants duplicate detection.
- If duplicate detection is added, it must not prevent legitimate similar addresses such as different units in one building.

### Update address
- Conceptual endpoint:
```http
PATCH /api/buyer/addresses/{address}
```
- Resolve the Address through authenticated Buyer scope.
- Validate changed fields server-side.
- Update only Address Book data.
- Editing a saved address must **not retroactively mutate addresses stored on previously placed orders**.
- If the address is selected by an in-progress checkout, checkout revalidates it before order placement.
- Concurrent stale edits may use `409` or the project's normal update strategy.

### Delete address
- Conceptual endpoint:
```http
DELETE /api/buyer/addresses/{address}
```
- Resolve through Buyer scope.
- Require confirmation in the UI.
- Deleting an Address Book record must not delete or rewrite:
  - historical orders
  - waybills
  - delivery records
  - dispute evidence
- If a cart/checkout currently references the address:
  - checkout must detect the missing address
  - Buyer must select/enter another eligible address before placing the order
- Whether Address Book uses hard delete or soft delete is an implementation choice.
- Historical order address data must remain independent either way.

### Checkout integration
- View Cart/Checkout owns final address selection.
- Checkout must accept an Address ID/reference only from the authenticated Buyer's Address Book.
- Laravel must resolve and validate that address server-side.
- Never trust a complete client-supplied address snapshot as proof that it belongs to the Buyer.
- Checkout may allow entering a new address and optionally saving it to Address Book if the final Checkout spec defines that behavior.
- "Save this address" behavior is not source-defined and remains Open.

### Order address snapshot
- When an order is placed, persist the delivery/billing address needed for that order independently from the mutable Address Book record.
- Recommended conceptual flow:
```text
Address Book record
→ selected during checkout
→ copy normalized required fields into order/order-address snapshot
→ later Address Book edits do not alter placed order
```
- The order may retain the source `address_id` for traceability, but delivery must not depend on reading the current mutable Address record.
- Snapshot fields must be sufficient for Seller/Logistics/Courier fulfillment.
- Exact order-address schema belongs to Checkout/Order domain.

### Order modification integration
- Buyer source allows changing shipping address during a strict pre-processing window. fileciteturn31file0
- Address Book provides candidate addresses.
- Order Modification/Cancellation decides whether the order is still eligible to change destination.
- An eligible modification must update the **order's address snapshot** through the Order domain.
- It must not mutate the selected Address Book record merely to change one order.
- Once the order has crossed the allowed processing state/time boundary, Address Book edits cannot reroute it.

### Logistics / Courier handoff
- Logistics and Courier must receive the address/destination attached to the order.
- They must not resolve a delivery destination by reading the Buyer's current default Address Book entry.
- This preserves historical correctness and prevents mid-delivery mutation.
- Address changes allowed by Order Modification must propagate through the authoritative order workflow before logistics fulfillment advances.

### Validation
- Laravel Form Request or equivalent dedicated validator owns address validation.
- Client-side validation is convenience only.
- Validate:
  - required fields
  - field length
  - accepted country/region codes when constrained
  - postal code format when applicable
  - contact data format where required
- Do not claim an address is physically deliverable solely because its text format is valid.
- Delivery-zone eligibility belongs to logistics/shipping rules.

### Optional external address assistance
- `Buyer.md` recommends geospatial validation or a maps/address API such as Google Maps. fileciteturn30file1 The project implementation uses Geoapify for address autocomplete and Mapbox GL JS for map rendering.
- Geoapify Address Autocomplete may suggest structured address components and coordinates from partial Customer input.
- Use HTTPS, restrict the public Geoapify browser key by allowed storefront URLs, and filter suggestions to the supported country when known.
- Treat suggestions as Customer-confirmable input, not proof that an address is complete, correct, deliverable, or inside a shipping zone.
- Manual entry must remain available when Geoapify is unconfigured, unavailable, or has no suitable result.
- Selected Geoapify results supply the stored address components and coordinate pair. The application must not call Mapbox Geocoding API or Search Box API for autocomplete, forward geocoding, or reverse geocoding.
- Show Geoapify attribution in the search experience and retain the embedded map's required Mapbox/data-provider attribution controls.

### Geolocation coordinates
- Latitude/longitude is optional unless Logistics/zone mapping requires it.
- If external validation/geocoding returns coordinates:
  - treat them as derived location metadata
  - preserve the human-readable address
  - do not silently replace Buyer-entered data without confirmation when changes are material
- Exact geospatial storage format is Open.
- Do not assume coordinates alone are sufficient for delivery instructions.

### Delivery instructions
- The source does not explicitly define gate codes/landmarks/delivery notes as Address Book fields.
- Courier source mentions address clarifications and gate codes in Chat, but that does not automatically make them Address Book requirements.
- Delivery instructions may be added only if Checkout/Delivery requirements establish them.
- Sensitive access codes should not be exposed more broadly than necessary.

### Privacy
- Address records contain sensitive location/contact data.
- Serialize only fields required by the Buyer UI and authorized checkout/logistics flows.
- Do not expose Buyer addresses to unrelated Sellers/users.
- Seller/Logistics/Courier access to delivery address must be tied to an authorized order/task and limited to what fulfillment requires.
- Do not put full addresses in logs unnecessarily.
- Follow the project requirement to mask sensitive location/contact data where appropriate. fileciteturn30file2

### Concurrency and defaults
- Address edits are low-contention but can conflict across devices/tabs.
- Default-address changes, if implemented, must preserve the one-default invariant.
- Use a transaction for operations that:
  - unset one default
  - set another default
- If the record changed/deleted since the UI loaded, return current project conflict/not-found behavior.

### Frontend states
- Address list:
  - loading
  - empty
  - loaded
  - error
  - forbidden/unauthenticated
- Address form:
  - idle
  - validating
  - submitting
  - validation error
  - external-validation suggestion/confirmation if enabled
  - success
  - failure
- Delete/default change:
  - confirmation
  - submitting
  - success
  - failure
- Checkout selection:
  - selected
  - unavailable/deleted
  - validation error
- Do not optimistically persist ownership/default state before Laravel confirms it.

### Accessibility
- Address forms require semantic labels and field-level errors.
- Group region/locality/postal fields logically.
- Saved-address cards must be keyboard navigable.
- Default/type state cannot rely on color alone.
- Delete confirmation must identify the address label/summary.
- Address suggestions/validation corrections must be announced accessibly.

### Acceptance criteria
- [ ] Guest cannot manage Buyer Address Book.
- [ ] Buyer can list only their own addresses.
- [ ] Buyer can create multiple addresses.
- [ ] Buyer can edit only their own address.
- [ ] Buyer can delete only their own address.
- [ ] Client cannot assign `buyer_id`.
- [ ] Home/Office/custom-label behavior follows the selected label policy.
- [ ] Shipping/billing usage follows approved model rules.
- [ ] Default-address invariants hold when defaults are enabled.
- [ ] Checkout rejects an Address ID owned by another Buyer.
- [ ] Checkout rejects a deleted/unavailable Address.
- [ ] Placed order contains an address snapshot independent of later Address Book edits.
- [ ] Editing/deleting Address Book entries does not rewrite historical orders.
- [ ] Order address changes occur only through Order Modification rules.
- [ ] Logistics/Courier use the order destination, not the current Buyer default address.
- [ ] External map/address validation is optional and failure does not corrupt saved data.
- [ ] Address API keys/secrets never appear in browser bundles when server-side validation is used.
- [ ] Sensitive address/contact data is scoped and serialized minimally.
- [ ] UI handles empty, validation, delete, unavailable, and external-validation states.

## HOW
### Project findings
- `Buyer.md` explicitly defines Address Book as saving/managing multiple shipping and billing addresses, categorizing them (e.g. Home/Office), and rapidly selecting them at checkout. fileciteturn30file1
- It explicitly recommends an `Addresses` table with a one-to-many relationship to Buyer and optionally geospatial/API validation. fileciteturn30file1
- Buyer Order Modification/Cancellation separately allows changing shipping address only within a strict pre-processing window. fileciteturn31file0
- `README.md` requires Laravel-owned validation/authorization, Buyer scoping, safe location serialization, and no direct Next.js database access. fileciteturn30file2turn31file9
- Exact address fields, defaults, validation provider, country hierarchy, geospatial schema, and checkout-save behavior are not defined.

### Laravel data model
Recommended conceptual schema:
```text
addresses
- id
- buyer_id
- label nullable
- recipient_name
- contact_number
- address_line_1
- address_line_2 nullable
- locality
- region
- postal_code nullable
- country_code
- latitude nullable
- longitude nullable
- is_default_shipping optional
- is_default_billing optional
- created_at
- updated_at
```
- Field names are conceptual; use actual project address requirements.
- Eloquent supports the source-required one-to-many `hasMany` relationship. citeturn875176search1turn875176search3
- Address belongs to one Buyer.
- Add indexes for `buyer_id` and any default/lookup fields actually used.

### Laravel API
Conceptual endpoints:
```http
GET    /api/buyer/addresses
POST   /api/buyer/addresses
GET    /api/buyer/addresses/{address}
PATCH  /api/buyer/addresses/{address}
DELETE /api/buyer/addresses/{address}
POST   /api/buyer/addresses/{address}/default-shipping   # optional
POST   /api/buyer/addresses/{address}/default-billing    # optional
```
- Use Form Requests.
- Use `AddressPolicy` or Buyer-scoped route/model lookup.
- Use API Resources.
- Suggested services/actions:
  - `CreateBuyerAddress`
  - `UpdateBuyerAddress`
  - `DeleteBuyerAddress`
  - `SetDefaultBuyerAddress` if defaults exist
  - optional `ValidateDeliveryAddress`
- Keep controllers thin.

### Ownership queries
- Prefer authenticated Buyer relationship access:
```text
buyer->addresses()
```
rather than global lookup followed by client ownership checks.
- Laravel Eloquent directly supports one-to-many ownership relationships. citeturn875176search1
- Policy checks remain useful for explicit resource authorization.

### Checkout handoff
- Checkout receives an Address ID.
- Laravel:
  1. resolves it through authenticated Buyer scope
  2. validates eligibility
  3. optionally revalidates address/serviceability
  4. snapshots required fields into the order
  5. proceeds with the checkout transaction
- This keeps Address Book reusable while preserving historical order destinations.

### Optional Geoapify autocomplete and Mapbox map integration
- The Address Book Client Component calls Geoapify Address Autocomplete over HTTPS after the Customer enters enough search text.
- Use `filter=countrycode:ph` for the current Philippines address form, debounce requests, cancel stale requests, and keep result counts bounded.
- `NEXT_PUBLIC_GEOAPIFY_API_KEY` is a public browser key. Restrict it by allowed storefront URLs in the Geoapify dashboard.
- Map the selected Geoapify result into the existing address fields and its `lat`/`lon` into latitude/longitude, then require the Customer to review the populated values.
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is a public browser token used only by Mapbox GL JS. Restrict it by allowed storefront URLs and only the required Maps APIs in the Mapbox dashboard.
- The embedded Mapbox GL JS map provides a clickable and draggable pin; pin movement updates the coordinate pair without silently rewriting the Customer-reviewed address text.
- Selecting a Geoapify result moves the Mapbox pin to the returned longitude/latitude. Mapbox receives the coordinate only for client-side map positioning; no Mapbox Geocoding API or Search Box API request is made.
- Geoapify suggestions and Mapbox pins do not replace Laravel validation, Customer ownership checks, checkout revalidation, or future logistics serviceability rules.

### Next.js / React
- Build:
  - Address Book page
  - address card/list
  - create/edit form
  - delete confirmation
  - optional default selectors
  - optional validation-suggestion confirmation
- Use shared Laravel API client.
- Address form may be a Client Component due to interactive form state/maps/autocomplete.
- Keep authoritative validation and ownership in Laravel.
- Checkout consumes the same address DTO/selector rather than duplicating address storage.

### Tests
- **Laravel:** auth/role denial; Buyer ownership isolation; create/update/delete; field validation; default uniqueness when enabled; cross-Buyer access denial; checkout scoped-address selection; order snapshot independence; deleted-address checkout failure; optional external-validator success/failure/timeout.
- **Frontend:** empty/list states; create/edit validation; delete confirmation; default selection; checkout selector; stale/deleted address; external correction confirmation; accessibility.

### Research-backed recommendations
- Use the source-required Buyer `hasMany` Address relationship. Laravel natively supports one-to-many Eloquent relationships. citeturn875176search1turn875176search3
- Keep an order-time address snapshot instead of treating the mutable Address Book row as historical delivery truth.
- Treat external address assistance as optional. Geoapify autocomplete and Mapbox map rendering each add separate quotas, billing thresholds, latency, attribution, and provider-availability considerations.
- Ask the Buyer to review populated address components rather than silently treating an external suggestion as authoritative.

### Risks
- **Ownership leak:** global Address lookup can expose another Buyer's location.
- **Historical mutation:** live Address references can silently reroute old/current orders after edits.
- **Bad routing:** format-valid addresses may still be inaccurate or undeliverable.
- **External dependency:** map/address APIs add billing, quotas, latency, and policy constraints.
- **Overvalidation:** automatically replacing addresses may introduce wrong locations.
- **Default race:** concurrent default changes can produce multiple defaults without transactional enforcement.
- **Schema mismatch:** inventing a country-specific address hierarchy now may conflict with final registration/checkout requirements.
- **Privacy:** full residential addresses are sensitive user data.

### Open questions
- Exact address fields and supported countries/regions.
- Whether the project uses province/municipality/barangay or another hierarchy.
- Whether users can create custom labels.
- Whether default shipping and billing addresses are required.
- Whether checkout can enter a one-time address without saving it.
- Whether checkout can save a newly entered address automatically/optionally.
- Whether billing address can differ from shipping address.
- Whether Geoapify remains the long-term autocomplete provider and Mapbox remains the long-term map provider.
- Whether latitude/longitude is persisted.
- Delivery-serviceability/zone validation ownership.
- Address Book record limit.
- Hard delete vs soft delete.
- Exact contact-number/recipient-name handling.
- Whether delivery notes/landmarks/gate codes belong here or Checkout.
- How Order Modification selects/revalidates a replacement address.

### Current Address Book and checkout implementation (2026-08-31)

- Active Customers can list, create, update, and delete only their own saved addresses through `/api/v1/customer/addresses`; the Address Book is available at `/account/addresses`.
- Create/update accepts the existing `shipping`, `billing`, or `both` string-backed `AddressType`, validates all normalized address fields, prohibits owner assignment, and accepts latitude/longitude only as a complete valid pair.
- Setting a new default is serialized transactionally and clears an overlapping shipping/billing default supported by the existing single `is_default` field.
- Checkout displays only its currently selected shipping-capable default/first address and links to the separate Address Book for adding, editing, deleting, or selecting another address, preventing a large saved collection from crowding checkout.
- `NEXT_PUBLIC_GEOAPIFY_API_KEY` optionally enables Geoapify Address Autocomplete, while `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` independently enables only the embedded Mapbox GL JS pin picker on the Address Book form.
- Geoapify autocomplete requests are debounced, stale requests are cancelled, results are limited and filtered to the Philippines, and the suggestion list supports keyboard selection.
- A chosen Geoapify suggestion may populate the street, barangay/locality, city/municipality, province, region, postal code, country, latitude, and longitude already present in the schema. Customers must review the populated fields; manual entry remains available when Geoapify is unconfigured or unavailable.
- Autofill maps only matching structured levels (`suburb` to Barangay, `city`/`municipality` to City or Municipality, `county` to Province, and `state` to Region). It does not substitute adjacent administrative levels, and a new selection clears unavailable location components so values from an older selection cannot remain mixed into the new address.
- Geoapify-provided coordinates center the embedded Mapbox map and position its pin. The storefront does not call Mapbox Geocoding API or Search Box API, so persisted coordinates are not Mapbox geocoding results.
- The Customer may click the embedded map or drag its pin to refine longitude/latitude. Coordinates are cleared when a populated location component is manually changed, preventing stale coordinates from being saved with edited text.
- No serviceability decision, shipping-zone rule, routing behavior, or logistics selection was added.

### Sources
- Project rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- Laravel Eloquent relationships: https://api.laravel.com/docs/12.x/Illuminate/Database/Eloquent/Concerns/HasRelationships.html
- Geoapify Address Autocomplete API: https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/
- Geoapify pricing: https://www.geoapify.com/pricing/
- Mapbox GL JS: https://docs.mapbox.com/mapbox-gl-js/guides/
- Mapbox GL JS pricing: https://docs.mapbox.com/mapbox-gl-js/guides/pricing/
- Mapbox attribution guidance: https://docs.mapbox.com/help/getting-started/attribution/
