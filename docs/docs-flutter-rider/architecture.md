---
title: Courier Flutter Application Architecture
system: AISLEY
type: Client Architecture
platform: Flutter / Dart
role: Courier / Rider
status: Flutter inbox, support tickets, dashboard previews, final-mile batch acceptance, photo-POD/COD intent, and Logistics/Seller/Buyer chat implemented; live acceptance remains open
backend_contract_commit: 4c3f504 (supplied documentation baseline; Flutter runtime adoption remains recorded against d7df220)
---

# Scope

This document describes the external Flutter application used by Couriers. Android APK is its mobile delivery target; a local Flutter `web-server` browser run of the same codebase is the camera and file-upload testing target. It is not the architecture of the Laravel monorepo and it does not authorize changes to the backend, the Customer/Seller/Admin/Logistics web applications, or the database.

The Laravel API remains the source of truth for identity, approval, role access, organization and hub ownership, order status, task assignment, and delivery state. The Flutter app renders server responses and submits only fields allowed by the versioned API contract.

Flutter implements the notification inbox, private support-ticket list/create/detail/reply/read flow, separate read-only dashboard task previews, final-mile batch list/detail/atomic acceptance with state reconciliation, Android rear-camera POD/browser file fallback, photo upload and completion intent with COD cash confirmation, and a task-chat inbox with Logistics/Seller/Buyer messaging. Buyer starts revalidate the Courier final-mile task; existing replies require refreshed server sendability. No Seller/Customer Order-context route is called by Flutter. Installed-device/browser acceptance, authenticated support-ticket/batch/API and COD/Logistics validation, and live chat exchange remain unverified. Batch-route rendering, failed-attempt submission, and linehaul trip screens remain unadopted. See `docs/PROGRESS.md` for dated implementation evidence; Laravel remains authoritative for operational state.

Auth v2.6 in the supplied `4c3f504` snapshot defines credential/account/affiliation error precedence, exact duplicate-email handling, and explicit recovery unavailability. Flutter has no forgot-password flow; newer Auth integration remains outstanding. Local truck selection, first-mile schedule filtering, registration/account discard protection, keyboard/error focus, and plain-language recovery have implementation evidence against `d7df220`.

## Current implementation boundary

