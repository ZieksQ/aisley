---
feature: confirm-delivery
title: Seller Delivery Confirmation
system: AISLEY
type: Feature Specification
version: 1.1
status: Revised target contract; delivered-event integration deferred
role: Seller
scope: Laravel API and Seller React dashboard
---

# Seller Delivery Confirmation

## WHAT

- Inform the Seller when authoritative final-mile delivery reaches `delivered`.
- This is a read/notification feature, not Seller approval of Buyer receipt.
- Existing Seller notification and Order-detail infrastructure is implemented.
- Physical final-mile completion and its delivery-specific notification integration are not implemented.
- Courier submits completion intent and proof; Logistics validates; the shared service commits delivery.
- Seller and Customer consume the same committed Order milestone.
- Use the existing Seller React/TypeScript dashboard, not a new Next.js app.
- Reuse the notification inbox and Order detail; a separate confirmation page is unnecessary.
- Exclude Seller status mutation, proof upload, assignment, payments, settlement, refunds, and reviews.
- External carrier callbacks, realtime transport, and notification preferences remain separate extensions.

```text
Courier completion intent + proof
→ owning Logistics validates
→ shared service commits delivered and durable notification work
→ Seller inbox and Order timeline read the committed outcome
```

## MUST

### Authority and state

- Use canonical role `seller` and persisted Order status `delivered`.
- Require authenticated active, approved Seller access and server-derived Shop ownership.
- Scope notification and Order queries before lookup/serialization.
- Same-email accounts in other roles confer no Seller permissions.
- Seller cannot provide status, delivered timestamp, Courier, reviewer, or recipient overrides.
- Seller has no mark-delivered endpoint or UI control.
- First-mile `picked_up` and waybill scans never imply Customer delivery.
- Completion requires the final-mile `out_for_delivery` state and approved proof contract.
- Logistics is the authoritative validator/recorder; Courier does not directly finalize custody.
- The shared service commits task, Shipment, Order, immutable event, and notification work atomically.
- `delivered_at` is server UTC finalization time, distinct from scan and notification times.
- No delivery notification is produced for an uncommitted or rejected completion.
- Seller read actions cannot reserve, release, fulfill stock, or change payment state.
- COD collection and settlement must not be inferred merely from `delivered`.

### Notifications and reliability

- Reuse existing database/in-app notifications rather than a separate confirmation table.
- Derive the Seller recipient from the Order's owning Shop.
- Deduplicate delivery notification work by completion event, recipient, and notification type.
- Persist durable work in the source transaction; deliver through the notification infrastructure after commit.
- Queue/provider failure leaves delivery committed and retries separately.
- Notification read state is Seller-specific and never acknowledges physical receipt.
- Retried mark-read requests must remain harmless and never create delivery events.
- Optional mail/push/realtime must not be required for the in-app outcome to exist.
- Refetch recovers missed communication without replaying fulfillment.

### Safe delivery projection

- Proposed delivery extension: Order reference, `delivered`, `delivered_at`, event reference, and safe proof status.
- These delivery-specific fields are planned; existing endpoints do not guarantee them today.
- Use immutable Order/item/address snapshots for history, not current profile or catalog fields.
- A delivered timestamp must come from its event, not `updated_at` or inbox read time.
- Seller and Customer timelines must agree on the same completion event.
- Notification payloads omit full destination address, private proof bytes, secrets, and raw storage paths.
- Seller sees only its own Order/item scope.
- Proof summary access does not automatically grant media access.
- Raw proof preview remains deferred until the owning evidence policy explicitly permits Seller access.
- Seller may not replace, delete, or edit Courier evidence.
- Deleting or reading a notification never removes custody or completion history.
- Retain historical delivery records; automatic retention deletion is not introduced here.

### Seller UI

- Use the existing inbox and authorized Order-detail navigation.
- Distinguish loading, empty inbox, unread/read, delivered, unavailable, forbidden, and retry states.
- A pending Courier submission must not appear as a delivered notification.
- Display authoritative status and localized delivery time with readable text.
- No optimistic delivered state or manual confirmation button is allowed.
- Keyboard navigation, screen-reader labels, and status announcements must work without color alone.
- Preserve notification state during recoverable fetch failure; clear protected data on authorization loss.
- Do not add maps or force an external messaging provider.

### Acceptance criteria

- [ ] Only the owning Seller receives and reads the delivery outcome.
- [ ] Seller cannot mark an Order delivered or alter proof/custody.
- [ ] Logistics-validated final-mile completion gates the notification.
- [ ] Order, Shipment, task, event, and displayed timestamps agree.
- [ ] Duplicate completion/retry cannot duplicate logical notifications.
- [ ] Communication failure does not undo committed delivery.
- [ ] Read state changes no delivery, Inventory, or payment state.
- [ ] Safe summaries exclude raw evidence and unrelated personal information.
- [ ] API and Seller UI verification passes before marking delivery integration implemented.

## HOW

### Existing routes and planned extension

| Method and path | Current infrastructure |
| --- | --- |
| GET /api/v1/seller/notifications | Own notification list |
| GET /api/v1/seller/notifications/{notification} | Own notification detail |
| POST /api/v1/seller/notifications/{notification}/read | Own read state |
| GET /api/v1/seller/orders/{order} | Own purchased-Order detail |

- Reuse existing authentication, response envelopes, pagination, and errors.
- Extend the notification serializer and Order projection only when completion is implemented.
- Do not advertise separate timeline/proof endpoints that do not exist.
- Reads are retryable; mark-read follows the existing idempotent behavior.
- Preserve unauthorized/not-found distinctions without exposing another Shop's records.
- Physical completion APIs are owned by Courier Complete Delivery and Logistics Update Status.
- Seller consumers must never create an alternative delivery state machine.

### Implementation sequence and verification

- First deploy the shared schema, first-mile bridge, and verified transition service from `docs/schema.md`.
- Enable final-mile completion only after evidence policy and owning endpoint contracts are implemented.
- Add the delivered-event consumer and safe Seller payload through the existing notification infrastructure.
- Test Shop/role isolation, forged IDs, duplicate event delivery, and after-commit failure.
- Test read-state independence, safe proof summaries, snapshot stability, and missing-event failures.
- Test agreement with Customer Order Status and Courier Delivery History.
- Test that final delivery cannot fulfill first-mile Inventory a second time.
- Run SQLite/PostgreSQL physical verification before enabling the event producer.
- Run Seller UI tests for loading/read/delivered/error/accessibility states.
- Record actual results in `docs/PROGRESS.md`; no physical test execution is claimed by this revision.

### Deferred policy and references

- Raw proof visibility/retention, external channels, callbacks, settlement, and review eligibility remain separately owned.
- Returns, refunds, partial fulfillment, and post-pickup cancellation/failure recovery remain deferred.
- Canonical: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`.
- Shared plan: `docs/features/shared/shipment-fulfillment/spec.md`.
- Completion: `docs/features/courier/complete-delivery/specs.md`.
- Evidence: `docs/features/courier/proof-of-delivery/specs.md` and `docs/references/file-upload-requirements.md`.
- Logistics authority: `docs/features/logistics/update-status/specs.md`.
