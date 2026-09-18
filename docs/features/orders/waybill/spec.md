---
feature: seller-created-pickup-waybill
title: Seller-Created Pickup Waybill
system: AISLEY
type: Feature Specification
version: 1.4
status: API, one-page A6 thin Code 128/QR PDF, sort-plan snapshotting, and Seller/Logistics UI implemented
roles: Seller, Logistics, Courier API
scope: Seller SPA, Logistics SPA, Courier API, Laravel API
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Logistics.md, docs/domains/Courier.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Seller-Created Pickup Waybill

## WHAT

- **Purpose:** Create one printable, scannable waybill for each Order when the Seller commits **Request pickup** with a selected Logistics organization.
- **Actors:** Seller creates, views, downloads, and prints; selected Logistics views/downloads; assigned Courier scans through the external mobile API and submits the scan/evidence to Logistics for validation.
- **Ownership change:** This is one shared waybill, created by Aisley from Seller-authorized immutable data; it replaces the earlier split between Seller package label and Logistics-created hub waybill.
- **Lifecycle:**
  ```text
  Seller packs parcel → selects Logistics → Request pickup
  → waybill identity/snapshot/QR created atomically
  → Seller prints and attaches it
  → Logistics views/resolves it in Pickups
  → assigned Courier scans it at physical handoff
  → Courier submission is validated and recorded by Logistics
  ```
- Creating, viewing, downloading, printing, or scanning a waybill does not itself change Order or custody status.
- A Courier QR/reference scan is an ingress/access event, not a custody transition. Only the shared transition service may advance physical state after Logistics validates the submitted event/evidence.
- Current explicit Courier pickup confirmation commits first-mile custody and Inventory after QR/manual verification. Logistics hub receiving now scans the thin 1D Code 128 barcode (ignoring QR) or accepts a manual reference into a device-local outbox and commits `received_at_hub` through the dedicated bulk endpoint without replaying Inventory effects.
- The immutable waybill `reference` is the explicit human `tracking_id` for the MVP. Every A6 portrait PDF contains a thin, industry-standard 1D Code 128 barcode that encodes that tracking ID, plus the existing QR as a compatibility/fallback identifier; a bulk download may combine up to 30 one-page A6 labels for one pickup request or schedule.
- **Non-goals:** thermal-printer drivers, external carrier labels, parcel weight/dimensions, multiple parcels per Order, route mutation, status mutation by document generation, or public unauthenticated tracking.

## MUST

### Creation and identity

- Require active approved Seller access and resolve every Order through the authenticated Seller's Shop.
- Waybill creation is a server-owned side effect of the locked pickup-request transaction, not a separate client-supplied document action.
- Create exactly one logical waybill per Order after validating `seller_processing`, payment/address snapshots, Inventory reservation, selected Logistics eligibility, and pickup-request idempotency.
- In the same transaction, persist the pickup request, immutable provider, Order links, `ready_for_pickup` events, and waybill snapshots; any failure rolls back all of them.
- Generate a non-sequential human-readable tracking ID with database uniqueness; expose the existing waybill reference as a backwards-compatible alias, never as a raw database primary key.
- QR payload contains only a version marker and random opaque lookup token/reference; it contains no names, addresses, phone numbers, item data, payment facts, or authorization claims.
- Store only a keyed hash of any bearer-like verification token; scanning always rechecks the authenticated actor and current Order/task relationship.
- A retry with the same idempotency key returns the existing waybills; concurrent requests cannot create two current waybills for one Order.
- The waybill reference, Order, Shop, selected Logistics organization, destination snapshot, and QR identity are immutable from creation.
- During the Seller pickup transaction, read the Buyer postal-code snapshot and the selected Logistics hub's current active sort plan. Store the resulting plan/postal-code/lane match as an immutable routing hint; the hub's scan-time plan remains authoritative if the plan changes later.
- Corrections after pickup request require a future void-and-reissue policy; MVP does not edit or regenerate authoritative snapshot data.

### Content and privacy

- Render from a server-owned `WaybillSnapshot`, never from arbitrary HTML, filenames, URLs, or printable fields submitted by a browser.
- Show tracking ID (with waybill-reference alias) and Order reference, created timestamp, Shop name, safe Seller pickup details, recipient/delivery address snapshot, selected Logistics business/hub, COD marker/collectible amount, item quantity count, QR code, and thin Code 128 barcode.
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
- A scan resolves the waybill and returns a minimal authorized parcel/task match; the Courier submits the scan/evidence to the owning Logistics organization through a separate, versioned task-transition API.
- Logistics validates the waybill/Order/Parcel link, task leg, current state, Courier authorization, and idempotency before recording the authoritative event. The event preserves the performing Courier, recording Logistics account, timestamp, and safe reference/evidence metadata.
- A scan or waybill-access event alone never advances custody or `OrderStatus`; a validated event must pass the shared transition service.
- Logistics Receiving and Sorting scan the same parcel tracking ID/waybill into separate device-local outboxes. A Sorting lane label is an internal location selector and never creates or replaces the parcel's immutable waybill. Automatic Sorting resolves the tracking ID server-side and rechecks the current postal-code sort plan.
- A copied QR code is not proof of possession, delivery, identity, or permission and cannot bypass task assignment.

### Courier scan and custody boundary

- The external Courier app scans the opaque QR/reference and submits the payload, task leg, expected revision, and permitted evidence metadata; it does not submit a new status or actor identity as authority.
- The backend records the Courier's resolve/access event separately from the physical handoff event. `waybill_access_events` therefore remain audit records, not custody history.
- Logistics is the authoritative recorder for accepted physical scan/evidence. Failed validation records a safe rejection state where allowed and leaves custody unchanged; retrying an identical submission is idempotent.
- Physical pickup and hub milestones use the approved detailed `snake_case` Shipment/DeliveryTask states. No source-only uppercase status is created by scanning.

