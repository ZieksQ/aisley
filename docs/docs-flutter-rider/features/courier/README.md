---
title: Courier Feature Index
system: AISLEY
type: Feature Index
role: Courier / Rider
platform: Flutter / Dart
status: Flutter dashboard previews, inbox, support tickets, final-mile batch acceptance, photo-POD/COD intent, and Logistics/Seller/Buyer chat implemented; live acceptance remains open
---

# Courier feature index

## Implementation rule

The copied backend baseline is Laravel `4c3f504` (2026-10-03), including Auth v2.6. Flutter adoption remains reported against `d7df220`; Flutter has no forgot-password flow and newer Auth integration remains outstanding. The imported client log reports truck selection, Buyer composition, schedule filtering, registration/account discard protection, keyboard/error focus, plain-language recovery, and production-theme accessibility coverage. These results were not rerun here; live/device acceptance remains unverified.

`auth/spec.md`, `account-management/specs.md`, `support-tickets/spec.md`, `../logistics/vehicle-fleet-management/specs.md` (the shared Courier/Logistics vehicle contract), the policy-consent specification, `notification/specs.md`, `accept-delivery-requests/specs.md`, `pick-up-order/specs.md`, `delivery-order/specs.md`, `proof-of-delivery/specs.md`, `complete-delivery/specs.md`, `delivery-history/specs.md`, and `chat-messaging/specs.md` describe implemented API slices; client adoption and live acceptance vary. Flutter has a private support-ticket flow and a task-chat inbox with Logistics/Seller/Buyer sending; ended or denied threads remain read-only. Incident Reporting and Profit Dashboard remain planning drafts and cannot authorize invented requests, fields, statuses, providers, or offline behavior.

Every Flutter feature follows [`../../design-courier.md`](../../design-courier.md), including its Jakob's Law/Hick's Law interaction rules and frontend review criteria. Reuse familiar controls and labels, emphasize the current next action, and group optional choices while preserving essential context. Feature-specific workflow and API requirements remain binding; consult [`../../PROGRESS.md`](../../PROGRESS.md) for current Flutter implementation evidence.

Before implementing a remaining draft feature, verify that the backend provides:

1. an approved feature specification;
2. a versioned `/api/v1/courier/...` endpoint contract with request and response examples;
3. any required shared Shipment/Delivery Task schema and transition rules; and
4. integration/contract-test coverage.

Until then, implement only a truthful scaffold or unavailable state for that missing capability. Do not fabricate task counts, route/location telemetry, proof media, earnings, or notification data. Flutter implements atomic dispatch-batch list/detail/acceptance plus photo selection/upload and completion intent with COD confirmation; authenticated batch/API, COD/Logistics validation, and installed-device/browser uploads remain unverified.

## Current Courier API

- `GET /api/v1/courier/auth/logistics-options`
- `POST /api/v1/courier/auth/register`
- `POST /api/v1/courier/auth/login`
- `POST /api/v1/courier/auth/forgot-password` (explicit recovery-unavailable response; no reset delivery)
- `GET /api/v1/courier/auth/me` (authenticated)
- `POST /api/v1/courier/auth/logout` (authenticated)
- `GET /api/v1/courier/account` (authenticated)
- `PATCH /api/v1/courier/account/profile` (authenticated)
- `PUT /api/v1/courier/account/password` (authenticated)
- `POST /api/v1/courier/account/profile-photo` (authenticated multipart upload)
- `GET /api/v1/courier/account/profile-photo` (authenticated private stream)
- `DELETE /api/v1/courier/account/profile-photo` (authenticated idempotent removal)
- `GET`/`POST /api/v1/courier/support-tickets` (authenticated own-ticket list/create)
- `GET /api/v1/courier/support-tickets/{ticket}` (authenticated own-ticket detail/history)
- `POST /api/v1/courier/support-tickets/{ticket}/replies` (authenticated idempotent reply)
- `POST /api/v1/courier/support-tickets/{ticket}/read` (authenticated monotonic read marker)
- `GET /api/v1/courier/vehicle` (authenticated own-vehicle read)
- `PATCH /api/v1/courier/vehicle` (authenticated revision-checked own-vehicle update)
- `POST /api/v1/courier/vehicle/documents/{kind}` (authenticated independent OR/CR replacement)
- `GET /api/v1/courier/vehicle/documents/{kind}` (authenticated private current-document read)
- `GET /api/v1/platform/policies/{type}` (public current Terms/Privacy read)
- `GET /api/v1/platform/policies/{type}/history` (public published history)
- `GET /api/v1/platform/policies/{type}/history/{version}` (public exact history read)
- `GET /api/v1/policy-consent/status` (authenticated Courier status)
- `POST /api/v1/policy-consent/{type}/versions/{version}/accept` (authenticated exact-version acceptance)
- `GET /api/v1/courier/dashboard` (authenticated private read scaffold; aggregate sections unavailable)
- `GET /api/v1/courier/first-mile-tasks` (authenticated private task list)
- `POST /api/v1/courier/first-mile-tasks/{task}/accept` (authenticated first-mile acceptance)
- `POST /api/v1/courier/waybills/resolve` (authenticated read-only QR candidate resolution)
- `POST /api/v1/courier/first-mile-tasks/{task}/pickup` (authenticated idempotent Seller handoff)
- `GET /api/v1/courier/pickup-schedules/{schedule}/route-manifest` (authenticated ordered manifest)
- `GET /api/v1/courier/map-style` and `GET /api/v1/courier/map-tiles/{z}/{x}/{y}.png` (authenticated map proxy reads; not task mutations)
- `GET /api/v1/courier/final-mile-tasks` and `GET /api/v1/courier/final-mile-tasks/{task}` (authenticated final-mile reads)
- `GET /api/v1/courier/final-mile-batches` and `GET /api/v1/courier/final-mile-batches/{schedule}` (authenticated dispatch-batch reads)
- `POST /api/v1/courier/final-mile-batches/{schedule}/accept` (authenticated atomic batch acceptance)
- `POST /api/v1/courier/final-mile-tasks/{task}/accept` (authenticated final-mile acceptance)
- `POST /api/v1/courier/final-mile-tasks/{task}/reject` (authenticated final-mile rejection with idempotency)
- `POST /api/v1/courier/final-mile-tasks/{task}/pickup` (authenticated task-bound pending hub-handoff evidence; no identifier fields)
- `GET /api/v1/courier/tasks/{task}/delivery` (authenticated accepted-task context)
- `POST /api/v1/courier/final-mile-tasks/{task}/status` (authenticated movement transition)
- `GET /api/v1/courier/final-mile-batches/{schedule}/route` (authenticated advisory final-mile route; Flutter adoption not verified)
- `POST /api/v1/courier/tasks/{task}/proof-of-delivery` (authenticated private multipart `photo` POD; Flutter selected-file upload implemented, live acceptance unverified)
- `GET /api/v1/courier/delivery-proofs/{proof}/photo` (authenticated private Courier proof read)
- `GET /api/v1/courier/tasks/{task}/completion` and `POST /api/v1/courier/tasks/{task}/completion` (authenticated completion projection/intent)
- `POST /api/v1/courier/final-mile-tasks/{task}/failed-attempts` (authenticated nonterminal delivery-attempt record)
- `GET /api/v1/courier/delivery-history` and `GET /api/v1/courier/delivery-history/{task}` (authenticated delivered history)
- `GET /api/v1/courier/notifications` (authenticated bounded inbox list)
- `GET /api/v1/courier/notifications/unread-count` (authenticated unread count)
- `GET /api/v1/courier/notifications/{notification}` (authenticated notification detail)
- `POST /api/v1/courier/notifications/{notification}/read` (authenticated idempotent mark-read)
- `GET /api/v1/courier/operational-conversations` and `POST /api/v1/courier/operational-conversations` (authenticated task-scoped inbox and first message)
- `GET /api/v1/courier/operational-conversations/{conversation}` and `GET /api/v1/courier/operational-conversations/{conversation}/messages` (private detail/history)
- `POST /api/v1/courier/operational-conversations/{conversation}/messages` and `POST /api/v1/courier/operational-conversations/{conversation}/read` (idempotent send and monotonic read marker)
- `GET /api/v1/courier/linehaul-trips` (authenticated assigned company-truck trip read; Flutter trip screen not verified)

