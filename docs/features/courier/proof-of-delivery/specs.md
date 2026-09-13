---
role: Courier / Rider
feature: courier-proof-of-delivery
title: Proof of Delivery (e-POD)
system: AISLEY
type: Feature Specification
version: 1.3
status: Implemented P0 QR/reference proof submission; media extensions deferred
implementation_status: Courier QR/reference proof records and Logistics validation are implemented; image/signature uploads remain deferred
canonical: true
scope: External Flutter mobile client and Laravel Courier API
backend_contract_commit: d1abeee73d0141e1fd7dda4bea0ee3fead370378
backend_contract_version: courier-epod-v1-qr
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Courier.md, docs/domains/Logistics.md, docs/references/file-upload-requirements.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Proof of Delivery (e-POD)

## WHAT

- **Purpose:** Capture evidence that an authorized Courier handed the parcel to the Buyer or placed it at the approved destination.
- **Actor boundary:** Courier captures and submits evidence in the external Flutter app. Logistics validates and records the authoritative evidence event; Complete Delivery owns the final `delivered` transition.
- **Current implementation:** `shipment_evidence` stores Courier-scoped QR/reference proof for final-mile hub pickup and delivery. The Courier submission is pending until Logistics validates it through Update Status; photo/signature upload and private media delivery remain deferred extensions.
- **Flow:** accepted final-mile task → Courier reaches destination → capture approved proof → submit to Logistics → Logistics validates/records → Complete Delivery checks proof → `delivered`.
- **Task boundary:** Evidence belongs to exactly one authorized Delivery Task and its Order/Parcel. First-mile handoff evidence is handled by Pick Up Order; final-mile proof is handled here.
- **Non-goals:** task assignment/acceptance, navigation, pickup, returns/refunds, partial fulfillment, dispute decisions, payment, Courier web UI, or direct Order-status editing.

```text
final-mile task
→ drop-off evidence capture
→ Courier submission
→ Logistics validation/recording
→ proof satisfied
→ Complete Delivery
```

## MUST

### Authentication and ownership

- Require `auth:sanctum`, `courier.active`, and `policy.consent`; Flutter sends `Authorization: Bearer <token>`.
- Resolve the Courier, task, Order/Parcel, Logistics organization, and sole hub server-side. Never trust client `courier_id`, owner IDs, target status, or storage path.
- The Courier must have an accepted final-mile task and the task must be in the approved delivery/drop-off state.
- Evidence may be created only for that task's Order/Parcel and the authenticated Courier's current Logistics affiliation.
- Cross-role, cross-organization, foreign task, guessed proof ID, or inactive-account access fails closed without existence disclosure.

### Logistics validation and recording authority

- Courier captures photo, signature, delivery QR/reference, or another method only when the approved proof policy permits it.
- Courier submits the evidence to the owning Logistics organization; the client does not mark proof `verified`, change custody, or set `delivered`.
- Logistics validates task/Order/Parcel linkage, final-mile leg, current state, Courier authorization, evidence type, required fields, storage confirmation, and idempotency.
- Logistics records the authoritative evidence event with the performing Courier, recording Logistics account, server timestamp, task/Order references, and safe evidence metadata.
- `waybill_access_events` and QR resolves remain access audits. A scan/access event alone never satisfies e-POD or advances custody.
- Evidence status is separate from delivery state: `awaiting_validation`, `validated`, `rejected`, or `unavailable`; submission time is `submitted_at`, not a new persisted `submitted` status.
- Complete Delivery may finalize only when the server reports that the configured proof requirement is durably satisfied.

### Evidence methods and upload policy

- The implemented method is QR/Order-reference submission at `out_for_delivery`; photo/signature methods and combinations are deferred, not selectable production methods.
- If an image is enabled, inherit `docs/references/file-upload-requirements.md`: JPEG/JPG, PNG, or WebP, strictly under 10 MiB, detected MIME/signature/decode validation, generated object key, and private authorized delivery.
- Store bytes in the configured private filesystem/object-storage abstraction (Azure-compatible in this project); store only generated path and required metadata in the database.
- Never expose raw disk/blob paths, cloud credentials, bearer tokens, or public predictable evidence URLs.
- Do not require AI image recognition, face recognition, OCR, geofencing, or a hosted provider without a separate approved policy.
- A copied waybill QR is not automatically a delivery proof QR. The shared contract must explicitly map any delivery verification token.

### Data minimization and privacy

- Evidence is linked to one task, Order/Parcel, Courier, and Logistics organization; no cross-order reuse is allowed.
- Capture only the minimum image/signature/QR data needed to prove handoff. Avoid unrelated people, rooms, documents, or private information in photos.
- Buyer/Seller access, Logistics support access, and retention are policy-controlled; default evidence visibility is private and authorized.
- Flutter may show proof progress and safe state but never raw storage paths or unrestricted evidence lists.
- Evidence DTOs exclude payment credentials, registration documents, reviewer notes, unrelated PII, and unrestricted Courier location history.

