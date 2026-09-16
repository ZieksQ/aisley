---
role: Logistics
feature: Vehicle Fleet Management
system: AISLEY
type: Feature Specification
version: 2.2
status: Implemented backend Phase 1; registration/review compatibility retained; Flutter client rollout pending
canonical: true
scope: Logistics-scoped registry of each Courier's sole vehicle
source_coverage: requirements.md, workspace.md, schema.md, Logistics.md, Courier.md
---

# Courier Vehicle Registry

## WHAT

- Maintain vehicle information for Couriers affiliated with the authenticated Logistics organization.
- Keep this Logistics feature path; Courier Auth owns vehicle submission during registration.
- MVP: exactly one registered vehicle per Courier, not one active vehicle plus spare or historical vehicles.
- Each vehicle belongs to one Courier; multiple vehicles, sharing, and reassignment between Couriers are out of scope.
- Couriers provide vehicle information and OR/CR; associated Logistics reviews the application.
- Logistics sees many vehicles only because its organization has many Couriers.
- One Logistics account operates the organization's sole hub; no staff or sub-hub credentials are introduced.
- Registration and Courier application review remain the compatibility foundation; dedicated fleet-management API endpoints are implemented for the external mobile client and Logistics registry reads. No Courier web UI is added.

### Deferred scope

- Maintenance scheduling, reminders, repairs, and maintenance workflows.
- Vehicle history screens, replacement history, and vehicle-to-Courier assignment history.
- Capacity values, capacity units, volumetric matching, and capacity-based dispatch gates.
- Vehicle transfer between Couriers, unassignment, extra vehicles, and independent fleet creation.
- Government verification APIs, insurance, inspection automation, and document-expiry workflows.
- Deferring vehicle history does not delete existing registration decisions, evidence-access logs, or shipment/custody history.

## MUST

### Required information

- Require vehicle type and plate number for the Courier's single vehicle.
- Preserve current type values: `motorcycle`, `car`, and `van`.
- Preserve the current plate input maximum of 64 characters and database-wide plate uniqueness.
- Do not invent jurisdiction-specific plate patterns or new required make/model fields.
- Type, plate, make, model, OR, and CR are editable vehicle information. Make/model are optional nullable strings, maximum 255 characters; type/plate remain required. These edits are implemented by the Courier vehicle API after approval.
- Require OR/CR evidence for that same vehicle; unrelated evidence does not satisfy review.
- OR/CR means Official Receipt and Certificate of Registration, not a profile photograph.
- ID/driver-license evidence remains separately required by the registration reference.
- Do not require capacity, maintenance dates, or vehicle-history entries to register or approve a Courier.

### Ownership and approval

- Derive vehicle ownership from the Courier profile and Logistics scope from its affiliation and sole hub.
- Never trust a submitted organization, hub, Courier owner, approval flag, or storage path as authority.
- Only the associated Logistics organization reviews its Courier's application and private evidence.
- Registration does not approve the application or issue a bearer token.
- Fleet actions must not approve Couriers, assign Orders, change custody, or make a Courier online.
- Keep active account, approved affiliation, and task authorization independent of this registry.
- Require exactly one vehicle when hardening approval; do not silently select the first duplicate row.
- The existing active-vehicle existence check does not establish exactly-one enforcement.
- Courier self-service edits take effect on a successful validated save without Logistics reapproval; notify the associated Logistics account after commit. Never reset User/affiliation approval or claim updated documents were manually approved.

### Private OR/CR