Routes proposed by the Incident Reporting and Profit Dashboard drafts remain conceptual; the route lists here are not an exhaustive replacement for current Laravel routes. Task pickup/scan-events aliases retain the revision-only hub-handoff contract and do not restore QR delivery proof. Flutter implements QR/Code 128 candidates, atomic final-mile batch acceptance, delivery context/movement, photo upload and COD-aware completion intent, history, notification inbox, dashboard task previews, and task-chat inbox with Logistics/Seller/Buyer sending. Current delivery proof accepts **photo POD, not QR/reference JSON**; COD completion additionally requires explicit `cod_collected: true`. Buyer composition is implemented locally in Flutter; authenticated live exchange remains unverified; Seller and Customer web counterparts are implemented. Batch-route rendering, failed-attempt submission, and company-truck trip reads still need client adoption. Linux remains manual-input only for barcodes. Logistics-owned Linehaul mutation and Sort plan routes are not Courier API routes.

Flutter camera work targets the Android release APK and the same Flutter app served at `http://localhost:8765` on a fixed localhost `web-server` port. QR and Code 128 tracking-ID scanning remain relevant to first-mile pickup; the legacy delivery-proof scanner must not be used as current photo POD. It does not add a Courier webapp or new backend endpoint; physical camera acceptance remains a release verification task.

## Canonical constraints for future features

- Use lowercase `snake_case` API/status values from the approved backend contract.
- Keep first-mile and final-mile assignments independent; a first-mile Courier is not automatically the final-mile Courier.
- Keep all records scoped to the authenticated Courier, its approved Logistics organization, and that organization's sole hub.
- Do not use Mapbox or introduce a routing provider without an approved provider contract. Current Courier registration does not require a map pin or coordinates.
- Display private evidence only through its authorized feature preview; never log, export, or store it in ordinary app storage. Do not expose raw storage paths, bearer tokens, or unnecessary Buyer/Seller data.

## Draft files

The remaining planning drafts are Incident Reporting and Profit Dashboard. Routine final-mile failed attempts, such as the Buyer being absent, use the task-owned retryable failed-attempt API; they do not create an incident or change custody. Safety events and vehicle breakdowns belong to separate incident reporting. Flutter failed-attempt submission remains unadopted. The legacy drafts are preserved unchanged and exceed the 200–230-line rule: Incident Reporting has 1,073 lines and Profit Dashboard has 969 lines; both require separate revision and neither is implementation-ready. Courier support tickets have implemented Flutter list/create/detail/reply/read screens; authenticated live acceptance remains open. Dashboard operational aggregation remains unavailable; separate Flutter task previews and the notification badge are implemented. Courier Chat/Messaging has Flutter Logistics/Seller/Buyer sending and implemented Seller/Customer web counterparts; live exchange remains unverified; use `chat-messaging/api-handoff.md` for exact calls. Atomic batch acceptance is locally implemented, while task-bound hub handoff, photo upload, and COD-aware completion intent still need authenticated end-to-end Logistics validation and installed-device/browser acceptance. Batch route presentation remains unadopted; background push, signature proof, and notification-driven mutations remain deferred.