### PDF and QR dependencies

- Add `barryvdh/laravel-dompdf:^3.1.2` for Laravel 13 integration and explicitly constrain `dompdf/dompdf:^3.1.6` or newer patched 3.x.
- Dompdf is free/open source under LGPL-2.1; the Laravel wrapper is MIT and supports Laravel 13.
- Add `bacon/bacon-qr-code:^3.1` and use its SVG backend; it is BSD-2-Clause, supports PHP `^8.1`, and avoids a new GD/Imagick runtime dependency.
- Add `picqer/php-barcode-generator:^3.2` (resolved to 3.3.0) and render the thin Code 128 tracking-ID barcode as an embedded SVG. Picqer is LGPL-3.0-or-later and runs locally without a paid or hosted barcode service.
- Review all transitive licenses and run `composer audit` at implementation/CI time; lock exact resolved versions in `composer.lock`.
- Keep Dompdf remote access disabled, restrict local paths, bound render time/memory, and never render untrusted HTML or images.
- Sources: [Laravel Dompdf package](https://github.com/barryvdh/laravel-dompdf), [patched Dompdf release](https://packagist.org/packages/dompdf/dompdf), and [BaconQrCode package](https://packagist.org/packages/bacon/bacon-qr-code).

### Acceptance criteria

- [x] Request pickup creates one immutable waybill per eligible Order and no waybill for a failed transaction.
- [x] Seller and selected Logistics can view/download the same authorized PDF; unrelated tenants cannot infer it exists.
- [x] Every PDF remains one A6 page, contains the required snapshot fields, has a readable QR, Code 128 barcode, and human reference, and exposes no product names or secrets.
- [x] The primary 1D barcode encodes only the immutable tracking ID with a thin Code 128 profile; QR remains available for compatibility and fallback.
- [x] Pickup-time routing snapshots record the Buyer postal code and selected Logistics sort-plan hint without making the historical hint authoritative over a later scan.
- [x] Repeated generation/download/print returns the same identity and causes no Order, Inventory, task, or notification mutation.
- [x] Courier scans require assignment authorization and cannot directly advance custody state.
- [x] Dependencies are license-reviewed, patched, locked, and usable without paid services or added browser/server binaries.

- Logistics camera scanning keeps the same stream across scan-handler/page-state updates, enables muted inline autoplay, and releases tracks on Stop/unmount even during startup. Unsupported preferred settings retry with basic video constraints; HTTPS, unsupported browser, permission, missing/busy camera, and playback failures show actionable errors while retaining manual entry.
- Camera decoding waits for current video frames and nonzero dimensions. Temporary unavailable frames (including `InvalidStateError`), unreadable barcodes, and interrupted startup playback retry without stopping the stream; fatal decode failures reach the page error notice before cleanup.
- Decode captured RGBA pixels through a rotatable luminance buffer, bypassing the installed browser reader’s broken rotation-canvas initialization. Blank frames remain normal barcode misses; thin horizontal and rotated Code 128 labels retain dense scanning. Fatal camera/decode exceptions are available in the local browser console without logging decoded payloads.

## HOW

### Data model and services

- Add new migrations only for UUID `waybills`, immutable `waybill_snapshots`, and append-only `waybill_access_events`; sort-plan tables and scan metadata belong to the Logistics Sorting contract and are additive there. Do not edit executed migrations.
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
- Courier API: `POST /api/v1/courier/waybills/resolve` remains access-only; implemented task-scan endpoints submit QR/reference evidence. Logistics uses `POST /api/v1/logistics/receiving/batches` for idempotent hub receipts and `/api/v1/logistics/sorting/sessions/{session}/batches` for idempotent standard/exception lane captures. These mutations still pass the shared Shipment/DeliveryTask transition rules.
- JSON metadata exposes both `tracking_id` and the backwards-compatible `reference`, created time, printable capability, and authorized links; PDF bytes use dedicated streamed responses.
- Seller UI follows `docs/design.md` and shared `@aisley/ui`; Logistics shows waybill actions within its role-isolated Pickups screens.
- Preview must use the same backend-rendered PDF as Download/Print so browser HTML cannot diverge from the physical label.
- Bulk output preserves deterministic Seller-selected Order order and reports any ineligible Order before rendering; it never silently omits a page.

### Verification and rollout

- API tests cover role/status/Shop/organization/task isolation, IDOR, idempotent creation, concurrency, rollback, immutable snapshots, and no side effects on view/print/scan/resolve. Add scan-submission tests for Logistics validation, actor preservation, duplicate/revision conflicts, and no custody mutation on access or failed evidence.
- Render tests inspect headers, page size/page count, required text, forbidden data, QR payload, and QR decode against the reference at multiple print/scanner resolutions.
- Security tests reject raw/unhashed tokens, hostile printable input, remote-resource fetches, path traversal, oversized render inputs, and stale/void references.
- Test address Unicode, long but valid snapshot values, page overflow, printer-safe contrast, keyboard access, repeated downloads, and deterministic checksums.
- Run focused tests on SQLite and PostgreSQL, `composer audit`, Laravel formatting, and Seller/Logistics lint, TypeScript, and production builds.
- Log waybill/reference IDs, actor/tenant, action, template version, render duration, size, and result; exclude snapshot PII and QR payload/token.
- Alert on render failure rate, unexpected multi-page single labels, QR validation failure, and repeated unauthorized resolution attempts.
- Roll out after pickup/provider schema and the shared transition contract, before physical Courier scanning; keep resolve/access fail-closed and separate from custody until the scan/evidence migration and Logistics recorder are deployed.