The backend currently exposes Courier authentication, account and vehicle management, policy consent, and the approved first-mile/final-mile task workflow:

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
- `POST /api/v1/courier/support-tickets/{ticket}/replies` (authenticated idempotent own-ticket reply)
- `POST /api/v1/courier/support-tickets/{ticket}/read` (authenticated monotonic read marker)
- `GET /api/v1/courier/vehicle` (authenticated own-vehicle read)
- `PATCH /api/v1/courier/vehicle` (authenticated revision-checked field update)
- `POST /api/v1/courier/vehicle/documents/{kind}` (authenticated independent OR/CR replacement)
- `GET /api/v1/courier/vehicle/documents/{kind}` (authenticated private current-document read)
- `GET /api/v1/platform/policies/{type}` and policy history reads (public)
- `GET /api/v1/policy-consent/status` and `POST /api/v1/policy-consent/{type}/versions/{version}/accept` (authenticated)
- `GET /api/v1/courier/first-mile-tasks` (authenticated, private paginated task list)
- `POST /api/v1/courier/first-mile-tasks/{task}/accept` (authenticated task acceptance)
- `POST /api/v1/courier/waybills/resolve` (authenticated read-only QR candidate resolution)
- `POST /api/v1/courier/first-mile-tasks/{task}/pickup` (authenticated idempotent Seller handoff)
- `GET /api/v1/courier/pickup-schedules/{schedule}/route-manifest` (authenticated ordered manifest)
- `GET /api/v1/courier/final-mile-tasks` and `GET /api/v1/courier/final-mile-tasks/{task}` (authenticated)
- `GET /api/v1/courier/final-mile-batches` and `GET /api/v1/courier/final-mile-batches/{schedule}` (authenticated dispatch-batch reads)
- `POST /api/v1/courier/final-mile-batches/{schedule}/accept` (authenticated atomic batch acceptance)
- `POST /api/v1/courier/final-mile-tasks/{task}/accept` (authenticated task acceptance)
- `POST /api/v1/courier/final-mile-tasks/{task}/reject` (authenticated final-mile offer rejection)
- `POST /api/v1/courier/final-mile-tasks/{task}/pickup` (authenticated task-bound pending hub-handoff evidence; no identifier fields)
- `GET /api/v1/courier/tasks/{task}/delivery` (authenticated accepted-task delivery context)
- `POST /api/v1/courier/final-mile-tasks/{task}/status` (authenticated revision-checked movement)
- `GET /api/v1/courier/final-mile-batches/{schedule}/route` (authenticated advisory delivery route)
- `POST /api/v1/courier/tasks/{task}/proof-of-delivery` (authenticated private multipart photo POD; Android camera and selected-file upload implemented in Flutter)
- `GET /api/v1/courier/delivery-proofs/{proof}/photo` (authenticated private proof read)
- `POST /api/v1/courier/final-mile-tasks/{task}/failed-attempts` (authenticated nonterminal attempt record)
- `GET /api/v1/courier/tasks/{task}/completion` and `POST /api/v1/courier/tasks/{task}/completion` (authenticated completion projection/intent)
- `GET /api/v1/courier/delivery-history` and `GET /api/v1/courier/delivery-history/{task}` (authenticated read-only delivered history)
- `GET /api/v1/courier/notifications` (authenticated bounded inbox list)
- `GET /api/v1/courier/notifications/unread-count` (authenticated unread count)
- `GET /api/v1/courier/notifications/{notification}` (authenticated notification detail)
- `POST /api/v1/courier/notifications/{notification}/read` (authenticated idempotent mark-read)
- `/api/v1/courier/operational-conversations` with authenticated list/start, detail, paginated messages, send, and read actions for task-scoped Logistics, Seller, and Buyer threads (Flutter Logistics/Seller/Buyer sending reported implemented locally; live acceptance unverified)
- `GET /api/v1/courier/linehaul-trips` (authenticated assigned company-truck trips; client screen not verified)

The dashboard aggregate remains a read-only scaffold. Flutter separately reads the task-list APIs for bounded first-/final-mile previews and the notification API for its inbox badge; opening a preview navigates without mutating a task. QR/Code 128 candidates serve first-mile pickup, final-mile hub handoff is task-bound, and delivery proof is photo-only. Photo/intent and COD confirmation have local implementation and test coverage, while authenticated Logistics validation remains unverified. Backend API availability does not establish Flutter adoption or live acceptance. Background push/WebSockets, live route telemetry, signature proof, earnings, and offline synchronization remain unavailable. Logistics Linehaul/Sort plan mutations are not Courier endpoints; the separate Courier trip read is real.

## Camera targets

- The shared Flutter camera-scanning workflow is available in the Android release APK and the same Flutter app at `http://localhost:8765` via `flutter run -d web-server --web-hostname localhost --web-port 8765`. This is a local browser test target, not a separate Courier web UI or a production web deployment.
- `mobile_scanner` decodes QR payloads and Code 128 waybill tracking IDs on its supported targets, then passes an untrusted candidate to the **first-mile pickup** controller. Final-mile POD never reuses that scanner: Android uses a separate rear-camera still-photo screen, while local web-server uses the file chooser.
- Scanner and POD-camera lifecycle/permission feedback stay in Flutter presentation code; repositories continue to use the documented bearer-token endpoints. Linux and other unsupported platforms hide camera actions and retain manual input or file selection as appropriate.
- The direct `dart:io` socket handling in `lib/core/networking/api_client.dart` is isolated behind a conditional adapter for web compilation. Browser authentication continues to use the existing `flutter_secure_storage` WebCrypto/LocalStorage implementation without a plaintext fallback; that browser token is same-origin and intended only for the reviewed localhost test boundary. API CORS must allow the exact fixed origin, and non-local browser camera tests need HTTPS.
- Web and Android release builds are verified. Physical QR/Code 128 capture, Android POD still capture/permission denial, and browser file-selection acceptance still require an installed release APK and a localhost browser.

