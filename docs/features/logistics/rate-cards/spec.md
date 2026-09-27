# Logistics shipping rate cards

## WHAT

- Let each active Logistics organization publish its own extra charges for first mile, linehaul, and last mile.
- Key charges by Product category and measured parcel constraints without requiring origin/destination area matrices.
- Keep platform tariff acceptance separate from the Logistics organization's own commercial rate card.
- Provide one Logistics shipping-settings workspace for platform-tariff acceptance, commercial service coverage, and immutable rate-card management.

## MUST

- Require an authenticated active Logistics account and derive its organization from the session.
- Create immutable numbered draft cards in PHP currency with an effective timestamp.
- Store one rule per Product category and service type on a card.
- Supported service types are `first_mile`, `linehaul`, and `last_mile`.
- Each rule includes nonnegative base/increment charges, positive included/increment weights, and positive maximum weight/dimensions.
- Reject duplicate category/service pairs in one card.
- Publish only a draft with at least one rule.
- Publishing archives the organization's prior published card; another organization cannot view, edit, or publish it.
- Checkout resolves the latest effective published card for each frozen route participant.
- Every ordered Product category must have a matching rule for the participant's service type.
- Missing or exceeded route rates make the route commercially unplanned and invoke the platform base/region fallback; do not invent a Logistics charge.
- Rate-card changes after quote make placement stale. Changes after placement do not alter frozen Customer price or quoted leg weights.
- The protected `/settings` dashboard route separates platform tariff, service coverage, and rate-card history into keyboard-operable tabs whose selected view is URL-addressable.
- Service coverage means commercial category × service-leg coverage from the currently published rate card. Geographic postal coverage and hub connections remain owned by Sort plan and Linehaul; Settings must not invent an origin/destination matrix.
- Show loading, authoritative empty, retryable failure, validation, success, accepted/unaccepted tariff, draft/published/archived card, and future-effective coverage states in both supported themes.
- Convert operator-facing PHP, kilogram, and centimeter values to integer cents, grams, and millimeters before submission. Reject duplicate category/service pairs before sending and preserve server validation as authority.
- Publishing remains explicit. Drafts are immutable, a future-effective published card must be labeled as not currently effective, and historical cards remain readable.

## HOW

- Persist headers in `logistics_rate_cards` and rules in `logistics_rate_rules`.
- Store status and service type as DB strings with PHP enum casts.
- Use `GET /api/v1/logistics/rate-cards`, `POST /api/v1/logistics/rate-cards`, and `POST /api/v1/logistics/rate-cards/{card}/publish`; the index response includes active category options in `meta.categories` for the editor.
- `ShippingQuotationService` groups measured Order lines by category and applies each matching rule to each service leg.
- Freeze rate-card revision, rule IDs, leg owner, service type, hub endpoints, and quoted charge in the Order pricing snapshot.
- Test organization isolation, duplicate rules, publish transitions, effective-date selection, category coverage, weight increments, dimensional ceilings, and stale checkout behavior.
- The Logistics SPA implements the route in `pages/SettingsPage.tsx` with focused tariff, coverage, rate-card, and draft-form components under `features/shippingSettings/`.
