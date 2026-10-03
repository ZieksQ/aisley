---
feature: pricing-and-fees
title: Admin Pricing and Fees
system: AISLEY
type: Feature Specification
version: 1.0
status: Implemented; surcharge-only frontend adopted 2026-10-03
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
- Shipping configuration permits changing only a surcharge for each selected Philippine destination region, with effective time, version status, and active Logistics acceptance count. Remove the platform base-fee field and history column. Measurement policy (volumetric divisor and platform parcel ceilings) remains server-owned/read-only; remove its draft inputs. Logistics owns service base fees and main Shop Category extras. Commission configuration remains separately editable.
- Source the selectable region names from `@aisley/psgc-address-data`. Store the exact PSGC display name sent by the Admin API and never accept two entries for the same region in one tariff.
- Present a keyboard-operable two-dimensional Philippine region overview plus a conventional region selector. Selecting either control shows that region's surcharge and permits adding, changing, or clearing it in the pending draft form.
- Render locally bundled, simplified vector boundaries derived from `faeldon/philippines-json-maps` (2023), grouped to the current bundled PSGC inventory including Negros Island and Sulu's membership. Preserve upstream attribution/license. It assists selection but is not a routing, coverage, or legal-boundary map.
- Keep the map compact (300–360px viewport height, at most 360px wide), responsive in both themes, and selectable by pointer, touch, Enter, and Space. Provide bounded zoom, reset, and drag/arrow-key panning when zoomed; retain the conventional selector for small regions. Map and selector share the existing surcharge state and mutations.
- Commission configuration has separate Seller and Logistics policies, expressed as percentages in the UI and integer basis points at the API boundary.
- Creating a draft never changes checkout pricing. Publishing requires confirmation and uses the existing immutable-version API.
- Create commission policies in a viewport-bounded modal with an optional future effective date. Without a schedule, a saved policy is **Inactive** and publishing applies it immediately. Confirm discarding unsaved form input.
- Policy history uses **Active** for a published policy currently in effect, **Scheduled** for a future effective date (including an unpublished policy awaiting publication), **Inactive** for an unpublished policy without a future schedule, and **Expired** for a published policy whose effective window has ended. A scheduled unpublished policy must still be published; its Publish button remains available.
- The API derives these time-dependent statuses from immutable publication state and effective windows, and exposes `can_publish` separately. Keep persisted `draft`/`published` publication state compatible with checkout; expired published policies cannot be republished.
- Replacing a Seller policy expires only the affected Seller window; Logistics is independent, and vice versa. Future publication leaves the current policy active until the scheduled boundary. Publishing a policy between existing scheduled versions must preserve later schedules and end the inserted version at the next published effective date. Past or absent effective dates become the publication time, without rewriting existing Order snapshots.
- Provide sortable Beneficiary, Rate, Status, Effective, and Ends columns with accessible direction indicators. Status order is Active → Scheduled → Inactive → Expired, reversible; sorting resets to the first page. Show at most ten policies per page with Previous/Next controls and row/page counts.
- Use visible bordered buttons for policy actions and a modal publication confirmation showing beneficiary, percentage, effective time, and replacement consequences. Dialogs trap focus, support Escape/cancel, restore focus, block duplicate submission, and preserve input on validation failure. Refresh history after publication and at effective/expiry boundaries.
- Loading, empty, validation, permission, conflict, success, and request-failure states must remain legible in light and dark themes and at narrow widths.
- Do not expose internal checkout snapshots, Logistics-owned rate cards, payout allocations, secrets, or arbitrary configuration keys.

## API

- `GET/POST /api/v1/admin/shipping-rates`
- `POST /api/v1/admin/shipping-rates/{rate}/publish`
- `GET/POST /api/v1/admin/commission-policies`
- `POST /api/v1/admin/commission-policies/{policy}/publish`
- Shipping creation requires `region_surcharges` (an empty array clears all), `effective_at`, and optional `currency = PHP`. Base-fee, increment-charge, divisor, and parcel-limit write fields are prohibited; legacy base/weight-charge fields are omitted from tariff responses. Technical measurement policy is read-only. The frontend submits only regional surcharges and version metadata; displayed parcel policy is read-only.
- Commission creation accepts nullable/omitted `effective_at`. Commission responses expose lifecycle `status`, `can_publish`, and nullable effective/end times; the history read is private and not cached.

## VERIFICATION

- Verify route/permission visibility, PSGC region selection from map and selector, surcharge add/change/clear behavior, surcharge money conversion, absence of base/measurement editing, draft creation, publish confirmation, both commission beneficiaries, API errors, keyboard focus, responsive layout, and light/dark presentation.

## DESIGN REFERENCES

- [Shopify shipping zones and rates](https://help.shopify.com/en/manual/fulfillment/setup/shipping-rates/setting-up-shipping-rates) — region-grouped shipping configuration and explicit save/edit flow.
- [Philippine Statistics Authority PSGC regions](https://psa.gov.ph/classification/psgc/regions) — official current 18-region inventory, mirrored by the bundled workspace data.
