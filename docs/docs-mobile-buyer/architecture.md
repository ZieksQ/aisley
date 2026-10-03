# Buyer Flutter architecture

Status: proposed Flutter organization; implementation pending. Laravel API baseline is recorded in [provenance](references/source-provenance.md).

Organize by feature with presentation and data boundaries. Widgets render state and forward actions; controllers/view models own loading, validation, retries and navigation effects; repositories own typed API access, parsing adapters and scoped cache lifecycle. Introduce domain/use-case classes when logic spans repositories or is reused. This follows Flutter's guidance on separating views, view models, repositories and services. [Flutter app architecture](https://docs.flutter.dev/app-architecture/guide)

```text
lib/
  app/                     # composition, theme, routes, session/consent boundary
  core/
    config/                # validated environment and API origin
    networking/            # JSON/multipart transport, errors, timeouts
    security/              # secure storage, redaction, session cleanup
    platform/              # conditional native/web file and location adapters
    address/               # typed PSGC asset reader
    presentation/          # proven shared Buyer controls
  features/
    auth/                  # register/login/recovery/session
    policy/                # public versions and authenticated consent
    home/                  # public aggregation and scoped refresh
    search/                # separate Products/Shops result state
    shops/                 # directory and scoped catalogue
    product/               # detail/gallery/configuration
    account/               # profile/password/photo/preferences
    addresses/             # CRUD/defaults/pin workflow
    wishlist/
    recently_viewed/
    cart/
    checkout/              # quote/vouchers/placement/result
    orders/                # history/detail/tracking/mutations
    shop_messages/
    logistics_messages/
    courier_messages/
    notifications/
    questions/
    reviews/
    support/
test/                      # mirrors focused feature/core responsibilities
integration_test/          # target and live-contract acceptance
```

Within a feature use `data/` for DTOs/repository and `presentation/` for controller/screens/components, adding `domain/` only when useful. Select state management, routing, HTTP, secure storage and file/location integrations from the destination project. This bundle does not preapprove a new package set or prescribe inherited Courier dependencies.

## Configuration and transport

Define environment-specific `API_BASE_URL` ending in `/api/v1`, a separate storefront URL for current reset links, and approved public-map configuration. Validate origins before requests. HTTPS is required outside isolated development. Flutter build-time configuration is public: never bundle backend/storage credentials or `GEOAPIFY_SERVER_API_KEY`.

Use one transport with `Accept: application/json`, bounded deadlines (start with a 15-second JSON deadline), response-body validation, safe error mapping and cancellation. Upload deadlines are separately configurable and show honest progress. Send bearer authorization only to the configured trusted API origin; follow no redirect to another origin with credentials. Resolve returned relative media paths against the API origin, preserving their `/api/...` path rather than duplicating the `/api/v1` prefix. [DTO contracts](api/contracts.md) retain endpoint-specific envelopes and casing.

Browser code must compile without `dart:io`; keep native file/socket APIs behind conditional adapters. The local browser uses bearer authentication, omits credentialed cookie behavior and uses its dedicated non-stateful origin. Android emulator API loopback usually needs `10.0.2.2` for the host; device runs need a reachable approved development host. Restrict any Android cleartext exception to the local development target and verify the actual network policy; do not weaken release HTTPS.

Use `http://localhost:8766` as the stable Buyer browser origin. Courier already uses `8765`. Proposed local command, to run later in the Flutter repo:

```sh
flutter run -d web-server --web-hostname localhost --web-port 8766
```

The current Laravel CORS default omits `8766`. Backend owner must add the exact origin through `CORS_ALLOWED_ORIGINS` before live browser integration; keep existing origins. Allow required methods/preflights and `Authorization`, `Content-Type`, `Idempotency-Key`. Expose `Retry-After` if the browser needs to read it: `exposed_headers` is currently empty. Do not add Buyer to `SANCTUM_STATEFUL_DOMAINS` for the token-only browser test flow. Test for cookie contamination: Sanctum tries the web guard before bearer fallback. Configuration/allow-lists and actual deployment behavior need live verification.

## State ownership

One session controller restores identity and policy status. Use a monotonically increasing session generation and Customer UUID for all private requests/caches. Cancel old reads and reject every stale completion, including errors, after identity changes. New-account requests must not reuse another account's pagination, quote, pending key, form or private image.

Public Product/Shop caches may be short-lived and keyed by endpoint/query/page. Homepage with bearer identity is private even when personalization is unavailable; use an explicit credential-free public read for guest fallback. Keep Customer enrichment, owned history, cart, orders, account, policies' acceptance and conversations outside shared persistence/cache. Private state is memory-only by default; secure storage holds the token, not transcripts or prices. Guest recency holds only bounded ID/time hints through a storage adapter.

Controllers own form drafts and pending actions; repositories manage cursor deduplication and visibility refresh. Commerce money remains a server decision: display numeric Product/Cart values without deriving payable totals; parse returned fixed-precision checkout/order strings safely. Do not recalculate discounts, shipping or COD locally.

## Errors and writes

Use typed failures with HTTP status, optional stable `code`, message, field errors and readable Retry-After when available. JSON error bodies are not uniform; some validation/abort responses lack `code`. Handle network/CORS/decode failures independently from HTTP validation. `401` clears invalid credentials; role/account-state `403` clears unauthorized identity; resource denial clears the affected record; consent denial keeps authentication and opens consent. `404` cannot disclose whether a foreign resource exists. `409` refreshes authoritative state; `422` retains safe input; `429` respects retry timing; `5xx`/timeout does not certify a write failed.

Replay only documented idempotent operations with the same frozen payload/key. Cart add increments quantity and image upload may create another asset; neither becomes safe through an invented header. No offline mutation queue is authorized. Cold-start recovery of uncertain placement after process death needs an approved recovery design; this baseline's memory-only pending keys cannot solve that gap.

Security and target-specific storage behavior are defined in [authentication](api/authentication.md); uploads in [Flutter transport](flutter-file-uploads.md); outstanding integration decisions in the [gap register](references/integration-gaps.md).