- Use `docs/references/file-upload-requirements.md` as the mandatory upload/storage/access policy.
- Define only vehicle ownership and lifecycle here; do not duplicate or override shared validation.
- The current registration API uses one multipart image part named `vehicle_registration`.
- It is separate from `government_id`; neither accepts Base64 JSON or arbitrary storage paths.
- The existing API does not accept separate OR and CR fields or a document array.
- Review must establish that both required documents are represented and readable.
- Target registration requires separate `official_receipt` and `certificate_of_registration` image parts, plus existing `government_id`. This replaces the combined field only after a coordinated backend/Flutter rollout; reject mixed legacy/new forms and do not silently treat one file as both documents.
- Presence of one uploaded image alone does not verify both documents.
- Retain private registration evidence in the existing Document/storage abstraction.
- Authorize every preview; never expose OR/CR in public Courier cards or dispatch/route DTOs.
- Missing or inaccessible evidence shows a review-blocked state, not successful verification.
- Replace OR and CR independently: omission preserves the other document, and null/delete is not a replacement. Both are required for new registrations; existing missing slots can be completed independently. Validate the new object before atomically swapping only its pointer; failures preserve the old file.
- Preserve evidence referenced by initial approval; current vehicle documents are separate pointers, not rewrites of that approval. Clean up failed uploads and unreferenced replaced objects after commit with retryable cleanup; never delete referenced evidence.

### Cardinality and compatibility

- Registration creates one initial Vehicle; a new additive migration enforces a unique `vehicles.courier_profile_id` constraint after a duplicate preflight.
- Uniqueness enforces at most one; transactional registration and completeness checks enforce required existence.
- Audit missing/duplicate vehicles before rollout; do not delete rows or select a winner automatically.
- Resolve anomalies through an explicitly reviewed data-correction plan before applying uniqueness.
- Preserve IDs, private documents, plates, foreign keys, and operational references.
- Never modify an executed migration or use fresh migrations/reseeding to reconcile existing data.
- Existing `capacity` columns and `maintenance` enum values remain compatible storage, not MVP requirements.
- This documentation revision does not remove their values or change PHP enums.
- Add nullable separate Document references and a revision field to Vehicle; enforce ownership and document purpose. Keep old combined evidence as legacy until the Courier supplies each separate document; do not manufacture two verified records from it.

### Dispatch boundary

- Deploy Rider owns assignments and consumes only supported vehicle identity information.
- No capacity unit is approved; do not infer capacity from vehicle type or treat null as unlimited.
- Missing capacity or maintenance data must not introduce a new MVP dispatch block.
- Schedule parcel limits and Courier overlap rules are separate operational contracts, not vehicle capacity.
- One vehicle does not mean one lifetime Order or one parcel per schedule.
- Preserve one Order per task and schedules grouping multiple Orders.

### Acceptance criteria

- [x] The deployed registration/approval compatibility flow creates and reviews one Courier-owned vehicle; the additive unique constraint and cardinality checks prevent ambiguous fleet records. Separate OR/CR completion remains available for legacy registrations.
- [x] Concurrent updates lock the sole vehicle, use optimistic revisions, and preserve database-wide plate uniqueness.
- [x] Existing duplicate rows are not deleted or auto-selected; migration preflight stops before applying uniqueness and reports the rows for an explicit correction plan.
- [x] Separate OR/CR replacements require valid decoded image content under the shared upload policy; missing or inaccessible evidence is never presented as verified.
- [x] Foreign-role and cross-organization requests return scoped `404` responses and private streams are authorization-gated.
- [x] The API exposes supported multipart fields, UUID idempotency replay/conflict behavior, and no Courier web UI; Flutter consumption remains the client rollout task.
- [x] No maintenance, vehicle history, capacity input/unit, or capacity matching is required in the MVP.
- [x] Existing approval decisions, shipment history, schedules, and task transitions remain intact.

## HOW

### Reuse current owners

- Courier Auth owns implemented `POST /api/v1/courier/auth/register`.
- Preserve its public multipart request, field validation, throttling, pending response, and no-token boundary.
- Logistics Courier Approval owns the implemented list/detail, private document, and approve/reject endpoints.
- Read `docs/features/logistics/courier-approval/spec.md` for exact authorization, DTOs, errors, and retries.
- Read `docs/features/courier/auth/spec.md` for Flutter registration/session and multipart contracts.
- This spec adds only the scoped vehicle read/edit and OR/CR replacement endpoints; fleet creation/deletion, maintenance, and assign/unassign endpoints remain unavailable.
- The following routes are implemented and are separate from account/profile endpoints; those endpoints do not accept vehicle fields.

### Implemented Courier API and notifications

