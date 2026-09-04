---
feature: content-customization
title: Admin Homepage Advertisement Content Customization
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application and Customer Homepage Advertisement Layer
---

# Admin Homepage Advertisement Content Customization

## WHAT

- Authorized Admins manage the public advertisement layer at the top of the Customer homepage.
- Admins can create, edit, order, preview, schedule, activate, archive, and publish advertisements with:
  - title
  - plain-text description
  - desktop image and optional mobile art-directed image
  - accessible image alternative text
  - safe destination link
- The layout is selected for the advertisement layer only:
  - `single`: one advertisement in one full-width block.
  - `carousel`: two or more advertisements in one automatically rotating block.
  - `multi_block`: one large advertisement plus two smaller stacked advertisements.
  - `multi_block_carousel`: a carousel in the large block plus two smaller static advertisements.
- Desktop multi-block layouts use one large primary region and two stacked secondary regions. Mobile stacks the primary, secondary-top, and secondary-bottom blocks without horizontal overflow.
- Laravel owns authorization, validation, media persistence, slot integrity, publication, cache invalidation, and audit records. Admin React owns forms, preview, ordering, and state feedback. Customer Next.js renders the published API projection.
- The current `HomepageCampaign` records and `GET /api/v1/customer/home` campaign data are the existing integration foundation. The feature replaces the hard-coded hero/side composition with a server-selected advertisement-layer contract.
- This feature is separate from Platform Settings announcements, Push Notification Management, product/category/deal sections, Seller content, and third-party ad networks.
- Non-goals: arbitrary HTML/CSS/JavaScript, video or animated advertisements, audience targeting, ad billing, impression guarantees, or a general homepage page builder.

## MUST

### Access, lifecycle, and isolation

- Every Admin mutation/read requires Sanctum authentication, an active persisted `ADMIN` role, and an explicit advertisement-content permission. React visibility is not authorization.
- Use project-standard `401`, `403`, `404`, `409`, `422`, and upload `429` responses for authentication, permission, scope, concurrency, validation, and throttling failures.
- Keep draft editing separate from the published configuration. Recommended lifecycle: `DRAFT → PUBLISHED → ARCHIVED`.
- A publish operation must atomically persist layout, rotation interval, slot assignments, and all referenced advertisement content. It must never expose a half-configured layout.
- Published configuration/content is immutable. Editing published content creates a copied draft or replacement content record; it does not mutate what Customers currently see.
- Use optimistic `revision` checks and `lockForUpdate()` (or the repository equivalent). Concurrent saves or publishes return `409` and do not overwrite newer work.
- Admin data must be scoped to the advertisement feature. Customer, Seller, Courier, and other Admin records must not be exposed or mutated through these endpoints.

### Content and layout rules

- Title and description are required, trimmed, plain text, bounded by server validation, and rendered without raw HTML/script execution. Recommended MVP bounds are 160 title characters and 500 description characters.
- Alt text is required for informative images. Decorative treatment must be an explicit server/UI decision; an ad image must not rely on text embedded only inside the bitmap.
- Destination links are required for MVP and must be relative Customer routes or configured same-origin/allow-listed hosts. Reject `javascript:`, data URLs, phishing destinations, and arbitrary unapproved hosts; never trust a client-supplied sanitized URL.
- A desktop image is required. A mobile image is optional; when absent, the desktop asset is used with a responsive crop. The API returns delivery URLs, never disk paths.
- `single` publishes exactly one eligible advertisement.
- `carousel` publishes at least two eligible advertisements in explicit order.
- `multi_block` publishes exactly three unique advertisements: `primary`, `secondary_top`, and `secondary_bottom`.
- `multi_block_carousel` publishes at least two unique primary slides plus exactly one advertisement in each secondary slot.
- An advertisement may occupy only one slot in a published configuration. Reordering changes presentation order, not content ownership.
- `rotation_interval_seconds` is server-validated; use the existing six-second behavior as the default and a bounded MVP range such as 5–60 seconds. The Customer client must use the returned value rather than a hard-coded timer.
- Only published, active, non-expired, eligible advertisements are returned to Customers. Draft, archived, invalid, missing-media, and future/expired content is excluded by Laravel.
- If a published configuration becomes incomplete at read time, use the last valid published configuration; if none exists, return an empty advertisement layer and keep the rest of the homepage usable. The fallback must be observable and deterministic.

### Customer interaction and accessibility

- The Customer response exposes one `advertisementLayer` projection containing the selected layout, rotation interval, slot/slide order, title, description, image URLs, alt text, and safe link. It must not expose Admin revisions, storage metadata, unpublished content, or internal notes.
- Changing the layout may change only the advertisement-layer projection and its rendering. `viewer`, quick actions, categories, flash deals, product rails, recently viewed items, recommendations, header, and search behavior remain unchanged.
- `carousel` and the primary region of `multi_block_carousel` provide previous/next controls, slide selection indicators, and a clearly named pause/resume control. A one-item result has no rotation controls.
- Auto-rotation stops when focus enters the carousel or the pointer hovers over it, and does not restart after focus leaves until the user explicitly resumes it. `prefers-reduced-motion: reduce` disables automatic rotation on load.
- Use semantic region/group/slide structure, visible or referenced slide names, keyboard-operable native buttons, visible focus, and non-color-only state communication. Do not trap focus or announce automatic changes noisily.
- Linked advertisements must expose a clear accessible name and work by keyboard, touch, and pointer. Mobile must preserve readable title/description and reachable links in every layout.
- Public homepage reads remain read-only, guest-compatible, Laravel-backed, bounded, and safe for the existing public cache. Customer-private homepage data must not enter the advertisement cache.

### Media, cache, and accountability

