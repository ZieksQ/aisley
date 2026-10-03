# Logistics shipping rate cards

API and frontend revision: 2026-10-03.

## WHAT

- Let each active Logistics organization publish its own base fee for first mile, linehaul, and last mile, plus category-based weight/size extra charges.
- Key charges by Product category and measured parcel constraints without requiring origin/destination area matrices.
- Keep platform tariff acceptance separate from the Logistics organization's own commercial rate card.
- Provide a dedicated Logistics Shipping rates workspace for platform-tariff acceptance, commercial service coverage, and immutable rate-card management.

## MUST

- Require an authenticated active Logistics account and derive its organization from the session.
- Create immutable numbered draft cards in PHP currency with an effective timestamp.
- Store one base-fee entry per offered service on a card, plus one extra-charge rule per Product category and service type. Charge that base once per route leg, including each linehaul hop, regardless of category count.
- Supported service types are `first_mile`, `linehaul`, and `last_mile`.
- Each service includes nonnegative integer `base_fee_cents`. Each category rule includes nonnegative increment charges, positive included/increment weights, and positive maximum weight/dimensions. Rules may not set `base_charge_cents`; service base fees are separate. Size affects billable weight through the platform volumetric policy; dimension ceilings still reject unsupported parcels.
- Reject duplicate category/service pairs in one card.
- Require 1–3 unique `services[]` entries and at least one category rule. The service types in `services[]` and `rules[]` must match exactly; reject missing bases, duplicate services, and offered services without category rules. Publish only a draft with complete service bases and at least one rule.
- Publishing archives the organization's prior published card; another organization cannot view, edit, or publish it.
- Checkout resolves the latest effective published card for each frozen route participant.
- Every ordered Product category must have a matching rule for the participant's service type.
- Missing service bases or category rates make the route commercially unplanned and invoke the destination-surcharge-only fallback; discard all partial leg charges. Exceeded weight/dimension limits reject the quote instead of using fallback. Do not invent a Logistics charge.
- Rate-card changes after quote make placement stale. Changes after placement do not alter frozen Customer price or quoted leg weights.
- The protected `/shipping-rates` route appears in its own **Pricing & rates** sidebar group, separate from Settings and the account menu. Its platform tariff, service coverage, and rate-card views are keyboard-operable tabs whose selected view is URL-addressable.
- Service coverage means commercial category × service-leg coverage with a configured service base fee from the currently published rate card. Show service bases separately from category weight/size extras. Geographic postal coverage and hub connections remain owned by Sort plan and Linehaul; this workspace must not invent an origin/destination matrix.
- Show loading, authoritative empty, retryable failure, validation, success, accepted/unaccepted tariff, draft/published/archived card, and future-effective coverage states in both supported themes.
- Convert operator-facing PHP, kilogram, and centimeter values to integer cents, grams, and millimeters before submission. Reject duplicate category/service pairs before sending and preserve server validation as authority.
- Publishing remains explicit. Drafts are immutable, a future-effective published card must be labeled as not currently effective, and historical cards remain readable.

## HOW

- Persist headers in `logistics_rate_cards`, service bases in `logistics_service_rates`, and category extras in `logistics_rate_rules`. Service rates uniquely key card/service; the service type is a string column with a PHP enum cast.
- Store status and service type as DB strings with PHP enum casts.
- Use `GET /api/v1/logistics/rate-cards`, `POST /api/v1/logistics/rate-cards`, and `POST /api/v1/logistics/rate-cards/{card}/publish`; the index response includes active category options in `meta.categories` for the editor.
- `ShippingQuotationService` charges the service base once per leg, groups measured Order lines by category, and adds each matching category’s weight/size increment charge.
- Freeze rate-card revision, service-rate ID/base, category rule IDs, incremental charges, leg owner, service type, hub endpoints, and full quoted charge in the Order pricing snapshot.
- Test organization isolation, duplicate rules, publish transitions, effective-date selection, category coverage, weight increments, dimensional ceilings, and stale checkout behavior.
- The Logistics SPA implements the route in `pages/ShippingRatesPage.tsx` with focused tariff, coverage, rate-card, and draft-form components under `features/shippingRates/`.

### API and frontend revision — 2026-10-03

- Read the [shipping frontend handoff](../../shared/shipping-quotation/spec.md#frontend-handoff) for the exact `services[]` payload and all affected screens.
- The frontend removes platform-base displays from tariff acceptance/history, replaces per-category base inputs with one service base per offered service, and renders card history and coverage with `services[]` separately from category extras.
- Existing card/service bases are backfilled from the highest legacy category base per service. No published card or placed Order is rewritten. An organization changes these amounts by publishing a successor card.
