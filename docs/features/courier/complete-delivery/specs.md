---
feature: courier-complete-delivery
title: Complete Delivery
system: AISLEY
type: Feature Specification
version: 1.3
status: Implemented P0 QR completion flow; advanced proof methods deferred
implementation_status: Completion intent, Logistics proof validation, atomic delivered transition, and history records are implemented; Flutter UI is external
canonical: true
role: Courier
scope: Laravel API and external Flutter application
backend_contract_commit: d1abeee73d0141e1fd7dda4bea0ee3fead370378
backend_contract_version: courier-completion-v1-qr
---

# Complete Delivery

## WHAT

- Finalize a final-mile delivery after Courier intent and Logistics-validated proof.
- Courier submits completion intent; Logistics validates the evidence and records the authoritative decision.
- The shared fulfillment transition service owns the atomic final state change.
- Final-mile completion is implemented through the shared fulfillment transition service; first-mile pickup still never means Buyer delivery.
- Courier completion and Logistics transition routes are available only after the additive migration has been applied and the authenticated role/affiliation checks pass.
- Preserve one Shipment/Parcel per Order and independent first-mile/final-mile assignments.
- Seller receives the result and never marks an Order delivered.
- Proof of Delivery owns capture, uploads, validation records, and private media delivery.
- Delivery History owns read-only completed final-mile records.
- Exclude returns/refunds, partial fulfillment, payments, payouts, tips, reviews, chat, and incident recovery.
- Exclude automatic completion from GPS, map arrival, QR resolution, or notification delivery.

```text
out_for_delivery
→ Courier submits completion intent and proof reference
→ Logistics validates proof and current assignment
→ shared service commits delivered
→ Customer/Seller notification and Courier history
```

## MUST

### Identity and authority

- Courier requests require Sanctum bearer authentication, courier.active, and policy.consent; `POLICY_CONSENT_REQUIRED` opens acceptance without discarding a valid token.
- Recheck active account, approved affiliation, active Logistics organization, and sole hub.
- Scope each task to the authenticated Courier and its current final-mile assignment.
- Use UUID task references; same-email accounts under another role have no Courier authority.
- Derive organization, hub, Order, Parcel, leg, Courier, and current state server-side.
- Reject client status, reviewer, delivered time, organization, hub, and arbitrary media URLs.
- Logistics validation requires its own active authenticated organization account.
- Logistics may validate only tasks belonging to its sole hub and selected-provider context.
- Preserve both the performing Courier and validating/recording Logistics actor.
- No first-mile Courier gains final-mile completion authority merely by collecting the parcel.

### State and proof

- Final-mile task and Shipment must be out_for_delivery before a new completion intent is accepted.
- Proof must belong to the same task, Parcel, Order, and assigned Courier.
- Required proof must be durably stored and validated by Logistics before finalization.
- Missing, rejected, pending, or inaccessible evidence keeps delivery state unchanged.
- Mandatory proof type/combination remains owned by the Proof of Delivery policy.
- Do not silently choose photo, signature, OTP, or recipient QR as universally required.
- A configured proof policy must exist before enabling completion.
- Courier submits an opaque evidence UUID, never storage credentials or raw blob paths.
- Proof submission may precede completion intent; either alone cannot set delivered.
- Finalization consumes a validated proof decision and an explicit Courier completion intent.
- Use delivered for the target final-mile task, Shipment, and high-level Order projection.
- Do not introduce a separate completed database value solely for history filtering.
- The UI may label delivered as “Completed.”
- Commit all three projections and one completion event in the same transaction.
- Record delivered_at from the server's successful finalization time in UTC.
- Preserve evidence performance/submission times separately from delivered_at.
- The completed first-mile task remains unchanged.
- Final-mile completion does not reserve, release, or fulfill stock again.
- Do not change payment_status or infer COD payment collection from delivered.
- Post-pickup cancellation, failure recovery, returns, refunds, and partial fulfillment remain deferred.

### Reliability and history

