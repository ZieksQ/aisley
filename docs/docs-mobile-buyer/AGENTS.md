---
project: Buyer Flutter application
type: Project Rules
status: Active
backend: External Laravel API
---

# AGENTS.md — Buyer Flutter

> Portable rules for the standalone Customer/Buyer Flutter project. Copy the
> complete bundle into its `docs/` and copy this file to its root as `AGENTS.md`.
> Paths written as `docs/...` resolve against that Flutter repository. When
> reading the bundle in place, omit the `docs/` prefix and resolve from the
> bundle root. Upstream paths are evidence locators, not bundled files.

## Overview

The Buyer application is one Flutter/Dart client for AISLEY's external Laravel API. Android APK is the delivery target; the same app runs on a fixed localhost origin for browser testing. `customer` is the persisted role and token ability; Buyer is product terminology.

The Flutter project owns Customer screens, navigation, typed networking, secure storage, local state and accessibility. Laravel owns identity, approval, consent enforcement, permissions, prices, shipping, vouchers, checkout eligibility, Order transitions, conversation permissions and support-ticket rules.

Every Buyer Flutter feature remains pending at this documentation baseline. Implemented Laravel/storefront behavior and imported Courier work do not establish Buyer mobile implementation or acceptance. Reconcile copied-contract conflicts with current backend evidence before enabling affected behavior.

## Git branch and commit rules

Create and switch to a new branch from the active Flutter branch before feature changes, for example `feature/buyer-auth-screen`. After the requested change is complete and verified, automatically commit relevant changes with a descriptive conventional message:

```text
feat: add buyer authentication flow
```

Preserve unrelated work. Keep credentials, device data and private uploads out of commits; honor repository ignore rules.

## Rules for every prompt

1. Read `docs/PROGRESS.md` first. Identify actual Buyer work, the backend baseline and remaining acceptance gates.
2. Read `docs/features/customer/rule.md` and every matching feature spec completely before implementing or revising a Customer feature. Read the shared policy spec when consent is affected.
3. Follow existing Flutter/Dart architecture, null safety, state management, routing, networking and theme. Inspect `pubspec.yaml` and tools; obtain explicit approval before introducing libraries or replacing the stack.
4. Keep one Flutter app for Android and local web testing. Laravel remains external. JavaScript workspace packages, React, Next.js, Tailwind and browser-session code cannot be imported as Flutter implementations.
5. Consume Customer and permitted shared/public APIs only. Keep Seller, Admin, Logistics and Courier screens, authentication and operational powers outside Buyer. Messaging a Courier grants no Courier endpoint access.
6. Send `device_name` at Customer login to select scoped Sanctum bearer authentication. Use approved platform secure storage, verify its browser behavior, and provide no plaintext fallback.
7. Never log passwords, tokens, reset links, private chat bodies, complete addresses, file bytes or private payloads. Never put credentials in URLs, ordinary preferences, analytics, crash reports or source control.
8. Do not read, print, copy, commit or modify secret-bearing `.env` files. Use `.env.example`, redacted examples or approved non-secret configuration. Flutter build configuration is public.
9. Keep backend/storage credentials, private map-provider keys and reset tokens out of source, assets, fixtures, screenshots and commits. Send authorization only to the configured trusted API origin.
10. Verify fields, routes, statuses, ownership and availability against the contract. Record missing/conflicting behavior in the integration-gap register and leave affected actions unavailable until resolved.
11. Let Laravel determine active/Admin-approved Customer access, visibility, ownership, stock, prices, shipping, vouchers and Order capabilities. Client guards never authorize an action.
12. Keep protected navigation closed until `/me` identity and required consent resolve. Public browsing may continue during recoverable failures; stored status is not proof of approval.
13. Clear private caches, quotes, drafts, uploads/previews, history, read markers, pending keys and obsolete responses on logout, account switch or identity authorization loss.
14. Offline mode may show permitted bounded stale reads. Do not queue commerce/communication writes or blindly retry uncertain mutations; follow each endpoint's actual replay contract.
15. Keep Shop, Logistics and Courier conversation channels separate. Participants, read-only transitions and support-ticket authority come from Laravel.
16. Append dated progress entries without rewriting history. Apply the archive rule below after each entry.
17. Stay within the requested feature. Flutter work does not authorize backend changes, migrations, seeds, unrelated refactoring or edits to another checkout.
18. Read registration/upload references for relevant work. Preserve native adapters; browser-selected files require bytes/streams and cannot rely on OS paths.
19. After an entry makes `docs/PROGRESS.md` exceed 150 physical lines, preserve the complete file in `docs/logs/PROGRESS-YYYY-MM-DD.md`, using a unique suffix when needed. Start a fresh standard header with current backend/Flutter status and a dated archive link. Never overwrite or rewrite archives.
20. Follow `docs/design-buyer.md`: light-only branding, familiar shopping patterns, clear next actions, predictable back/cancel, accessible touch/focus/text and honest loading/error states.

