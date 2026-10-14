# Buyer Flutter documentation bundle

> Current status and inspected revisions: [October 12 synchronization](references/synchronization-2026-10-12.md). Dated reports below retain their original verification scope; client sources belong to the corresponding standalone Flutter repository.


Historical baseline: **`7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0`**. Adopted client contract inspection: **2026-10-03**, checkout **`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`**. Supplied webapp backend review: **2026-10-09**, **`0a6aaa8096196e2c26822ac0281d5d30675511a8`**; current shipping is adopted with live/device G25 gates open; media is implemented locally; live/device acceptance remains G27. Buyer Flutter implementation: **Phases 1–4 implemented; live/device acceptance remains partial**. See [Phase 4 evidence](references/phase-4-verification.md), [Phase 3 evidence](references/phase-3-verification.md), [Phase 2 evidence](references/phase-2-verification.md) and [Phase 1 evidence](references/phase-1-verification.md).

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

The handoff includes complete feature contracts, a concrete stable SDK/package blueprint, synthetic examples and all nineteen unchanged PSGC reference assets with attribution/checksums. The original documentation handoff included no Flutter implementation, credentials or server configuration; the standalone Buyer Flutter project implements Phases 1–4 under lib/ and Phase 5 local verification tooling. Copy the assets using [setup](setup.md). Local documents supply implementation authority; upstream source paths/hashes are optional audit provenance. A missing monorepo checkout is not an implementation dependency.

Configured backend origins, approved test accounts, localhost CORS/header visibility and suitable public map credentials remain external deployment inputs. Validate live integration against the deployed backend; record material differences and actual Flutter results in Progress without rewriting the historical baseline.

The standalone Buyer project tracks this bundle at `docs/`; the platform keeps it at `docs/docs-mobile-buyer/`. Upstream relocation to
`docs/docs-mobile-buyer/` in `c5ce0cc` and the original ignored `docs/cabigan/`
location remain historical provenance. Copy the complete bundle when handing it off.

## Customer specification maintenance

Read [Customer rules](features/customer/rule.md) before creating or revising a Customer spec, including authentication. New or revised specs use WHAT/MUST/HOW and contain 200–230 physical lines; this local rule overrides the feature-spec skill's shorter length preference. All 22 Customer specs now meet the length requirement and define requests, types, states, replay and tests. Shared consent is also complete. Phases 1–4 implementation evidence is recorded separately; controlled authenticated and installed-device acceptance gates stay open.


The Buyer marketplace now adapts to Android phones/tablets and desktop browsers in the
same Flutter app. See [design](design-buyer.md) and [marketplace evidence](references/marketplace-verification.md).

## Webapp contract sync — 2026-10-09

The supplied webapp handoff reviews Laravel `0a6aaa8096196e2c26822ac0281d5d30675511a8` separately
from this client's adopted `57e9eb2` baseline. [Per-Shop shipping selection](api/shipping-selection.md)
adds provider options, frozen selections and revised quote/Order projections (G25).
[Private chat media](api/chat-media.md) adds runtime-gated attachment upload/processing/delivery
and explicit message binding (G26). Both are adopted locally; live/device gates remain open. Earlier tests describe
the original client contracts. See [the local sync record](references/webapp-docs-sync-2026-10-09.md)
and [integration gaps](references/integration-gaps.md). Local implementation history, SDK metadata,
MapLibre evidence and required sign-in/account-only recency remain the implementation record.

## Shipping client adoption — 2026-10-09

Buyer now implements `22b0a48` shipping options, per-Shop selections, current projections
and frozen placement recovery. [Verification](references/shipping-selection-verification.md)
records synthetic client checks; deployed-provider, live commerce and installed-device gates remain open.

## Buyer voucher adoption — 2026-10-11

Buyer now implements [discovery, collection and wallet](api/voucher-collection.md) with explicit Checkout requote against Laravel `7e89b391`. [Verification](references/voucher-collection-verification.md) distinguishes source/synthetic checks from deployed/live/installed-device gates. Historical general and shipping baselines remain preserved.

## Private media adoption — shared G27, audit G26 (2026-10-12)

Buyer implements receive-only video/document consumption and inclusive 8 MB image selection against Laravel `28fc740`. [Verification](references/private-media-verification.md) separates local checks from storage/worker/scanner, deployed exchange and installed-device acceptance. Mobile video/document uploads remain outside this release.

Account password editing adopts the [email verification contract](api/password-change.md) in the local Buyer client (2026-10-14); live SMTP/deployed/device acceptance remains open.

## Email-first registration — 2026-10-14

Registration adopts [email OTP verification](registration-email.md) before account creation, with required proof, expiry/resend/error recovery and existing approval gates. Updated Flutter registration is implemented locally; deployed API, live SMTP and installed-device acceptance remain open. Existing accounts keep their login behavior.
