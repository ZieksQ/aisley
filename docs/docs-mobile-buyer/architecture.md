# Buyer Flutter architecture

> Implementation, SDK/package resolution, tests, builds and browser results in this guide are reports from the external Buyer Flutter project and were not rerun here. This bundle contains documentation; `lib/`, tests, tools, lockfiles and build reports belong to that project. Current shipping-contract adoption remains [G25](references/integration-gaps.md).

Phases 1–4 implement this blueprint with partial acceptance. See [Phase 4 evidence](references/phase-4-verification.md) and [Phase 3 evidence](references/phase-3-verification.md). Android is the delivery target; responsive web includes desktop browsers, tested locally at localhost:8766; production browser release remains unverified. Existing repositories must merge these choices with their own instructions and record material differences before implementation. Backend contracts were inspected at checkout `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; the historical baseline remains in provenance.

## Composition and dependencies

Use Flutter Material, `go_router`, Dio and immutable hand-written null-safe DTOs. A feature repository owns API access and coherent cached projections. A `ChangeNotifier` view model owns state transitions; `ListenableBuilder` renders that state. Constructor injection supplies repositories, configuration, clock, UUID factory and platform adapters from one `AppDependencies` composition root. No service locator, inherited Courier implementation, code generation or additional state library is required.

Flutter recommends separate data/UI responsibilities, repositories, immutable models and injectable dependencies, and lists ChangeNotifier/Listenable as an architecture option. Here constructor injection and hand-written DTOs are deliberate project choices. [Flutter architecture recommendations](https://docs.flutter.dev/app-architecture/recommendations)

```text
lib/
  main.dart                         # initialize bindings, config, composition
  app/                              # AppDependencies, router, light ThemeData
  core/
    config/                         # validated public runtime inputs
    networking/                     # Dio services, failure mapping, deadlines
    security/                       # TokenStore, redaction, SessionController
    platform/                       # XFile/location/launcher adapters
    address/                        # AssetBundle PSGC loader + typed nodes
    ui/                             # shared buttons, feedback, money labels
  features/<feature>/
    data/                           # DTOs, abstract repository + API implementation
    presentation/                   # view model, screen, focused widgets
  features/checkout/domain/         # frozen intent/reconciliation across repositories