### Lifecycle and completion boundary

- Capture and upload do not themselves set `delivered`; Complete Delivery invokes a server-side proof check.
- A failed or rejected proof leaves delivery state unchanged and gives the Courier a safe retry or corrected-capture action.
- Once valid proof is recorded, it is append-only; ordinary Courier actions cannot overwrite it after completion.
- A Logistics manual recovery must use the same transition service and preserve the original Courier event; it cannot fabricate proof or bypass required evidence.
- Delivery failure, returns, refunds, and partial fulfillment remain deferred and are not inferred from a failed upload.

### Reliability and offline boundary

- Use an idempotency key and expected task revision for submission. Matching retries return the same evidence projection; changed payloads or stale state return `409`.
- Confirm object storage before evidence becomes `validated`; reconcile orphaned objects and failed database writes without claiming proof success.
- Offline capture is not authoritative in the MVP. A future encrypted local queue must replay through Logistics validation and may be rejected as stale.
- Communication, notification, or route-provider failure after Logistics records evidence cannot roll back the committed event.
- Camera/storage denial, invalid QR, corrupt image, timeout, throttling, and server errors remain explicit recoverable states.

## HOW

### Implemented endpoint contract and deferred media extension

- `POST /api/v1/courier/tasks/{task}/proof-of-delivery` — implemented for the P0 QR/reference contract; accepts JSON `identifier_type`, `identifier`, and the expected task revision plus UUID `Idempotency-Key`. It creates awaiting-validation evidence and never sets `delivered`.
- `GET /api/v1/courier/tasks/{task}/proof-of-delivery` — deferred; use the task/completion projections while a dedicated proof-read contract is finalized.
- Multipart photo/signature submission remains deferred; it must follow `docs/references/file-upload-requirements.md` when enabled.
- The client must not submit `courier_id`, organization/hub IDs, target status, `verified`, `delivered`, raw storage paths, or another task's Order ID as authority.
- HTTP 202 returns `data.task_id`, `proof_id`, `evidence_status`, `custody_state`, `completion_eligible: false`, and `submitted_at`. Map this `proof_id` to completion's `evidence_id`; unlike hub pickup, the response names it `proof_id`.
- Errors distinguish `401`, `403`, `404`, `409`, `422`, `429`, timeout, offline, storage, and notification failure. Identical retries are safe; uncertain responses require a fresh GET.
- All responses are private and `Cache-Control: private, no-store`; signed/capability media delivery, if approved, is short-lived and authorization-checked.

### Submission details

- JSON accepts only `identifier_type` (`qr` or `order_id`), `identifier` (string, at most 128 characters), and `expected_revision` (integer at least 1); a UUID `Idempotency-Key` is required in the header.
- The task ID, Order/Parcel link, Courier identity, Logistics organization, and current delivery state are derived server-side.
- Multipart image fields use the shared upload policy; filenames, extensions, and browser MIME values are hints only and never authorization.
- A signature is submitted as a bounded vector or image representation only when the policy and endpoint permit it; it is linked to this task and cannot be reused.
- A QR/reference submission proves only the configured recipient/handoff verification. It is not automatically the shared waybill resolve event.
- `expected_revision` belongs in JSON and the UUID belongs in the `Idempotency-Key` header, not an `idempotency_key` JSON field. Retain the exact attempt across uncertain retries.
- A new submission returns `awaiting_validation`; matching retries reuse the evidence record with refreshed related state. Neither a scan nor HTTP 202 alone means delivered.

```json
{
  "identifier_type": "qr",
  "expected_revision": 4,
  "identifier": "assigned-waybill-qr-value"
}
```

### Evidence lifecycle and access

- `submitted_at` records submission time; `awaiting_validation` identifies pending review; `validated` means accepted evidence; `rejected` means refused; `unavailable` is not successful proof.
- Logistics may reject an evidence submission with a safe reason; the Courier can correct and resubmit without overwriting the rejected history.
- A validated record contains immutable task/Order/Parcel, Courier, Logistics recorder, method, server time, and storage metadata.
- Complete Delivery uses the proof UUID as `evidence_id`, current task revision, explicit confirmation, and its own API validation; the proof response's `completion_eligible` is currently always false, not a live eligibility query.
- Buyer, Seller, Logistics, and Admin read permissions are separate policy decisions; private-by-default remains the fallback.
- Any media delivery uses an authorized application stream or short-lived capability URL and `no-store`; raw blob paths never leave the server.
- Evidence correction, deletion, retention, and dispute access append history rather than changing the original event.

### Upload and partial-failure rules

- Validate size, detected MIME, signature, image decode, and resource limits before permanent storage; reject malformed or spoofed files with `422`.
- Store media in the configured private disk/object store and persist only generated object metadata. Never embed cloud credentials in Flutter.
- Do not mark evidence `validated` until storage confirmation and the Logistics recording transaction both commit.
- If storage succeeds but the database write fails, quarantine/clean up the orphan and return a retryable failure; never report proof success.
- If the database commits but notification delivery fails, evidence remains committed and notification retries separately.
- Client previews, local signatures, and upload progress are provisional until the server response confirms the evidence state.

