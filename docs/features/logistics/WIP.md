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

## Logistics Courier Approval / Management

- Specification: [Courier Application Review and Approval](courier-approval/spec.md). Phase 1 review UI, private evidence delivery, completeness checks, and atomic decisions are implemented; notifications, reversal, and browser automation remain deferred.

## Logistics sole-hub map pin

- Registration and Account Settings now support optional confirmed coordinates through PSGC/manual address fields, intentional Geoapify assistance, Leaflet click/drag, device-location/manual fallback, and private API persistence. Same-premises corrections use an opaque revision, durable history, and do not rewrite operational snapshots. Physical relocation remains deferred.

## Shared Logistics Operational History / Audit