## File-upload targets

- The supplied Flutter progress records platform-safe multipart transport for registration evidence, account photo, and vehicle OR/CR: selected bytes on web and readable paths on Android/native. Analyzer, tests, web build, and APK build pass; live browser CORS/private-read and installed-device upload acceptance remain unverified.
- Follow [`flutter-file-uploads.md`](flutter-file-uploads.md) for the transport and Android regression boundary. Keep exact Laravel multipart parts and server-side validation; do not create web-only endpoints, a second Flutter codebase, or a React upload page. Flutter adopted Android rear-camera/file-fallback delivery photo POD, but authenticated Logistics validation and installed-device/browser upload acceptance remain unverified; signature remains deferred.
- The fixed `http://localhost:8765` origin needs backend CORS for upload `POST`, private-image `GET`, and applicable `OPTIONS` preflight with bearer/idempotency headers. The same secure session and authenticated private-read rules apply on web; browser upload acceptance and installed-APK regression remain verification tasks.

## Client structure

Use feature-oriented Dart code with clear boundaries:

```text
lib/
├── app/                 # Material theme, routing, dependency composition
├── core/
│   ├── config/           # API base URL and environment configuration
│   ├── networking/      # One authenticated HTTP client and error mapping
│   ├── security/        # Secure token storage and redaction helpers
│   └── scanning/        # Shared QR/Code 128 candidate capture
├── features/
│   ├── auth/
│       ├── data/         # DTOs, multipart requests, repository
│       ├── domain/       # Auth state and validation rules
│       └── presentation/ # Login, registration, pending, and session screens
│   ├── account/
│       ├── data/         # Account DTOs, photo transport, authenticated repository
│       ├── domain/       # Private account projection and in-memory photo data
│       └── presentation/ # Account form, photo controls, and password/session controls
│   ├── vehicle/
│       ├── data/         # Own-vehicle and private OR/CR transport
│       ├── domain/       # Revision, document state, and validation models
│       └── presentation/ # Vehicle fields and independent document controls
│   ├── dashboard/       # Scaffold plus independent read-only task previews
│   ├── notification/    # Authorized inbox, unread count, and mark-read
│   ├── policy/          # Published policies and explicit consent
│   ├── chat/            # Task inbox/history and Logistics/Seller/Buyer sending
│   ├── support/         # Private Admin support ticket list, history, replies, and reads
│   ├── batch/           # Final-mile dispatch-batch list, detail, and atomic acceptance
│   ├── pickup/
│   │   ├── data/         # Pickup task, manifest, and handoff repositories
│   │   ├── domain/       # Server status, task, manifest, and handoff models
│   │   └── presentation/ # Pickup list, detail, verification, and route-order screens
│   ├── delivery/
│   │   ├── data/         # Final-mile delivery repository
│   │   ├── domain/       # Delivery context, movement, proof, and completion models
│   │   └── presentation/ # Delivery work, movement, proof, and completion screens
│   └── history/
│       ├── data/         # Read-only delivered-history repository
│       ├── domain/       # Immutable history projections
│       └── presentation/ # History list and detail screens
└── main.dart
test/
├── core/               # Networking and scanner tests
├── features/           # Repository, controller, and widget tests by feature
└── widget_test.dart
```

The exact state-management, routing, networking, and secure-storage packages are project decisions. Inspect `pubspec.yaml` and reuse existing choices before adding a dependency.

The imported Flutter project reports that `DeliveryController` keeps task/action state and pending attempts in one library. Its movement, photo-submission, and completion parts each own their workflow's validation, submission, and retry. COD reads, private photo reads, reconciliation, and error handling remain separate parts. The workflow split preserves revision checks, exact pending payloads/idempotency keys after uncertain responses, and Logistics authority over final delivery; repositories continue to own HTTP transport.