## Read before changing code

- Read `docs/PROGRESS.md`, `docs/README.md`, `docs/requirements.md`, `docs/workspace.md` and `docs/architecture.md`.
- Read `docs/features/customer/rule.md`, the exact matching `spec.md` or `specs.md` and prerequisite specs. Preserve existing feature paths and filenames.
- Read `docs/design-buyer.md` for layout, interaction, styling or accessibility. Feature contracts own behavior; design owns Flutter presentation conventions.
- Read `docs/api/authentication.md`, `docs/api/endpoints.md`, `docs/api/contracts.md`, `docs/api/field-index.md` and `docs/api/messaging.md` as applicable.
- Read `docs/references/user-registration-requirements.md` for registration/approval and both `docs/references/file-upload-requirements.md` and `docs/flutter-file-uploads.md` for uploads.
- Read `docs/maps-location-api.md` for PSGC/location and `docs/references/integration-gaps.md`, `docs/references/source-provenance.md` and `docs/verification.md` before handoff.
- Follow upstream evidence when its checkout is available. Report missing contract details when unavailable; do not assume upstream files exist in the portable bundle.

## Specification and contract rules

- Use current Laravel routes, Requests, Resources, services and tests as implementation evidence. Feature requirements supply intended behavior; identify conflicts explicitly.
- Distinguish implemented, scaffold-only, planned and unavailable backend behavior separately from pending or verified Buyer Flutter implementation.
- Follow WHAT/MUST/HOW and **200–230 physical lines** in `docs/features/customer/rule.md` for new or revised Customer specs, including authentication.
- This local rule overrides the `feature-spec` skill's 120–160-line preference and its instruction to prefer fewer lines for simple features. Dart source modularity thresholds remain separate.
- Existing short Customer specs remain baseline documents until revised; they are not certified ready under the new rule. Shared-policy specs, instructions and guides are outside this range.
- Preserve useful acceptance criteria, provenance and open decisions. Record material contract revisions and backend versions; mark completion only from actual implementation and verification evidence.
- Never invent server fields, roles, approval paths, refresh tokens, native push or conceptual routes as usable APIs.

## API consumption rules

- Use exact `/api/v1/...` methods, paths, content types, JSON casing, envelopes, nullable fields, error codes and per-operation retry rules.
- Keep typed parsing in DTOs/models and API access in repositories; keep HTTP calls, tokens and response-shape guesses out of widgets.
- Scope private responses/cache keys to verified identity. Keep public browsing and guest recency separate from account history and private media.
- A `401` clears invalid identity. Explicit account/role denial clears private identity; resource-specific `403/404` clears affected state. `POLICY_CONSENT_REQUIRED` preserves the session while blocking protected work.
- Treat `409` as conflict, `422` as validation and `429` as throttling; honor documented `Retry-After`. Timeout/offline/server failure are errors, not authoritative empty lists.
- Reuse keys and frozen payloads only for supported replay. Do not retry additive Cart changes, photo uploads or uncertain writes as new actions.
- Keep server prices, quote expiry, stock, serviceability, voucher benefits and totals authoritative. Stale/conflicting quotes require reviewed refresh before placement.
- Retrieve private media through authenticated delivery. Never construct storage URLs or put a bearer token in an image URL.

## Authentication and registration

- Use documented Customer register/login/forgot/reset/`me`/logout routes. Send `device_name` for Android/local-web bearer login; keep storefront HttpOnly-cookie/CSRF authentication separate.
- Login returns a token once with the `customer` ability; `/me` returns identity. Stored role/status checks enforce access; do not claim additional ability middleware or refresh-token APIs.
- Model checking-session, signed-out, submitting, pending approval, rejected, suspended, inactive, active, consent-required, storage failure, offline, timeout and retry using documented results.
- Registration accepts supported profile/credential fields and returns pending/no token. Address/ID evidence and applicant polling are gaps; Admin approval happens outside Buyer.
- One session controller owns bootstrap, consent and identity. Require explicit current Terms/Privacy acceptance when enforced; stale versions need renewed reading/confirmation.
- Consent gating preserves valid identity. Never automatically accept policies or replay blocked commerce writes; network/storage failure is a retry state, not proof of sign-out.
- Logout revokes the current bearer. Offline local sign-out cannot prove remote revocation. Account password change preserves the current bearer and revokes others; reset revokes all personal access tokens.
- Recovery mail targets the trusted configured storefront. Native reset links and device/session-list controls remain unavailable; never persist reset tokens or promise those controls.