- Use a task/actor/organization/action-scoped Idempotency-Key and request hash.
- Matching retries reuse the same intent and reload its current related state after route-level authorization; the response is not a byte-identical original snapshot.
- A reused key with changed payload returns 409 IDEMPOTENCY_KEY_REUSED.
- Store completion intent separately from physical state.
- Only one successful delivered event may exist per Shipment/final-mile task.
- Lock current assignment, task, Shipment, Order, and proof decision consistently.
- Recheck expected revision and proof eligibility inside the transaction.
- A conflicting reassignment or validation returns 409 without overwriting history.
- After hub pickup, assignment/custody history cannot be rewritten.
- Append all accepted/rejected validation decisions with actor, time, and reason.
- Never delete proof/history when a notification is marked read.
- Preserve original request/event IDs for uncertain-response recovery.
- Do not call routing, email, push, or object-storage networks while holding completion locks.

### Notifications and consumers

- Persist durable delivery-notification work with the completion transaction.
- Derive Customer and Seller recipients from the Order and Shop.
- Deliver through the existing notification infrastructure after commit.
- Deduplicate each recipient/type by the completion event identity.
- Provider failure leaves delivered unchanged and retries communication separately.
- A rollback cannot emit a normal delivered notification.
- Dashboard refetch removes a completed final-mile task from active work.
- Delivery History reads the committed final-mile delivered event.
- Earnings, settlement, tipping, reviews, and metrics require separate approved consumers.
- Do not calculate or invent financial entitlements in this feature.

### Flutter and privacy

- Production UI belongs in the external Flutter repository.
- Store bearer tokens in OS secure storage and send Authorization: Bearer.
- Use JSON model keys exactly as specified by the implemented API revision.
- Load safe Order/task references, delivery state, proof status, and capability reasons.
- Show recipient/destination details only when returned by the authorized active-task contract.
- Never expose registration documents, payment secrets, private reviewer notes, or raw paths.
- Show “Awaiting Logistics validation” for accepted intent that is not finalized.
- A successful submission acknowledgment must not show “Delivered.”
- Disable duplicate taps during a request; retain its idempotency key after timeout.
- Refetch completion status after an uncertain result before starting another action.
- Do not optimistically remove a task before server-confirmed delivered state.
- Offline completion queues are deferred; connectivity is required for submission.
- Camera, signature, and file permissions belong to Proof of Delivery.
- Completion itself adds no GPS permission, geofence, map package, or external provider.
- Show loading, proof-required, pending-review, delivered, denied, conflict, retry, and offline states.
- Use accessible labels, screen-reader status announcements, adequate touch targets, and text statuses.
- On logout, account switch, or authorization loss, clear private in-memory completion data.
- HTTP responses use Cache-Control: private, no-store.

## HOW

### Implemented endpoints

| Method and path                                  | Actor            | Purpose                                               |
| ------------------------------------------------ | ---------------- | ----------------------------------------------------- |
| GET /api/v1/courier/tasks/{task}/completion      | Assigned Courier | Read eligibility, intent, proof, and committed result |
| POST /api/v1/courier/tasks/{task}/completion     | Assigned Courier | Submit explicit completion intent                     |
| POST /api/v1/logistics/update-status/transitions | Owning Logistics | Validate QR proof and atomically finalize delivery    |

- The Logistics route is owned by Update Status; this spec does not create a second validation endpoint.
- Courier POST uses application/json plus a UUID Idempotency-Key header.
- Request fields: expected_revision (integer at least 1), evidence_id (UUID), confirmed (must be true).
- Reject unknown authority fields and unrelated evidence references.
- GET has no body and no client-controlled ownership parameters.
- New intent and matching replay return 202. Replay may reflect updated intent/task state but still returns `delivered_at: null`; use GET for the authoritative completion projection and timestamp.
- Finalization is visible through a fresh GET, not inferred from an earlier 202.
- Initial GET may return intent_id null and delivered_at null.

```json
{
  "expected_revision": 4,
  "evidence_id": "00000000-0000-4000-8000-000000000001",
  "confirmed": true
}
```

