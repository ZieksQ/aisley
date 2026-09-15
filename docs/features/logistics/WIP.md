---
role: Logistics
system: AISLEY
type: Future Feature Plan
version: 1.0
status: Draft
scope: Logistics Web Application / Self-Service Account Settings
source_coverage: Logistics.md, app.md
---

# Logistics Future Feature Plan

- You can still create optional/shared Logistics-supporting specs that come from app.md or cross-feature architecture, such as:

## Logistics Subscription / Billing

## Shared Order / Shipment State Machine

## Waybill Scanner / Scan Processing

- [x] Dedicated **Receive at hub** page supports local Code 128/QR camera scanning and manual parcel/waybill entry.
- [x] Dexie retains scans offline and bulk-posts on ten queued parcels, five minutes, reconnect, or operator request; partial failures remain queued.
- [x] The shared one-page A6 waybill includes a local Code 128 barcode alongside the existing QR and human reference.

## Sorting

- [x] Dedicated **Sorting** page sits between Receive at hub and Dispatch parcels and owns normal hub sortation.
- [x] Standard and exception lanes have scannable printable Code 128 labels; standard sync commits sorting while exceptions remain at hub for resolution.
- [x] One bounded session snapshots up to 100 received parcels and supports Dexie-backed Code 128/QR/manual capture, partial batch sync, and reconciliation.
- [ ] Automatic destination lanes, containers/manifests, capacity rules, staff metrics, multi-hub/linehaul, RFID, conveyors, robotics, and returns remain deferred in the [Logistics Sorting specification](../orders/logistics-sorting/spec.md).

## Dispatch Scheduling

- [x] Dedicated **Dispatch parcels** page lists only sorted parcels as Ready to dispatch.
- [x] One future schedule assigns one approved Courier to 1–15 parcels atomically while preserving one task/offer/history per parcel.
- [x] Customer detail shows Scheduled for delivery with the assigned Courier name and contact number.

## Logistics Courier Approval / Management

- Specification: [Courier Application Review and Approval](courier-approval/spec.md). Phase 1 review UI, private evidence delivery, completeness checks, and atomic decisions are implemented; notifications, reversal, and browser automation remain deferred.

## Logistics sole-hub map pin

- Registration and Account Settings now support optional confirmed coordinates through PSGC/manual address fields, intentional Geoapify assistance, Leaflet click/drag, device-location/manual fallback, and private API persistence. Same-premises corrections use an opaque revision, durable history, and do not rewrite operational snapshots. Physical relocation remains deferred.

## Shared Logistics Operational History / Audit