- Follow `docs/references/file-upload-requirements.md`: accept only valid JPEG, PNG, or WebP images under 10 MiB; inspect signature/MIME and decode server-side; reject spoofed, malformed, oversized, or double-extension files.
- Store bytes on the configured filesystem/Azure Blob using server-generated keys and feature-specific asset records. Keep width, height, detected type, byte size, checksum, processing state, owner, and timestamps as needed; do not store Base64 or browser blob URLs.
- Draft/private media is inaccessible to Customers. Public delivery requires an authorized published configuration and approved asset state; private delivery uses an authorized application endpoint or supported short-lived URL.
- Upload, content update, archive, slot/layout change, and publish operations create safe immutable Admin audit events with actor, target IDs, layout/slot metadata, and changed-field summaries. Never copy image bytes, credentials, or private URLs into audit data.
- Invalidate the existing homepage campaign/configuration cache only after a successful transaction commit. Coordinate Laravel cache and the Next.js public revalidation/TTL so a published layout becomes visible without changing unrelated homepage data.

### Acceptance criteria

- [ ] An authorized Admin can create a draft advertisement, upload valid desktop/mobile images, enter title/description/alt text/link, preview it, and save field-addressable validation errors.
- [ ] Admin can choose each of the four layouts, assign valid unique slots/order, set the rotation interval, and receive a publish-blocking error for incomplete layouts.
- [ ] Publish atomically changes the Customer advertisement layer; drafts and stale/conflicting requests never reach Customers.
- [ ] Customer API returns only the current valid published layer and preserves every non-ad homepage field when the layout changes.
- [ ] Single, carousel, multi-block, and multi-block-carousel render correctly at desktop and mobile breakpoints; multi-block mobile has no horizontal overflow.
- [ ] Carousels support manual navigation, pause/resume, keyboard access, focus/hover pause, reduced-motion behavior, and accessible slide names.
- [ ] Unauthorized Admins, non-Admins, Sellers, Couriers, and Customers cannot access Admin advertisement management or private media.
- [ ] Cache invalidation, audit records, safe links, upload limits, visibility filtering, and stale-revision `409` behavior are covered by focused tests.

## HOW

- Add a dedicated Admin advertisement-management surface, optionally as a section under the existing Platform Settings page, with desktop/mobile preview, draft list, content editor, slot/order controls, layout selector, interval input, publish confirmation, retry, and conflict recovery.
- Reuse `HomepageCampaign` as the legacy/content foundation where safe; add the missing description and Admin-owned media/version fields through additive migrations. Add a versioned `HomepageAdvertisementConfiguration` (or repository-equivalent) for layout, interval, slot assignments, status, revision, and Admin timestamps.
- Keep enum-like database columns as strings with PHP enum casts. Do not edit the executed `homepage_campaigns` migration. Map existing `hero` records to primary slides and the first two `hero_side` records to secondary slots during rollout, with a deterministic fallback until a new configuration is published.
- Add Admin Form Requests, Resources, Policies/middleware, services, routes, and a feature-specific upload service. Suggested routes are:
  - `GET /api/v1/admin/homepage-advertisements`
  - `POST/PATCH /api/v1/admin/homepage-advertisements...`
  - `POST /api/v1/admin/homepage-advertisements/uploads`
  - `POST /api/v1/admin/homepage-advertisements/configuration/publish`
- Extend `GET /api/v1/customer/home` with the `advertisementLayer` DTO while keeping other response keys and owning services intact. The webapp replaces only `HeroCampaignWindow` with a layout-dispatching advertisement component; its existing `HomeDataProvider`, analytics, SSR/CSR boundary, and API client remain the integration points.
- Use Next.js responsive image/art-direction support with accurate `sizes`, prioritized loading for only the initial primary asset, lazy loading for later/lower-priority assets, and server delivery URLs. See the Next.js Image guidance below.
- Backend tests cover permissions, upload validation/ownership, slot cardinality, safe destinations, draft/publish transitions, atomic concurrency, legacy mapping, eligibility, cache invalidation, audit payloads, and unchanged non-ad homepage fields. Frontend tests cover all layouts, mobile order/overflow, preview, loading/error/conflict states, links, keyboard controls, reduced motion, and carousel timing.
- Observe publish failures, incomplete-layer fallbacks, upload rejection categories, and advertisement impressions/clicks using safe ad/configuration IDs and slot/layout metadata; do not record Customer PII.
- The Customer homepage must continue using one authoritative API projection for this layer so Admin preview, public SSR, client refresh, and cache invalidation cannot drift into separate advertisement rules.

### Open questions

- Should this use dedicated `homepage-advertisements.view/manage` permissions or the existing `platform-settings.view/manage` permissions?
- Is the required lifecycle/versioned publish flow part of MVP, or may an authorized Admin save directly to the live layer?
- Are external links ever allowed beyond configured hosts, and should they open in the same tab?
- Should scheduling apply to each advertisement or to the whole published configuration, and what happens when only one required slot expires?
- What exact image aspect ratios/crop rules and per-purpose dimensions should be enforced for desktop, mobile, primary, and secondary placements?

### Sources

- Project sources: `docs/architecture.md`, `docs/design.md`, `docs/features/admin/manage-platform-settings/spec.md`, `docs/features/customer/customer-homepage-v2/spec.md`, `docs/references/file-upload-requirements.md`, existing `HomepageCampaign` model/service and Customer homepage components.
- [WAI-ARIA Authoring Practices: Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)
- [WCAG 2.2 Understanding 2.2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
- [Next.js Image Component](https://nextjs.org/docs/app/api-reference/components/image)
- [Laravel file validation](https://laravel.com/docs/13.x/validation#validating-files)
