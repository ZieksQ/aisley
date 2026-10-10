# Buyer Flutter documentation bundle

Historical baseline: **`7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0`**. Reported client adoption inspection: **2026-10-03**, checkout **`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`**. Buyer Flutter implementation (external project report): **Phases 1–4 implemented; live/device acceptance remains partial**. See [Phase 4 evidence](references/phase-4-verification.md), [Phase 3 evidence](references/phase-3-verification.md), [Phase 2 evidence](references/phase-2-verification.md) and [Phase 1 evidence](references/phase-1-verification.md).

This portable bundle defines a new standalone Flutter/Dart Customer app targeting Android, with the same application tested in a local browser. Laravel, Sanctum, PostgreSQL, and configured blob storage remain the platform backend. `customer` is the only persisted/API role; Buyer is product terminology.

Read in this order:

1. [Progress](PROGRESS.md), [agent instructions](AGENTS.md), and [Customer specification rules](features/customer/rule.md).
2. [Requirements](requirements.md), [shopping workflows](workspace.md), and [feature index](features/README.md).
3. [Fresh setup](setup.md), [architecture](architecture.md) and [Buyer design](design-buyer.md).
4. [Authentication](api/authentication.md), [endpoint inventory](api/endpoints.md), [DTOs and requests](api/contracts.md), [exact operations](api/operations.md), [typed wire models](api/field-index.md), [synthetic examples](api/examples/README.md), [errors](api/errors.md) and [messaging](api/messaging.md).
5. [Registration requirements](references/user-registration-requirements.md), [upload policy](references/file-upload-requirements.md), [Flutter upload transport](flutter-file-uploads.md), and [addresses/maps](maps-location-api.md).
6. [Integration gaps](references/integration-gaps.md), [verification](verification.md), [source provenance](references/source-provenance.md), and the specification for the feature being built.

## Delivery phases

Phase 5 local-readiness tooling and the acceptance runbook are implemented. See
[Phase 5 evidence and retained gates](references/phase-5-verification.md). Controlled
authenticated, installed-device and distribution acceptance remains open.

| Phase | Deliverables | Exit boundary |
| --- | --- | --- |
| 1 — Foundation/authentication | App composition, typed network client, configuration, secure token storage, login/register/recovery, session restoration, policy reading/consent, protected navigation | Android and fixed-origin local web compile; active Customer restoration and denial/consent cleanup verified |
| 2 — Discovery/account | Homepage, Products/Shops search, Shop browsing, Product Detail, profile/password/photo, Address Book, Wishlist, Recently Viewed | Public/private cache separation, PSGC fallback, authenticated photos, account history and account switching verified |
| 3 — Cart/checkout/orders | Cart configuration, Buy Now, quotes, voucher usage, COD placement/results, Orders/tracking, cancellation/address correction | Server totals and serviceability, immutable snapshots, uncertain placement reconciliation and same-key retries verified |
| 4 — Communication/reviews/support | Separate Shop/Logistics/Courier inboxes, notifications/preferences, Q&A, verified reviews/photos, support tickets | Cross-role replies, read markers, read-only transitions, partial uploads and safe retries verified |
| 5 — Integration/release | Live development API, installed Android, local browser, security/accessibility/permission and recovery checks | Evidence recorded against backend commit; open release gates explicitly resolved or retained |

Bazaar and MoneyFest remain deferred placeholders. Native push, payment gateways, returns/refunds, live Courier GPS, and features without an implemented API are outside the initial delivery. An available backend endpoint does not establish a Flutter screen or verified integration.

## Copying to a Flutter repository

Copy **this directory's complete contents** into the standalone repository's `docs/`. If root `AGENTS.md` is absent, copy `docs/AGENTS.md` there. If it exists, selectively merge Buyer instructions while retaining repository-specific rules; do not overwrite it. Keep the docs copy as the portable record. Its links are relative to this bundle and require no monorepo checkout.

The [documentation validation record](references/documentation-validation.md) records completed checks and their limits.

The handoff includes complete feature contracts, a concrete stable SDK/package blueprint, synthetic examples and all nineteen unchanged PSGC reference assets with attribution/checksums. The original documentation handoff included no Flutter implementation, credentials or server configuration; the external Flutter project reports Phases 1–4 under `lib/` and Phase 5 tooling. This tracked bundle contains documentation only. References to `lib/`, tests, `tool/`, lockfiles and ignored build reports describe that external project, and its results were not rerun here. Copy the assets using [setup](setup.md). Local documents supply implementation authority; upstream source paths/hashes are optional audit provenance. A missing monorepo checkout is not an implementation dependency.

Configured backend origins, approved test accounts, localhost CORS/header visibility and suitable public map credentials remain external deployment inputs. Validate live integration against the deployed backend; record material differences and actual Flutter results in Progress without rewriting the historical baseline.

This platform repository tracks the bundle at `docs/docs-mobile-buyer/`; the external Flutter destination is `docs/`. Upstream relocation to
`docs/docs-mobile-buyer/` in `c5ce0cc` and the original ignored `docs/cabigan/`
location remain historical provenance. Copy the complete bundle when handing it off.