- All routes below require Sanctum bearer auth, active Courier/approved affiliation/active Logistics/sole hub, and applicable policy consent. Derive the sole vehicle from the caller; no client owner IDs. Return private, no-store responses.
- `GET /api/v1/courier/vehicle`: no body; `200 {data: {id, vehicle_type, plate_number, make, model, revision, official_receipt, certificate_of_registration}}`. Document entries are null or `{id, url}` for authorized delivery; no paths or approval claims.
- `PATCH /api/v1/courier/vehicle`: JSON with required `expected_revision` and any submitted `vehicle_type`, `plate_number`, `make`, `model`; omitted fields are unchanged, null only clears make/model. Return `200` with the full committed vehicle projection.
- `POST /api/v1/courier/vehicle/documents/{kind}`: multipart `file` plus `expected_revision`; kind is `official_receipt` or `certificate_of_registration`. Apply the shared image policy and return `200` with the vehicle projection; never require resubmitting the other image.
- `GET /api/v1/courier/vehicle/documents/{kind}`: private current-document stream, owner-only, detected MIME and nosniff. No delete endpoint; safe to retry reads.
- Mutations require a UUID `Idempotency-Key`, scoped to actor/vehicle/action and payload fingerprint (including file digest). Exact retries replay the committed result without another notification; changed payloads conflict. Lock the Vehicle and check revision before writing; reject stale revisions with `409`.
- Errors: `401` invalid token; `403` role/access/consent; scoped `404` missing vehicle/document; `409` revision/idempotency/cardinality conflict; field-addressable `422` invalid/duplicate plate, prohibited fields or file; `429` throttled; retryable server/storage failure. Use code/message/errors envelopes and preserve data on failure.
- Plate/type edits update the same sole Vehicle, never create another one. Couriers must keep both documents applicable to the current vehicle; the system does not certify authenticity or require both files on every edit. Existing task/waybill snapshots are not rewritten.
- Persist one durable `logistics-courier.vehicle-updated` notification intent per committed changed revision for the associated Logistics account. No-op saves do not notify. Delivery retries cannot undo edits or duplicate alerts; no email guarantee.
- Alert data contains Courier/vehicle references, changed field names and server time, not documents, full plates or old/new private values. Logistics reads current details through an authorized registry view, never Courier-owner routes; unavailable destinations remain null.
- Implemented Logistics read routes: `GET /api/v1/logistics/couriers/{courier}/vehicle` (same safe projection) and `GET /api/v1/logistics/couriers/{courier}/vehicle/documents/{kind}` (private stream). Require active Logistics/consent and current affiliation/sole-hub scope; foreign records return `404`. No Logistics edit/reapproval action.
- Flutter provides independently dirty vehicle fields and separate OR/CR pickers/previews, upload progress and retry. Refetch after uncertain saves; refresh on conflicts without discarding unsent edits. Never queue mutations offline or display planned routes as live.
- [ ] Each editable field saves without reapproval; unrelated fields, the other document, and registration/operational history remain unchanged.
- [ ] Independent upload, failed replacement, stale/concurrent writes, duplicate retry, tenant isolation, and after-commit notification failure are verified before release.

### Verification and client behavior

- Inspect Vehicle, CourierProfile, registration, approval completeness, and their tests before implementation.
- Add SQLite/PostgreSQL migration tests for existing data, uniqueness, and non-destructive rollout.
- Test concurrent vehicle creation, missing records, wrong ownership, and private evidence delivery.
- Test shared upload validation and transaction-failure cleanup through the registration owner.
- Logistics review shows Courier, type, plate, and OR/CR preview—not maintenance/capacity tabs.
- Flutter registration shows vehicle fields and OR/CR requirements, upload progress, and field errors.
- Preserve loading, forbidden, unavailable evidence, validation, timeout, and retry states without false success.
- Do not ordinary-cache private evidence; clear private previews on session loss.
- No new package, map provider, or government service is required.
- Update external Flutter copies for these newly implemented API routes before shipping the mobile flow; no Courier web UI belongs in this repository.
- Keep any future Flutter acceptance criteria unchecked until the external client rollout and end-to-end verification establish the behavior.
- Append documentation and implementation results separately to `docs/PROGRESS.md`.