```json
{
  "data": {
    "task_id": "00000000-0000-4000-8000-000000000002",
    "intent_id": "00000000-0000-4000-8000-000000000003",
    "task_status": "out_for_delivery",
    "order_status": "out_for_delivery",
    "evidence_status": "awaiting_validation",
    "completion_status": "awaiting_validation",
    "delivered_at": null,
    "revision": 5
  }
}
```

- completion_status is a response/intent field, not a new OrderStatus.
- After finalization GET returns delivered task/order states, `completion_status: validated`, and `delivered_at`; the task/Shipment/Order `delivered` state is authoritative.
- The implementation must document its concrete throttling limit before release; no client relies on an invented limit.

### Proposed errors

| HTTP | Code                      | Client action                                      |
| ---- | ------------------------- | -------------------------------------------------- |
| 401  | UNAUTHENTICATED           | Restore authentication                             |
| 403  | COURIER_ACCESS_DENIED     | Clear protected state and show account restriction |
| 404  | TASK_NOT_FOUND            | Stop exposing the task                             |
| 409  | COMPLETION_STATE_CONFLICT | Refetch current projection                         |
| 409  | IDEMPOTENCY_KEY_REUSED    | Retain original request; fix conflicting input     |
| 409  | PROOF_NOT_VALIDATED       | Show pending/required proof state                  |
| 422  | VALIDATION_FAILED         | Show field errors                                  |
| 429  | TOO_MANY_REQUESTS         | Respect Retry-After                                |
| 503  | FULFILLMENT_UNAVAILABLE   | Show unavailable; no local completion              |

- Error envelopes use message, code, and optional field-addressable errors.
- A missing route or unapplied migration is unavailable, not an empty completion response.
- Network timeout does not prove either transaction failure or success.

### Implementation and verification gate

- These records and routes exist through the additive fulfillment migration; deploy that migration before client integration rather than recreating the schema.
- Follow the first-mile migration bridge in docs/schema.md; do not replay historical fulfillment.
- Use the shared transition service; controllers and Flutter never directly assign status.
- Keep unavailable routes disabled until migrations and schema-health checks pass.
- Test SQLite and PostgreSQL schema, foreign keys, uniqueness, and append-only constraints.
- Test IDOR, role/status/affiliation denial, wrong leg, and unrelated evidence.
- Test pending/rejected proof, premature completion, and duplicate intent.
- Test concurrent Logistics decisions and stale assignments without double completion.
- Test rollback atomicity across task, Shipment, Order, event, and notification work.
- Test that final delivery leaves inventory and payment fields unchanged.
- Test legacy pickup bridge records do not create false final-mile history.
- Test notification failures and retries independently from completion state.
- Flutter tests cover pending 202 versus delivered 200, nullable fields, timeout retry, and secure-storage failures.
- Record the actual backend commit and executed test results before updating copied Flutter contracts.

### Acceptance criteria

- [x] Only the eligible final-mile Courier submits completion intent.
- [x] Logistics validation and required QR proof gate delivered.
- [x] Task, Shipment, Order, history, and notification work commit atomically.
- [x] Retries/concurrency cannot duplicate delivery or Inventory effects.
- [ ] Verify external Flutter distinguishes pending evidence from confirmed delivery; this repository cannot certify its screens.
- [x] Private DTOs and history remain scoped and immutable.
- [ ] Complete PostgreSQL release verification and external Flutter contract tests; recorded SQLite coverage alone does not satisfy this gate.

### Deferred extensions

- Proof method combinations remain governed by the owning evidence policy.
- Incident recovery, post-delivery chat, earnings, review/tipping, and external carrier callbacks are deferred.
- No offline mutation, global realtime/push transport, or automatic evidence retention deletion is enabled here.

### References

- Shared authority: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/features/shared/shipment-fulfillment/spec.md.
- Roles: docs/domains/Courier.md and docs/domains/Logistics.md.
- Features: docs/features/courier/proof-of-delivery/specs.md, docs/features/logistics/update-status/specs.md, docs/features/courier/delivery-history/specs.md.
- Uploads: docs/references/file-upload-requirements.md.