assets/psgc/                        # index + eighteen unchanged regional files
test/                              # mirror core/features
integration_test/                   # Android + fixed-origin browser acceptance
```

Feature directories cover auth, policies, home, search, shops, product, account, addresses, wishlist, recently_viewed, cart, checkout, orders, shop_messages, logistics_messages, courier_messages, notifications, questions, reviews and support. Navigation verification is part of app/session composition; vouchers belong to checkout. A domain/use-case class is justified for a workflow spanning repositories, not required for each endpoint.

Repository methods return typed successes or failures; widgets never index raw JSON. DTO parsers explicitly map wire casing and validate required nested structures using [wire tables](api/field-index.md). Implement `copyWith` only where state changes need it; expose unmodifiable lists/maps. Inject a clock for quote expiry, throttling and server-history validation. Inject a UUID factory using Dart `Random.secure()` for 16 bytes with RFC4122 v4 version/variant bits; no additional UUID package is required.

## HTTP and credential boundary

`API_BASE_URL` accepts an origin or a full `/api/v1` base, with an optional trailing slash; AppConfig normalizes the base to `/api/v1` and validates the derived API origin. Other paths, user information, queries and fragments are rejected. A relative returned `/api/v1/...` URL resolves against the origin, never against the already-prefixed base. Use a credential-free Dio client for public catalog/provider reads and a trusted-origin client for private calls. Both set `Accept: application/json`; JSON mutations set JSON Content-Type and multipart owns its boundary.

Configure 15-second overall JSON deadlines as well as Dio connect/send/receive timeouts. An overall deadline includes the entire exchange. Uploads use a separate bounded deadline and progress state. A timeout cancels the transport but does not prove rollback. Disable credentialed redirect following and authorize only exact API-origin requests; public storage/provider origins receive no bearer. Phase 1 web uses a Dio JSON Fetch adapter with credentials omitted and redirect:error, because the pinned XHR BrowserHttpClientAdapter cannot disable redirects. No CookieJar is used; byte multipart adapters are implemented in Phase 2.

Failure includes transport/decode category, HTTP status, optional code/message, field errors and readable Retry-After. No global automatic write retry. GET/resolve read retries use bounded backoff and query generation checks. [Operation contracts](api/operations.md) own mutation replay; [errors](api/errors.md) own global handling. Do not require a code when Laravel only returns a message.

## Session and consent state machine

SessionController states: checkingStorage → checkingIdentity → checkingConsent → active; alternative signedOut, accountDenied, storageUnavailable, identityUnavailable, consentRequired. Load token once per bootstrap. `/me` establishes Customer UUID/role/status; login result alone does not unlock private screens. `/policy-consent/status` determines current required consent. Consent failure is recoverable without deleting a valid token; explicit consent denial preserves identity and hides protected content.

Maintain a monotonically increasing session generation and verified Customer UUID. Every private request snapshots both; stale successes and errors are discarded after logout/account switch/authorization loss. Cancel requests and dispose listeners/timers before clearing repositories. A router refresh listener reads only SessionController state and creates no HTTP calls.

Secure storage holds the token only. Read/write/delete failure fails closed for protected screens and exposes Retry. A newly minted token must be stored successfully before opening private routes; if storage fails, best-effort current-token logout and truthful feedback are needed. No ordinary-preferences fallback. Android uses platform-backed storage; localhost web uses the package's origin-bound WebCrypto implementation. Browser acceptance is separate from Android storage acceptance.

Private caches/drafts/quotes/keys/photos are memory-only. Logout/account loss clears all private state without writing or merging guest history. Consent clears projections/drafts; minimal frozen unresolved commerce requests survive only for the same valid identity and require deliberate reconciliation. If secure deletion fails, clear memory and prevent restoration until deletion succeeds; never show successful durable sign-out while a token remains restorable. Offline local sign-out cannot guarantee server revocation. Password change keeps current bearer and revokes others; reset revokes all personal access tokens. No refresh-token endpoint or token expiry timer is supplied.

## Navigation and identity-dependent reads

`go_router` owns Home/Shops/Cart/Account bottom branches; detail/forms stack within their origin branch. Validate allow-listed internal return routes and UUID/slug parameters. Auth and consent redirects preserve safe read destinations, never executable mutation intent. Native deep-link reset adoption remains unavailable; trusted storefront recovery opens intentionally through url_launcher.

Public Product/Shop reads may use a bounded public memory cache keyed by normalized endpoint/query/page. Optional-auth Home is always private when a token was supplied, even when its viewer projection looks anonymous. Shopping routes require active verified identity and consent even where the backend endpoint remains public. Guest recency composition/storage/automatic merge are removed; startup only best-effort deletes the retired hints key through shared_preferences. Default private repository state is cleared before changing identity.

Pagination state stores query signature, cursor/page, deduplicated items, loading and separate page failure. A refresh atomically replaces first-page state after success; a failed refresh can keep permitted stale rows with visible feedback. Append only if base query/session still matches. Missing cursors mean exhausted, not uninitialized. Chat history retains the last reachable older cursor after foreground page gaps.

## Financial and mutation authority

Catalog/Cart numeric prices are display hints. Quote/Order monetary strings are authoritative, parsed to integer minor units without floating-point totals. Quote ID/expiry and exact intent determine placement. Changing address, quantities, variant or vouchers invalidates quote. Display new prices and require deliberate review/Place; never silently repeat a blocked/expired write.

Store uncertain supported operations as immutable `PendingMutation(key, payload, sessionGeneration, context)`. Disable competing edits until exact retry or authoritative reconciliation. Checkout has no GET-by-key endpoint and keys are memory-only: process-death recovery remains G12. Cart add and image uploads have no durable replay guarantee. No offline write queue. Session composition owns Cart/checkout/Order and separate communication/contribution/support records across navigation; G21 limits correction to contact changes at an identical verified location.

## Native, web and provider adapters

image_picker supplies XFile bytes/stream abstractions. Keep dart:io confined to conditional native adapters; web cannot use a native path. `retrieveLostData` must not attach a recovered file to a changed account/parent. Private images use authenticated byte fetch and in-memory display; only public review images use returned public URLs.

PSGC assets ship in this bundle; the typed reader preserves actual hierarchy and requires explicit locality selection; failed assets block saving with Retry. Optional pinning uses MapLibre (`maplibre_gl` 0.27.1) with an isolated Geoapify client; geolocator runs only after explicit user action/permission. Provider/GPS failure keeps text addresses usable. No background GPS or live Courier tracking. See [addresses/maps](maps-location-api.md).

## Setup and verification

[Fresh project setup](setup.md) contains exact SDK/package pins, asset declarations, environment and Android/web commands. Historical package metadata inspection is separate from the executed Phase 1 dependency, test and build evidence linked above. [Verification](verification.md) defines the tests needed to graduate each pending feature. Deployment/CORS/map credentials are external inputs, not bundled server settings.

## Marketplace presentation

Shared `MarketplaceScope` receives only verified-access and Cart badge display values from app composition. `MarketplaceHeader`, `ShoppingPage`, `FormPage`, `ContentViewport`, `PurchaseBar` and account context own presentation, not API/session decisions. Phone/tablet and desktop use the breakpoints/bounds in [Buyer design](design-buyer.md). GlobalKeys keep gallery, purchase controls and form content mounted when columns change. One scaffold/safe-area/keyboard owner prevents reserved actions from overlaying content.

Optional Cart Shop metadata is a private lifecycle-aware display view model using the existing Product-detail repository: unique Product IDs, four concurrent reads, ungrouped failure fallback and obsolete-session rejection. Cart/checkout controllers retain financial and mutation authority. Three message channels remain independent; desktop inbox panes mount on first desktop exposure, stay mounted across resizing and poll only while visible. No wire contract, dependency or backend change accompanies the marketplace redesign.

Background identity/consent revalidation retains mounted route state after temporary errors and ignores obsolete results. Identity loss clears private data; renewed required consent gates shopping. Profile owns embedded photo presentation with independent upload state; legacy `/account/photo` navigates to Profile. Client evidence is dated in [marketplace verification](references/marketplace-verification.md) and [Progress](PROGRESS.md), against the reported adopted baseline, not newer backend adoption.
