---
feature: seller-created-pickup-waybill
title: Seller-Created Pickup Waybill
system: AISLEY
type: Feature Specification
version: 1.0
status: Implementation-ready draft
roles: Seller, Logistics, Courier API
scope: Seller SPA, Logistics SPA, Courier API, Laravel API
---

# Seller-Created Pickup Waybill

## WHAT

- **Purpose:** Create one printable, scannable waybill for each Order when the Seller commits **Request pickup** with a selected Logistics organization.
- **Actors:** Seller creates, views, downloads, and prints; selected Logistics views/downloads; assigned Courier scans through the external mobile API.
- **Ownership change:** This is one shared waybill, created by Aisley from Seller-authorized immutable data; it replaces the earlier split between Seller package label and Logistics-created hub waybill.
- **Lifecycle:**
  ```text
  Seller packs parcel → selects Logistics → Request pickup
  → waybill identity/snapshot/QR created atomically
  → Seller prints and attaches it
  → Logistics views/scans it in Pickups
  → assigned Courier scans it at physical handoff
  ```
- Creating, viewing, downloading, printing, or scanning a waybill does not itself change Order or custody status.
- MVP output is one A6 portrait PDF per Order; a bulk download may combine up to 30 A6 pages for one pickup request or schedule.
- **Non-goals:** thermal-printer drivers, external carrier labels, parcel weight/dimensions, multiple parcels per Order, route mutation, status mutation by document generation, or public unauthenticated tracking.

## MUST

### Creation and identity

- Require active approved Seller access and resolve every Order through the authenticated Seller's Shop.
- Waybill creation is a server-owned side effect of the locked pickup-request transaction, not a separate client-supplied document action.
- Create exactly one logical waybill per Order after validating `seller_processing`, payment/address snapshots, Inventory reservation, selected Logistics eligibility, and pickup-request idempotency.
- In the same transaction, persist the pickup request, immutable provider, Order links, `ready_for_pickup` events, and waybill snapshots; any failure rolls back all of them.
- Generate a non-sequential human-readable reference with database uniqueness; never expose a raw database primary key as the sole identifier.
- QR payload contains only a version marker and random opaque lookup token/reference; it contains no names, addresses, phone numbers, item data, payment facts, or authorization claims.
- Store only a keyed hash of any bearer-like verification token; scanning always rechecks the authenticated actor and current Order/task relationship.
- A retry with the same idempotency key returns the existing waybills; concurrent requests cannot create two current waybills for one Order.
- The waybill reference, Order, Shop, selected Logistics organization, destination snapshot, and QR identity are immutable from creation.
- Corrections after pickup request require a future void-and-reissue policy; MVP does not edit or regenerate authoritative snapshot data.

### Content and privacy

- Render from a server-owned `WaybillSnapshot`, never from arbitrary HTML, filenames, URLs, or printable fields submitted by a browser.
- Show waybill and Order references, created timestamp, Shop name, safe Seller pickup details, recipient/delivery address snapshot, selected Logistics business/hub, COD marker/collectible amount, item quantity count, and QR code.
- Do not print product names or SKUs in MVP; the parcel exterior should not reveal purchase contents.
- Print only the contact numbers operationally required for pickup/delivery; mask them in ordinary JSON DTOs and authorize full display only in the PDF.
- Never include credentials, payment-card data, private registration documents, internal notes, raw storage paths, database IDs, or QR secrets in logs.
- Use a fixed local template and bundled/local fonts/assets; disable remote Dompdf resources and reject user-authored HTML/CSS.
- Return `Cache-Control: private, no-store`, `Content-Type: application/pdf`, and a sanitized deterministic filename.

### Seller packing and printing experience

- Before **Request pickup**, show concise steps: pack and seal each Order separately; confirm the items; request pickup; print its waybill; attach it flat outside the parcel; keep the QR/reference uncovered and readable.
- Warn Sellers not to place the waybill across a seam, fold, tape glare, or cover the QR; reprint if damaged or unreadable.
- After commit, show per-Order Preview/Download/Print and a **Print all** action for up to 30 Orders.
- Preview, download, and reprint never create a new waybill, request, notification, Inventory movement, or status event.
- Record a minimal append-only print/download audit event with actor role/user, waybill, timestamp, action, and request correlation ID; never claim the browser physically printed.
- A PDF-generation failure after the identity exists returns a retryable error and does not void the pickup request; deterministic rendering must succeed later from the snapshot.

### Role and tenant access

- Seller can read only waybills for Orders in its server-derived Shop.
- Logistics can read only waybills whose immutable selected organization equals its authenticated organization.
- Courier can resolve/scan only a waybill connected to its active approved affiliation and assigned first-mile/final-mile task; Courier receives no web UI in this repository.
- Customer, unrelated Seller/Logistics/Courier, inactive accounts, and guessed references receive no document or existence disclosure.
- A scan resolves the waybill and returns a minimal authorized parcel/task match; a separate transition endpoint records physical pickup or hub events.
- A copied QR code is not proof of possession, delivery, identity, or permission and cannot bypass task assignment.

