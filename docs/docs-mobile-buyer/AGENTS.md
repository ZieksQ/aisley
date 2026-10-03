# Buyer Flutter agent instructions

These instructions apply after this documentation bundle is copied into a standalone Buyer Flutter repository. Read `docs/PROGRESS.md` first (use `PROGRESS.md` when reading the bundle in place). Read `docs/README.md`, requirements, workspace, architecture, design-buyer, the matching feature spec, API guides, and the relevant references before implementation. Resolve paths against the destination repository; upstream paths in the provenance guide are evidence locators, not local files.

## Scope and contracts

- Use Flutter/Dart for one Android application with local browser testing. Laravel remains external. Inspect the existing Flutter SDK, `pubspec.yaml`, formatter, analyzer, state management, routing, networking, and secure-storage choices. Reuse established dependencies; obtain approval before introducing a new library or replacing the stack.
- All Buyer Flutter features are pending at this baseline. Record actual implementation and verification independently from Laravel/storefront availability. Never import Courier completion claims.
- `customer` is the persisted role and token ability. Call Customer/shared-public APIs only. No Seller/Admin/Logistics/Courier auth, task acceptance, pickup scanning, POD submission, cash collection, fleet management, or approval actions belong in Buyer screens.
- Laravel derives ownership and enforces active/Admin-approved Customer access, consent, Product visibility, prices, stock, shipping, vouchers, Order transitions, messaging participants, and ticket authority. Client guards improve navigation; they cannot authorize data or actions.
- Read [authentication](api/authentication.md) before auth/security work, both registration/upload references for registration evidence work, [uploads](flutter-file-uploads.md) for any image work, and [maps](maps-location-api.md) for addresses/location.
- Use the exact API fields, methods, mixed DTO casing, envelopes, revisions, and per-operation idempotency rules. Flag an unavailable endpoint or conflicting source in the integration register before inventing behavior. Backend changes require a separately authorized backend task; never edit deployed migrations.

## Session and privacy

- Login supplies `device_name` for the bearer path on Android and the local web target. Store tokens only through approved platform secure storage; there is no plaintext fallback. The existing storefront has its own HttpOnly-cookie/CSRF flow.
- One session controller owns bootstrap, consent and account identity. Protect private routes until `/me` and consent resolve. Storage/network failures are retryable states, not proof of sign-out or consent.
- Clear private caches, quotes, drafts, uploads/previews, history, read markers, pending keys, and stale async responses on logout, identity switch, or account/role authorization loss. Resource-specific denial clears the affected resource. `POLICY_CONSENT_REQUIRED` preserves the valid session but blocks protected work.
- Never log passwords, tokens, reset links, file bytes, chat bodies, full addresses, private payloads, or storage paths. Never put bearer credentials in URLs, ordinary preferences, analytics, crash reports, or source control.
- Do not queue offline commerce or communication writes. Reconcile uncertain writes using their actual API contract; keep the same key and frozen payload only for operations supporting replay. A new key is a new action.

## Organization and verification

- Screens compose navigation and focused widgets. Repositories own API/cache access, typed DTOs own parsing, and controllers/view models own state transitions. Split profile, password, photo, addresses, checkout, messages, reviews, and support into their own responsibilities.
- Review screens around 400 lines, reusable widgets/models around 250, services/controllers around 500, and tests around 600. Use cohesive boundaries; do not mechanically split or refactor unrelated files. Exclude generated code, fixtures, SDK/build output and specs from thresholds.
- Keep `dart:io` in native-only adapters with conditional imports. Address JSON is a Dart asset, not an npm import. Browser-picked files need bytes/streams, not OS paths.
- Run configured formatting checks, `flutter analyze`, focused unit/widget/contract tests, `flutter build web`, and `flutter build apk --release` as appropriate to the change. Follow [verification](verification.md) for installed Android and fixed-origin browser checks, keyboard/back/focus/accessibility, loading/empty/error/permission states, and live API evidence. Build success alone does not establish release readiness.
- Make changes from the destination repository directory. Stay within the task's files; do not install services, alter another checkout, modify databases, or add backend permissions by inference.

## Branches and progress

Create and switch to a new `feature/<short-title>` branch from the active branch before feature changes. On completion, commit task changes automatically with `feat: concise summary`. Preserve unrelated work and never force-add files ignored by repository policy.

Append a dated summary to the destination `docs/PROGRESS.md` with implemented behavior, backend commit, commands/checks actually run, and remaining gates. Never rewrite existing entries or mark mocked tests as live acceptance. If the log exceeds 150 physical lines after an entry, move the entire file to `docs/logs/PROGRESS-YYYY-MM-DD.md` with a unique suffix if needed and start a fresh standard header plus archive entry. Preserve archives. This in-place bundle's log records documentation only until a real Buyer app exists.
