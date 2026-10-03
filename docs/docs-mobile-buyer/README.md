# Buyer Flutter documentation bundle

Documentation baseline: **2026-10-03**, Laravel checkout **`7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0`**. Buyer Flutter implementation: **pending in every feature**.

This portable bundle defines a new standalone Flutter/Dart Customer app targeting Android, with the same application tested in a local browser. Laravel, Sanctum, PostgreSQL, and configured blob storage remain the platform backend. `customer` is the only persisted/API role; Buyer is product terminology.

Read in this order:

1. [Progress](PROGRESS.md), [agent instructions](AGENTS.md), and [Customer specification rules](features/customer/rule.md).
2. [Requirements](requirements.md), [shopping workflows](workspace.md), and [feature index](features/README.md).
3. [Architecture](architecture.md) and [Buyer design](design-buyer.md).
4. [Authentication](api/authentication.md), [endpoint inventory](api/endpoints.md), [DTOs and requests](api/contracts.md), and [messaging contracts](api/messaging.md).
5. [Registration requirements](references/user-registration-requirements.md), [upload policy](references/file-upload-requirements.md), [Flutter upload transport](flutter-file-uploads.md), and [addresses/maps](maps-location-api.md).
6. [Integration gaps](references/integration-gaps.md), [verification](verification.md), [source provenance](references/source-provenance.md), and the specification for the feature being built.

## Delivery phases

| Phase | Deliverables | Exit boundary |
| --- | --- | --- |
| 1 — Foundation/authentication | App composition, typed network client, configuration, secure token storage, login/register/recovery, session restoration, policy reading/consent, protected navigation | Android and fixed-origin local web compile; active Customer restoration and denial/consent cleanup verified |
| 2 — Discovery/account | Homepage, Products/Shops search, Shop browsing, Product Detail, profile/password/photo, Address Book, Wishlist, Recently Viewed | Public/private cache separation, PSGC fallback, authenticated photos, guest merge and account switching verified |
| 3 — Cart/checkout/orders | Cart configuration, Buy Now, quotes, voucher usage, COD placement/results, Orders/tracking, cancellation/address correction | Server totals and serviceability, immutable snapshots, uncertain placement reconciliation and same-key retries verified |
| 4 — Communication/reviews/support | Separate Shop/Logistics/Courier inboxes, notifications/preferences, Q&A, verified reviews/photos, support tickets | Cross-role replies, read markers, read-only transitions, partial uploads and safe retries verified |
| 5 — Integration/release | Live development API, installed Android, local browser, security/accessibility/permission and recovery checks | Evidence recorded against backend commit; open release gates explicitly resolved or retained |

Bazaar and MoneyFest remain deferred placeholders. Native push, payment gateways, returns/refunds, live Courier GPS, and features without an implemented API are outside the initial delivery. An available backend endpoint does not establish a Flutter screen or verified integration.

## Copying to a Flutter repository

Copy **this directory's complete contents** into the standalone repository's `docs/`. Copy `docs/AGENTS.md` to the repository root so coding agents discover it. Keep the docs copy as the portable record. Its links are relative to this bundle and require no monorepo checkout.

The [documentation validation record](references/documentation-validation.md) records completed checks and their limits.

The bundle contains documentation only: no Flutter scaffold, SDK pins, package installation, app assets, PSGC dataset, credentials, seeds, or backend changes. Before implementation, inspect the destination repository and its `pubspec.yaml`; establish approved Flutter SDK/dependency choices there. Obtain the PSGC JSON assets using the documented export procedure before declaring offline address selectors complete.

Recheck current Laravel contracts before implementing a phase. Record the new source commit and any changes in the destination `docs/PROGRESS.md`. Preserve this baseline's provenance and historical entries; imported Courier progress is not Buyer evidence.

The bundle is now tracked at `docs/docs-mobile-buyer/`, following its relocation in commit `c5ce0cc`. Its original location under `docs/cabigan/` was ignored; that directory's existing ignore policy remains unchanged. Copy the complete tracked bundle when handing it off.

## Customer specification maintenance

Read [Customer rules](features/customer/rule.md) before creating or revising a Customer spec, including authentication. New or revised specs use WHAT/MUST/HOW and contain 200–230 physical lines; this local rule overrides the feature-spec skill's shorter length preference. Existing short specs remain baseline documents until individually revised. This update does not certify them implementation-ready or change pending Flutter acceptance.