### PDF and QR dependencies

- Add `barryvdh/laravel-dompdf:^3.1.2` for Laravel 13 integration and explicitly constrain `dompdf/dompdf:^3.1.6` or newer patched 3.x.
- Dompdf is free/open source under LGPL-2.1; the Laravel wrapper is MIT and supports Laravel 13.
- Add `bacon/bacon-qr-code:^3.1` and use its SVG backend; it is BSD-2-Clause, supports PHP `^8.1`, and avoids a new GD/Imagick runtime dependency.
- Review all transitive licenses and run `composer audit` at implementation/CI time; lock exact resolved versions in `composer.lock`.
- Keep Dompdf remote access disabled, restrict local paths, bound render time/memory, and never render untrusted HTML or images.
- Sources: [Laravel Dompdf package](https://github.com/barryvdh/laravel-dompdf), [patched Dompdf release](https://packagist.org/packages/dompdf/dompdf), and [BaconQrCode package](https://packagist.org/packages/bacon/bacon-qr-code).

### Acceptance criteria

- [ ] Request pickup creates one immutable waybill per eligible Order and no waybill for a failed transaction.
- [ ] Seller and selected Logistics can view/download the same authorized PDF; unrelated tenants cannot infer it exists.
- [ ] Every PDF is A6, contains the required snapshot fields, has a readable QR plus human reference, and exposes no product names or secrets.
- [ ] Repeated generation/download/print returns the same identity and causes no Order, Inventory, task, or notification mutation.
- [ ] Courier scans require assignment authorization and cannot directly advance custody state.
- [ ] Dependencies are license-reviewed, patched, locked, and usable without paid services or added browser/server binaries.

## HOW

### Data model and services

- Add new migrations only for UUID `waybills`, immutable `waybill_snapshots`, and append-only `waybill_access_events`; do not edit executed migrations.
- Enforce unique `order_id`, `reference`, and `qr_token_hash`; store enum-like `status`/`action` fields as strings with PHP enum casts.
- Link the waybill to Order, pickup request, Shop, selected Logistics organization, and sole hub; use restrict-on-delete or retained snapshots for history.
- Implement `CreateWaybill`, `RenderWaybillPdf`, `ResolveWaybillQr`, and role-specific policy/resource classes.
- Generate the QR SVG server-side and embed it as a local/data URI in the fixed Blade PDF view; do not fetch QR images from a third party.
- Prefer render-on-demand from the immutable snapshot; if caching PDFs later, use the configured private filesystem/Azure disk with authorized streaming and checksum/version invalidation.
- Keep template version, snapshot schema version, and content checksum so later template changes do not mutate the historical data contract.
- Use a dedicated queue only if bulk rendering exceeds the normal request budget; single-document downloads should stream synchronously with bounded execution.

### Interfaces and UI

- Seller: `GET /api/v1/seller/orders/{order}/waybill` and `GET /pickup-requests/{pickup}/waybills.pdf`.
- Logistics: `GET /api/v1/logistics/pickups/{pickup}/waybills` and `GET /waybills/{waybill}.pdf`.
- Courier API: `POST /api/v1/courier/waybills/resolve` followed by a distinct task-transition endpoint.
- JSON metadata exposes reference, created time, printable capability, and authorized links; PDF bytes use dedicated streamed responses.
- Seller UI follows `docs/design.md` and shared `@aisley/ui`; Logistics shows waybill actions within its role-isolated Pickups screens.
- Preview must use the same backend-rendered PDF as Download/Print so browser HTML cannot diverge from the physical label.
- Bulk output preserves deterministic Seller-selected Order order and reports any ineligible Order before rendering; it never silently omits a page.

### Verification and rollout

- API tests cover role/status/Shop/organization/task isolation, IDOR, idempotent creation, concurrency, rollback, immutable snapshots, and no side effects on view/print/scan.
- Render tests inspect headers, page size/page count, required text, forbidden data, QR payload, and QR decode against the reference at multiple print/scanner resolutions.
- Security tests reject raw/unhashed tokens, hostile printable input, remote-resource fetches, path traversal, oversized render inputs, and stale/void references.
- Test address Unicode, long but valid snapshot values, page overflow, printer-safe contrast, keyboard access, repeated downloads, and deterministic checksums.
- Run focused tests on SQLite and PostgreSQL, `composer audit`, Laravel formatting, and Seller/Logistics lint, TypeScript, and production builds.
- Log waybill/reference IDs, actor/tenant, action, template version, render duration, size, and result; exclude snapshot PII and QR payload/token.
- Alert on render failure rate, unexpected multi-page single labels, QR validation failure, and repeated unauthorized resolution attempts.
- Roll out after pickup/provider schema, before Logistics scheduling and Courier scanning; keep the old fail-closed Seller waybill endpoint until the migration is deployed.
