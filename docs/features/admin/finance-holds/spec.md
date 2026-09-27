---
feature: finance-holds
title: Admin Finance Holds
system: AISLEY
type: Feature Specification
version: 1.0
status: Implemented
role: Admin
scope: Admin Web Application and Finance API
source_coverage: docs/features/shared/commission-settlement/spec.md, docs/features/shared/shipping-quotation/spec.md, docs/design.md
---

# Admin Finance Holds

## WHAT

- Give authorized Admins a separate queue for Logistics payout holds that require manual route allocation reconciliation.
- Prioritize unplanned checkout routes while retaining the other Logistics evidence/quoted-charge hold reasons supported by the reconciliation service.
- Preserve the Customer's frozen shipping charge. Manual allocations distribute the frozen Logistics pool plus an optional, explicitly platform-funded subsidy.

## MUST

- Require `finance.view` to list and inspect holds and `finance.manage` to reconcile them. Laravel authorization is authoritative.
- List only reconciliation-capable Finance hold reasons: `UNPLANNED_ROUTE_RECONCILIATION_REQUIRED`, `LOGISTICS_QUOTED_CHARGES_MISSING`, `LOGISTICS_EVIDENCE_MISSING`, and `LINEHAUL_EVIDENCE_MISSING`.
- Support open and resolved views. Return safe Order reference/status, Shop name, selected provider, route status, destination region/province/city, frozen shipping figures, hold notes/timestamps, and resolution data without Customer names, contact details, or street/barangay address lines.
- Offer only active Logistics organizations as allocation choices. Identify the organization and its hub without exposing account or address details.
- Allow one or more allocation rows with organization, service type (`first_mile`, `linehaul`, or `last_mile`), and positive amount. Duplicate organization/service pairs are invalid.
- Require allocation total to equal the frozen Logistics pool plus the declared platform subsidy and show the difference before submission.
- Require an audit note explaining the evidence used. Reconciliation atomically creates allocations and ledger entries and releases the hold through the existing domain service.
- Treat `404`, `409`, and `422` as safe refetch/review states. A stale or already-resolved hold must never create duplicate allocations.
- Provide loading, empty, failure, validation, confirmation, and success states at narrow and wide layouts in both Admin themes.

## API

- `GET /api/v1/admin/finance/holds?status=open|resolved`
- `GET /api/v1/admin/finance/holds/{hold}`
- `POST /api/v1/admin/finance/holds/{hold}/reconcile-logistics`

## VERIFICATION

- Cover permission boundaries, supported-reason filtering, safe payload fields, open/resolved views, active organization options, exact-total validation, duplicate rows, subsidy handling, stale reconciliation, responsive layout, keyboard operation, and light/dark presentation.