Operational chat is implemented in `lib/features/chat/` using the existing bearer client and the versioned Courier conversation actions in `features/courier/chat-messaging/api-handoff.md`. Logistics/Seller/Buyer sending is reported enabled for eligible tasks; ended or denied threads remain read-only and live cross-role acceptance remains unverified. Keep message bodies in session-bound memory and recheck task eligibility on the server.

Courier support tickets are implemented separately in `lib/features/support/` against `courier-support-tickets-v1`. The controller keeps bounded list/history state and uncertain mutation keys only in session memory, polls only the visible support route, and clears private drafts and transcripts when authentication or authorization is lost.

## API integration

- Use the `/api/v1` prefix and an environment-specific base URL. Use HTTPS outside local development.
- Centralize requests in one client/repository layer; screens must not issue ad-hoc HTTP calls.
- Send `Authorization: Bearer <token>` only for authenticated requests. The token is issued once at login and is never returned by `/me`.
- Treat server validation, role, account status, affiliation status, organization, hub, task assignment, and status transitions as authoritative.
- Map `401`, `403`, `422`, and `429` responses into explicit UI states without exposing private review notes or server internals.
- Do not silently retry registration, token issuance, or future operational writes after an uncertain response.

## Authentication state

Model at least these states explicitly:

```text
checking_session
signed_out
submitting_registration
pending_approval
authenticated
rejected
suspended_or_deactivated
invalid_affiliation
recoverable_network_failure
```

Pending Couriers cannot use `/me`; the current API does not provide a cross-device pending-status endpoint. The pending screen must therefore be local and informational until a dedicated pending-status endpoint exists.

## Security and privacy

- Store bearer tokens only in platform secure storage (Keychain/Keystore or the approved Flutter secure-storage implementation).
- Never log or persist passwords, tokens, evidence bytes, raw storage paths, full addresses, or private API payloads.
- Do not trust client-supplied role, status, reviewer, hub, affiliation, owner, or token-ability fields.
- Keep private registration evidence private; the app receives only safe resource fields and never a blob path.
- Do not bypass approval or protected actions while offline.

## Registration data

- Use the bundled Dart-compatible PSGC data for Region → Province → City/Municipality → Barangay selectors and retain manual address fallback.
- Current Courier registration does not collect coordinates or require a map pin. Do not add Geoapify, Mapbox, Leaflet, or another map dependency without an approved backend contract.
- Validate the required evidence as JPEG/JPG, PNG, or WebP strictly under 10 MiB before upload. The server remains authoritative for MIME, signature, decode, ownership, and storage validation.
- The selected Logistics organization owns exactly one operational hub; the app must not expose a hub/sub-hub selector.

## UI and accessibility

[`design-courier.md`](design-courier.md) owns all shared Flutter visual and interaction rules, including Jakob's Law and Hick's Law. Feature specs define authorized workflow steps; presentation groups those steps into familiar controls and focused decisions without changing permissions or skipping confirmation. Apply the same rules on Android and local web-server, adapting to available input and viewport size.

Reuse the app-wide Material theme in `lib/app/courier_app.dart`, feature-owned presentation components, and existing navigation. Put requests in repositories, parsing in models, and action/state handling in controllers; widgets must not invent eligibility or directly call HTTP. Share a domain-independent widget only when reuse is demonstrated. Review changed screens against the design guide's accessibility and decision-flow criteria before claiming compliance.

## Testing and contract synchronization

- Unit-test validation, multipart field names, PSGC cascading, JSON parsing, status mapping, auth transitions, and secure-storage failures.
- Add API contract tests for Logistics discovery, registration, login, `/me`, logout, role isolation, approval denial, upload limits, and error codes.
- Mocks may support deterministic unit/widget tests but cannot replace API verification.
- Automatically record the backend commit or API version used by the app in `docs/PROGRESS.md` whenever implementation or contract work changes. Recheck the contract before adopting any backend change.

## Canonical documents

Read the relevant sections of `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domain/Courier.md`, `docs/domain/Logistics.md`, the matching Courier feature specification (or the shared Logistics vehicle specification for Courier vehicle work), and the two registration/upload references. The decision worksheet is historical context only; it is not an implementation authority.
