# Logistics shipping rate cards

API and frontend revision: 2026-10-03.

## WHAT

- Let each active Logistics organization publish its own base fee for first mile, linehaul, and last mile, plus weight/size extras keyed by the Shop's main Shop Category.
- Use the 14 canonical Shop Categories sellers select as their Shop's line of business. Product Categories remain catalog subcategories and do not receive separate Logistics rate rules.
- Keep platform tariff acceptance separate from the Logistics organization's own commercial rate card.
- Provide a dedicated Logistics Shipping rates workspace for platform-tariff acceptance, commercial service coverage, and immutable rate-card management.

## MUST

- Require an authenticated active Logistics account and derive its organization from the session.
- Create immutable numbered draft cards in PHP currency with an effective timestamp.
- Store one base-fee entry per offered service on a card, plus at most one weight/size rule per Shop Category and service type. Supported service types are `first_mile`, `linehaul`, and `last_mile`.
- Each service includes nonnegative integer `base_fee_cents`. Each Shop Category rule includes nonnegative incremental charges, positive included/increment weights, and positive maximum weight/dimensions. Rules may not set `base_charge_cents`; service base fees are separate. Size affects billable weight through the platform volumetric policy; dimension ceilings remain eligibility limits.
- Reject duplicate Shop Category/service pairs in one card. Require 1–3 unique `services[]` entries and at least one rule per offered service. The service types in `services[]` and `rules[]` must match exactly. Publish only a draft with complete service bases and rules.
- A Shop Order becomes one Parcel containing that Shop's items. The Shop has one main Shop Category; its Products may have different Product Categories. Add all item billable weights in the Parcel and rate the combined weight using the one matching Shop Category/service rule. Calculate that extra once per Parcel for each applicable service leg; the separate service base is also charged once per leg, including each linehaul hop.
- Apply the rule's maximum weight to the combined Parcel billable weight. Apply its maximum length, width, and height to the measured item packages in that Parcel.
- Publishing archives the organization's prior published card. Another organization cannot view, edit, or publish it.
- Checkout resolves the latest effective published card for each frozen route participant.
- Every Shop Order must have a matching Shop Category rule for each required service type on its route.
- Missing service bases or main-category rates make the route commercially unplanned and invoke the destination-surcharge-only fallback; discard all partial leg charges. Exceeded weight/dimension limits reject the quote instead of using fallback. Do not invent a Logistics charge.
- Rate-card changes after quote make placement stale. Changes after placement do not alter frozen Customer price or quoted leg weights.
- The protected `/shipping-rates` route appears in its own **Pricing & rates** sidebar group, separate from Settings and the account menu. Its platform tariff, service coverage, and rate-card views are keyboard-operable tabs whose selected view is URL-addressable.
- Service coverage means main Shop Category × service-leg coverage with a configured service base fee from the currently published rate card. Show service bases separately from main-category weight/size extras. Geographic postal coverage and hub connections remain owned by Sort plan and Linehaul.
- Create and edit rules in a modal launched from a readable rate-rule table. Keep the table's horizontal overflow contained at narrow widths. The modal must remain viewport-bounded, keyboard-operable, closable with Escape/cancel, and preserve draft values after validation errors.
- Put a circle-exclamation help control beside the rule field labels for service leg, included weight, additional weight step, extra per step, maximum weight, length, width, and height. Its tooltip must explain each field in plain language and work on hover and keyboard focus.
- Use the Logistics app's existing Flatpickr dependency and `FlatpickrInput` component for effective date/time selection. Keep date and time in one familiar calendar control and retain local datetime to UTC API conversion.
- Show loading, authoritative empty, retryable failure, validation, success, accepted/unaccepted tariff, draft/published/archived card, and future-effective coverage states in both supported themes.
- Convert operator-facing PHP, kilogram, and centimeter values to integer cents, grams, and millimeters before submission. Reject duplicate Shop Category/service pairs before sending and preserve server validation as authority.
- Publishing remains explicit. Drafts are immutable, a future-effective published card must be labeled as not currently effective, and historical cards remain readable. Existing Product Category rules remain visible as legacy history but do not satisfy new Shop Category coverage.

## HOW

- Persist headers in `logistics_rate_cards`, service bases in `logistics_service_rates`, and extras in `logistics_rate_rules`. Service rates uniquely key card/service. New rules use `shop_category_id`; nullable `category_id` is retained only for legacy Product Category rules. Service type remains a string column with a PHP enum cast.
- Use `GET /api/v1/logistics/rate-cards`, `POST /api/v1/logistics/rate-cards`, and `POST /api/v1/logistics/rate-cards/{card}/publish`. The index response includes active Shop Category options in `meta.shop_categories`.
- `ShippingQuotationService` resolves the Shop's main category from the Shop Order, sums the billable weights of its item lines, and applies one matching category rule on each required service leg.
- Freeze rate-card revision, service-rate ID/base, main Shop Category ID, category rule IDs, incremental charges, leg owner, service type, hub endpoints, and full quoted charge in the Order pricing snapshot.
- A pre-existing card with only Product Category rules is preserved for history, but it has no main Shop Category coverage for new quotes. Publish a successor rate card with Shop Category rules to restore planned coverage. Existing placed Orders and their pricing snapshots remain unchanged.
- Verify organization isolation, duplicate rules, publish transitions, effective-date selection, main-category coverage, combined multi-item weights across distinct Product Categories, one category extra per parcel/service leg, weight increments, dimensional ceilings, and stale checkout behavior.
- The Logistics SPA implements the route in `pages/ShippingRatesPage.tsx` with focused tariff, coverage, rate-card, rate-rule table, and rate-rule modal components under `features/shippingRates/`.

### API and frontend revision — 2026-10-03

- Rate-card creation accepts `shop_category_id` for every rule and rejects the legacy `category_id` input. The index returns active main Shop Categories under `meta.shop_categories`.
- The rate-card form shows one row per Shop Category/service rule. Add and edit use a modal with field-level validation and concise circle-exclamation tooltips. The effective date and time use the existing Flatpickr calendar/time control.
- Main-category coverage counts only rules using `shop_category_id`. Existing Product Category rule rows stay visible in card history and are labeled as legacy; they cannot price a new Shop Order.
- Customer/Seller quote and checkout response shapes remain unchanged. Existing Orders continue using their frozen prices.