## Modularity and code organization

- Keep each hand-written Dart file focused. Screens compose navigation/widgets; repositories own API/cache access, models own parsing and controllers/view models own state transitions.
- Separate profile, password, photo, addresses, checkout, channel messaging, reviews, notifications and support. Shared widgets must not depend on feature-private controllers/repositories.
- Review screens around 400 physical lines, reusable widgets/models around 250, services/controllers around 500 and tests around 600. Split for responsibility/testability; avoid mechanical tiny files and unrelated refactoring.
- Apply these thresholds to hand-written source. Exclude generated code, fixtures, SDK/build output and specifications; Customer specs use their own rule.
- Organize by feature/responsibility. Promote shared code when reuse is demonstrated; avoid circular imports and another feature's private implementation.
- Use readable configured `dart format` output. Consider coupling, nesting, complexity and responsibility as well as lines.
- Keep `dart:io` in native-only conditional adapters. Use approved PSGC JSON assets with provenance, cascading selectors and manual fallback; Flutter cannot import npm data/selectors directly.

## Shopping and communication boundaries

- Discovery shows server-visible Products/Shops. Bazaar/MoneyFest remain deferred; unavailable workflows must not become enabled destinations.
- Buy Now, selected Cart, quotes and COD placement follow checkout contracts. Buyer cannot select operational Logistics assignments or fulfillment authority.
- Address edits do not rewrite placed Orders. Cancellation/correction uses server-owned capabilities and documented revisions/keys; avoid unsupported refund or rate-revalidation promises.
- Reviews require server-proven delivered purchase. Q&A and partial photo retries follow their individual contracts.
- Shop, Logistics and Courier channels have separate contexts/permissions. Delivery, ended custody or reassignment may make threads read-only; inbox taps never change Order/task status.
- Notifications mean implemented inbox/read behavior. Native push, background delivery, unread-count/read-all and support attachments/linked records remain gaps unless implemented separately.

## Privacy, accessibility and reliability

- Display only permitted personal data. Keep reviewer notes, raw storage paths and credentials out of screens, logs and ordinary caches.
- Guest recency contains bounded public Product ID/time hints. Never copy private account history into guest storage; merge only after verified authentication.
- Deduplicate results and reject obsolete session generations. Resource denial or identity loss must not leave another account's data visible.
- Provide loading, empty, unavailable, forbidden, stale, partial, retry, success and offline states. Preserve safe input after recoverable errors and clear private state on account loss.
- Verify 48×48 logical-pixel targets, labels, text scaling, TalkBack order, visible focus and non-color status cues. Respect keyboard insets, safe areas and Android/browser back/cancel.
- Apply approved map requirements, attribution and explicit location permission. Pin failure preserves manual addresses; private server keys and invented live Courier tracking stay outside Buyer.

## Testing and handoff gate

- Run configured formatting, `flutter analyze` and relevant unit/widget/contract tests for implementation changes; record commands/results.
- Test DTO casing/nullability, storage failures, restoration/revocation, account switching, consent races, `401/403/409/422/429`, timeout/offline and uncertain responses.
- Verify Android/web upload adapters, private-media authorization, checkout replay, channel messaging and account cleanup for affected features.
- Run `flutter build web` and `flutter build apk --release` when appropriate; verify affected interactions on installed Android and local browser. Builds/mocks do not replace live API, permission or accessibility acceptance.
- Use Buyer `http://localhost:8766`, separate from Courier `8765`. Document exact-origin CORS/header changes through the backend owner; keep the token test origin outside stateful-cookie configuration.
- Before handoff check revised spec length, links, endpoints, backend version, copies, privacy and progress. Documentation alone certifies no Flutter screen or backend runtime behavior.
- Append work, adopted version, checks and remaining gates to destination `docs/PROGRESS.md`. Keep unverified criteria open and archive through the rule above.

## Safe command boundary

- Run commands within the authorized project. In a copied Flutter project, do not modify Laravel, other repositories, global packages or system settings without an explicitly scoped task.
- Do not install services, modify databases, run migrations/seeds or use `sudo` by inference from a Flutter feature.
- Keep command output containing environment values, tokens, reset URLs, uploads or device credentials out of issues and commits.