### Error and retry mapping

- `401` signs the Courier out; `403` means inactive/unauthorized task or affiliation; `404` hides foreign task/proof existence.
- `409` means stale task revision, duplicate/conflicting evidence, or completion race; refresh the task before retrying.
- `422` returns field-addressable proof/file errors; `429` supplies retry-after; timeout/offline keeps the attempt uncertain until a fresh GET.
- Camera or signature permission denial is recoverable and never satisfies proof. Scanner mismatch remains a rejected evidence attempt.
- Flutter must disable duplicate taps while pending, reuse the idempotency key after a timeout, and never create a second proof locally.

### Flutter proof screen

- Show task/Order reference, destination context, required methods, evidence status, upload progress, and the next server-authorized action.
- Use explicit actions **Capture photo**, **Collect signature**, **Verify QR**, and **Submit proof** only when enabled by the response.
- Announce validation/rejection reasons textually, provide retake/correct-and-resubmit actions, and keep controls keyboard/screen-reader accessible.
- Clear private previews and cached evidence on logout, account denial, affiliation revocation, or task removal.
- The app must work with text status and no map; route/navigation belongs to Deliver Order.

```json
{
  "data": {
    "task_id": "task-uuid",
    "proof_id": "evidence-uuid",
    "evidence_status": "awaiting_validation",
    "custody_state": "out_for_delivery",
    "completion_eligible": false,
    "submitted_at": "server-time"
  }
}
```

### Backend implementation boundary

- The additive fulfillment migration supplies QR evidence, task links, actor/history and revision records. Media storage/upload/delivery remains a separate extension, not a prerequisite for current QR submission.
- Use one transition/evidence service for ownership, proof policy, file validation, storage confirmation, idempotency, and completion checks.
- Logistics Update Status owns validation and authoritative recording; Courier e-POD owns capture/submission; Complete Delivery owns finalization.
- Keep enum-like columns string-backed with PHP enum casts and do not add detailed physical states to `orders.status` without an approved migration.

### Flutter states and UX

- Screen states: task loading, proof requirements, camera/signature permission, capture, preview, upload progress, awaiting Logistics validation, validated, rejected, missing proof, conflict, offline, and retry.
- Show the task/Order reference and destination context needed for the handoff, but never imply proof success from a local preview or completed upload progress bar.
- Explain accepted image types and the 10 MiB limit before selection; use accessible labels, text status, large touch targets, and non-color-only errors.
- Preserve the idempotency key across timeout/retry; clear private evidence previews and cached task data on logout or authorization loss.
- After QR submission, use Complete Delivery's GET/POST contract for intent; evidence may await validation. Only Logistics finalization establishes delivered, not a client-computed eligibility flag.

### Tests, observability, and rollout

- Test role/task/Order/organization isolation, wrong QR, cross-order reuse, invalid proof, upload limits/signatures, storage partial failure, private delivery, duplicate submissions, stale revisions, and actor preservation.
- Test that Logistics records the Courier performer and Logistics recorder, that access/scan does not satisfy proof, and that notification failure cannot undo evidence.
- Flutter tests cover capture permissions, file validation feedback, progress/retry, secure storage, offline/timeout/conflict states, and accessibility.
- Log task/proof/event IDs, performing Courier, recording Logistics account, evidence state, result, revision, and timestamp; never log media bytes, raw paths, or QR tokens.
- Keep media upload endpoints unavailable until the shared file policy and storage contract are deployed. The QR/reference submission is live with the shared transition service; record its API revision separately from the deferred media extension in Flutter progress.

### Open decisions

- Confirm which proof method(s) are required for each delivery and who may sign or receive the parcel.
- Confirm Logistics/Admin/Buyer/Seller read permissions, retention/deletion, malware scanning, and whether direct-to-object-storage upload is allowed.
- Confirm QR issuer/expiry/replay policy and offline capture/replay behavior.

### Acceptance criteria

- [x] Courier can submit only QR/reference evidence for its accepted final-mile task and linked Order/Parcel.
- [x] Logistics validates and records the implemented evidence with performing Courier and recording Logistics account preserved.
- [x] Evidence status is separate from custody; invalid, duplicate, or access-only events do not advance delivery.
- [x] QR evidence is scoped, persisted, idempotent, and consumable by Complete Delivery; file validation/storage is deferred with media proof.
- [x] e-POD never directly sets `delivered`, changes assignment, or decides refunds/returns.
- [ ] Verify external Flutter QR submission, pending validation, rejection, offline, conflict, and retry states; media-upload UI remains deferred.

**References:** `docs/features/courier/rules.md`, `docs/features/shared/shipment-fulfillment/spec.md`, `docs/references/file-upload-requirements.md`, `docs/features/logistics/update-status/specs.md`, `docs/features/courier/pick-up-order/specs.md`, and `docs/features/courier/complete-delivery/specs.md`.
