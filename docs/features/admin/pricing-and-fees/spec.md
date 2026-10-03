---
feature: pricing-and-fees
title: Admin Pricing and Fees
system: AISLEY
type: Feature Specification
version: 1.0
status: Implemented
role: Admin
scope: Admin Web Application and existing Finance configuration API
source_coverage: docs/features/shared/shipping-quotation/spec.md, docs/features/shared/commission-settlement/spec.md, docs/design.md
---

# Admin Pricing and Fees

## WHAT

- Provide one Admin configuration workspace for checkout shipping tariffs and effective-dated Seller and Logistics commission policies.
- Keep this workspace separate from the Finance reporting route. The sidebar label is **Pricing & fees** so the destination describes the task instead of duplicating the broader Finance label.
- Show version history and make published records immutable. An Admin changes live pricing by creating and publishing a successor draft.

## MUST

- Require the existing `finance.view` permission to enter and read the workspace. Hide mutations without `finance.manage`; Laravel remains authoritative for every request.
- Shipping configuration includes the platform base fee, a surcharge for each selected Philippine destination region, volumetric divisor, maximum parcel weight and dimensions, effective time, version status, and active Logistics acceptance count.
- Source the selectable region names from `@aisley/psgc-address-data`. Store the exact PSGC display name sent by the Admin API and never accept two entries for the same region in one tariff.
- Present a keyboard-operable two-dimensional Philippine region overview plus a conventional region selector. Selecting either control shows that region's surcharge and permits adding, changing, or clearing it in the pending draft form.
- Render locally bundled, simplified vector boundaries derived from `faeldon/philippines-json-maps` (2023), grouped to the current bundled PSGC inventory including Negros Island and Sulu's membership. Preserve upstream attribution/license. It assists selection but is not a routing, coverage, or legal-boundary map.
- Keep the map compact (300–360px viewport height, at most 360px wide), responsive in both themes, and selectable by pointer, touch, Enter, and Space. Provide bounded zoom, reset, and drag/arrow-key panning when zoomed; retain the conventional selector for small regions. Map and selector share the existing surcharge state and mutations.
- Commission configuration has separate Seller and Logistics policies, expressed as percentages in the UI and integer basis points at the API boundary.
- Creating a draft never changes checkout pricing. Publishing requires confirmation and uses the existing immutable-version API.
- Loading, empty, validation, permission, conflict, success, and request-failure states must remain legible in light and dark themes and at narrow widths.
- Do not expose internal checkout snapshots, Logistics-owned rate cards, payout allocations, secrets, or arbitrary configuration keys.

## API

- `GET/POST /api/v1/admin/shipping-rates`
- `POST /api/v1/admin/shipping-rates/{rate}/publish`
- `GET/POST /api/v1/admin/commission-policies`
- `POST /api/v1/admin/commission-policies/{policy}/publish`

## VERIFICATION

- Verify route/permission visibility, PSGC region selection from map and selector, surcharge add/change/clear behavior, money/measurement conversion, draft creation, publish confirmation, both commission beneficiaries, API errors, keyboard focus, responsive layout, and light/dark presentation.

## DESIGN REFERENCES

- [Shopify shipping zones and rates](https://help.shopify.com/en/manual/fulfillment/setup/shipping-rates/setting-up-shipping-rates) — region-grouped shipping configuration and explicit save/edit flow.
- [Philippine Statistics Authority PSGC regions](https://psa.gov.ph/classification/psgc/regions) — official current 18-region inventory, mirrored by the bundled workspace data.