## Customer specification maintenance

Read [Customer rules](features/customer/rule.md) before creating or revising a Customer spec, including authentication. New or revised specs use WHAT/MUST/HOW and contain 200–230 physical lines; this local rule overrides the feature-spec skill's shorter length preference. All 22 Customer specs now meet the length requirement and define requests, types, states, replay and tests. Shared consent is also complete. Phases 1–4 implementation evidence is recorded separately; controlled authenticated and installed-device acceptance gates stay open.

Historical shipping inspection: **2026-10-04**, `22b0a48f9575ead182d03c35ab87345711c23b90`. See [per-Shop shipping selection](api/shipping-selection.md) and [current provenance](references/source-provenance.md). Provider selection and changed shipping DTOs remain a client adoption gap (G25); imported results retain the earlier baseline. Required sign-in and account-only recency apply to Buyer Flutter presentation; the storefront keeps guest browsing/recency.

2026-10-09 contract delta: [voucher names/default pairing](api/voucher-selection-update.md). Customer names and default opposite-benefit pairing require external client adoption (G26); earlier Flutter implementation evidence and status remain unchanged.

## Chat media contract refresh — 2026-10-06

[Private chat media](api/chat-media.md) documents the additive implemented Laravel upload/processing/delivery contract and counterpart web controls. Media is disabled until operators enable the prepared runtime. External Flutter attachment implementation, authenticated media exchange and device acceptance remain pending; imported adoption baselines and prior test evidence are unchanged. Only affected messaging contract sections and DTO/examples were refreshed.

## Selective synchronization — 2026-10-07

Newer external Buyer evidence reports marketplace phone/tablet/desktop layouts, stable navigation/page retention, mouse/text shopping controls, embedded Profile photos and explicit selected-only PSGC dropdowns. [Marketplace report and ten synthetic screenshots](references/marketplace-verification.md) travel with this bundle; dated October 5 follow-ups remain in [Progress](PROGRESS.md). Tests/builds are attributed reports, not rerun here. Storefront guest browsing, recency and address behavior are unchanged.

[Current backend review and portable checks](references/synchronization-2026-10-07.md) retain historical manifests and distinguish reviewed Laravel `a946692` from Buyer-adopted `57e9eb2`. Per-Shop provider selection (G25), private chat media adoption (G27), current resolution of historical checkout deployment failures, live/device/accessibility/signing/production gates remain unverified. External source paths are optional provenance; this complete bundle resolves locally after copying into `docs/`. Preserve active destination instructions and archive bytes during a selective merge.

## Selective synchronization — 2026-10-09

The October 8 external reports add [MapLibre address pinning](references/maplibre-verification.md) and [live Geoapify verification](references/geoapify-live-verification.md). Current optional map setup uses `maplibre_gl` 0.27.1 plus geolocator; earlier package metadata remains historical. Reported tests/builds were not rerun here, and the pre-existing desktop checkout accessibility failure stays recorded. The tested localhost public-key/provider path does not certify installed Android, real-account commerce or production configuration. Buyer API adoption remains `57e9eb2`; shipping G25 and media G27 stay open. [Synchronization and portability checks](references/synchronization-2026-10-09.md) identify the reviewed Laravel revision separately.

Copy this bundle’s complete contents into the Buyer project’s `docs/`, retaining the `logs/` forwarding pages and `assets/` tree. Merge newer destination documents/history selectively; preserve its root instructions. Source paths and external tool commands are provenance/instructions for the Flutter project, not files supplied by this docs-only copy.

## Order contact correction contract — 2026-10-10

Audit B02 is fixed in Laravel and the storefront: correction accepts changed recipient/contact only at an identical complete trimmed location and seven-decimal map pin. Order deliveryAddress now includes nullable latitude/longitude; location differences return `422 ADDRESS_LOCATION_CHANGE_NOT_ALLOWED` on `address_id`. See [operation](api/operations.md#op-036), [feature](features/customer/order-modification-cancellation/spec.md) and [G21](references/integration-gaps.md). Frozen prices/provider/routes remain unchanged. External Flutter source, adopted `57e9eb2` revision, historical verification and live/device acceptance status are unchanged; coordinate/error adoption and live verification remain pending.

## Customer profile photo validation — 2026-10-10

Audit B04 is fixed locally in Laravel: profile photos require bounded full decode/rewrite with 8,000-pixel edges, 40,000,000 total pixels and strictly under 10 MiB for source/stored bytes. Invalid images and processing failures return safe `422 photo` errors while preserving the prior photo. See [operation](api/operations.md#op-011), [upload policy](references/file-upload-requirements.md) and [G15](references/integration-gaps.md). Endpoint/DTO/replay shapes remain unchanged. External Flutter adoption/status and live/deployed-runtime/device acceptance remain open.

## Voucher collection contract — 2026-10-11

[Discovery, collection and My Vouchers](api/voucher-collection.md) adds Customer APIs and claim requirements for platform claim-required/all Shop vouchers. Automatic legacy platform access and committed Checkout replay remain. Flutter adoption is pending G28; prior external implementation status and evidence remain unchanged.
