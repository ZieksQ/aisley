---
project: Courier Flutter application
type: Project Rules
status: Active
backend: External Laravel API
---

# AGENTS-COURIER.md

> Portable rules for the external Courier Flutter project. Copy this file into
> the Flutter repository root and rename it to `AGENTS.md` if desired. Paths
> below are relative to that Flutter project, not to the Laravel repository.

## Overview

The Courier application is a Flutter/Dart client for the AISLEY Laravel API. Android APK is the mobile delivery target; the same Flutter app may run through `flutter run -d web-server` on a fixed localhost port for browser camera and file-upload testing. It is a separate project from the Laravel monorepo and must not contain Laravel, React, Next.js, Tailwind, or a separate Courier browser dashboard.

Courier is one of AISLEY's roles alongside Customer, Seller, Admin, and Logistics. Courier screens, mobile networking, secure token storage, local mobile state, and accessibility belong here. The Laravel API remains the authority for identity, authorization, ownership, status transitions, data privacy, and operational eligibility.

The copied `docs/` contract is a snapshot. The Laravel repository and its implemented API are authoritative when the snapshot and server disagree.

## Git branch and commit rules

When implementing a feature, create and switch to a feature branch derived from the current Flutter branch before changing files. Use a descriptive branch name such as `feature/courier-auth-screen`.

After the requested feature is complete and verified, commit with a descriptive conventional message, for example:

```text
feat: add courier authentication flow
```

Do not commit secret files, generated credentials, local device data, or unrelated changes. Keep commits focused on the current Flutter feature.

## Rules for every prompt

1. Read `docs/PROGRESS.md` first. Identify the latest Flutter work and the backend contract version before starting a new task.
2. Read `docs/features/courier/rules.md` and the matching Courier feature specification completely before implementing or revising that feature.
3. Follow the existing Flutter/Dart architecture, null-safety settings, state management, routing, networking, and design system. Do not add packages or frameworks without explicit approval.
4. Keep one Flutter Courier codebase. Support Android APK and local Flutter web-server camera/file-upload testing where the matching feature spec permits it; do not create a separate web page, React component, browser cookie flow, or Laravel source file in this project.
5. Treat the authenticated Courier, approved Logistics affiliation, and sole operational hub as server-derived facts. Never let the client choose a different Courier, organization, hub, reviewer, role, ability, or status.
6. Send the documented Sanctum bearer token as `Authorization: Bearer <token>`. On Android, store it only in OS secure storage through the approved Flutter package. Before authenticated browser testing, verify the approved package's web behavior and document its security boundary; never fall back to plaintext token storage.
7. Never log, persist in ordinary app storage, place in URLs, or include in analytics a password, bearer token, token hash, reset token, or secret key.
8. Never read, print, copy, commit, or modify secret-bearing `.env` files such as `.env`, `.env.local`, or `.env.production`. Use only `.env.example`, redacted values, or the project's approved non-secret build configuration.
9. Never place API credentials, storage keys, private provider keys, or reset tokens in Dart source, assets, logs, screenshots, fixtures, or commits.
10. Read the shared contract before relying on a field, route, status, or permission. If it is absent or contradictory, stop at a safe scaffold and report the contract gap instead of inventing behavior.
11. Keep first-mile and final-mile assignments independent. Completing a Seller-to-hub task never grants a hub-to-Customer task.
12. Preserve the MVP boundary of one Courier affiliation and one operational hub per Logistics organization. Do not add sub-hub selectors or staff account assumptions.
13. Use the server's lowercase `snake_case` values for API status comparisons and human-readable labels only for presentation. Do not introduce legacy uppercase source values as client authority.
14. Offline data may be displayed as bounded stale information, but offline mode must never bypass server authorization or submit acceptance, pickup, scan, delivery, or completion actions.
15. Keep Customer, Seller, Admin, Logistics, and Courier data separated. Show only the minimum Buyer/Seller/address information required by the active authorized task.
16. Append dated progress entries; never delete or rewrite historical entries. Archive them only as described in rule 19.
17. Stay in scope. Do not refactor unrelated screens, rename shared packages, or change the Laravel repository from a Flutter task.
18. For registration, profile-photo, or vehicle-document uploads, read `docs/flutter-file-uploads.md`. Keep Android's working upload path intact while adding browser-safe selected-file transport; do not use browser paths with `MultipartFile.fromPath` or claim web uploads work until browser and installed-APK checks pass.
19. Archive the progress log at 150 lines. After appending a dated entry, if docs/PROGRESS.md exceeds 150 physical lines, preserve its complete contents unchanged in docs/logs/PROGRESS-YYYY-MM-DD.md; use a unique numbered suffix if that path exists, and never overwrite an archive. Replace the active log with its standard header, an up-to-date backend/API and Flutter-status snapshot, and a dated entry linking to the archive and summarizing the latest work. Historical entries may move to archives but must never be deleted or rewritten. Read an archive when older implementation history is relevant.
20. **Use familiar patterns and focused decisions.** All frontend work must follow `docs/design-courier.md`, including its Jakob's Law and Hick's Law guidance. Reuse familiar Material interactions, consistent labels, navigation, and shared theme styles; give each active task/form step one prominent next action, group secondary choices, and reveal later steps when relevant. Preserve essential context, accessibility, explicit consent, and server-required confirmations. Review affected screens against the guide before handoff; document a justified exception instead of silently adding a competing pattern.

## Read before changing code

- Read the latest `docs/PROGRESS.md` entry and record the backend/API version used by the Flutter change.
- Read `docs/features/courier/rules.md` and the exact matching feature spec. Existing specs may use either `spec.md` or `specs.md`; preserve the path.
- Read `docs/design-courier.md` before changing screen layout, styling, interaction, animation, or accessibility. It is the shared Flutter UI authority; feature specs own API behavior and cannot silently introduce conflicting visual conventions.
- Read the Courier-related sections of copied `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, and `docs/domain/Courier.md`.
- Read `docs/domain/Logistics.md` when affiliation, hub, assignment, parcel, or Logistics authority is involved.
- Read `docs/references/user-registration-requirements.md` for registration or approval work.
- Read `docs/references/file-upload-requirements.md` for ID, OR/CR, profile, proof, or any other image/file upload.
- Read copied API endpoint notes or contract-version records when available.

## Specification and contract rules

- Treat the Laravel implementation, migrations, API tests, and current backend `PROGRESS.md` as evidence of what exists.
- Treat the copied feature spec as the client contract only after it identifies whether each behavior is implemented, scaffold-only, planned, or unavailable.
- A copied Flutter spec may add Dart/UI implementation notes, but it must not change server permissions, ownership, fields, statuses, or transitions.
- Do not use `docs/order-logistics-flow-decisions.md` as an API authority. It is historical rationale; accepted rules belong in the canonical shared docs.
- Keep every Courier feature spec between **200 and 230 physical lines**, including headings, blank lines, frontmatter, code blocks, and checklists.
- Reach that range with real endpoint examples, state/error behavior, privacy, tests, and Flutter handoff details. Do not add repetition as filler.
- Preserve useful acceptance criteria and open decisions. Mark a criterion complete only when code, a contract, or a test proves it.
- When a material endpoint, field, permission, or status changes, increment the spec version, update the Flutter copy, and record the new backend/API version.

## API consumption rules

- Use only exact documented `/api/v1/...` paths, HTTP methods, content types, field names, response envelopes, and error codes.
- For every consumed endpoint, the spec must provide authentication, role and affiliation gates, ownership scope, request fields, prohibited fields, response DTO/nullability, errors, retry/idempotency, pagination, ordering, and cache behavior.
- Treat `implemented`, `scaffold-only`, `planned`, and `unavailable` as different states. A draft or conceptual route is not callable.
- The current Courier Dashboard scaffold may return unavailable sections with a truthful freshness state. Render that state; do not replace it with fake tasks, notifications, counts, or statuses.
- `GET /api/v1/courier/auth/me` is an identity check. Do not treat it as an operational task feed or as proof that a pending Courier is approved.
- A `401` clears the local session and returns to sign-in. A `403` maps to the documented pending, rejected, suspended, deactivated, or invalid-affiliation state without exposing another account's existence.
- A `409` is a server conflict, `422` is validation, `429` honors `Retry-After`, and timeout/offline/5xx responses are recoverable failures, not authoritative empty results.
- Send idempotency keys only when the endpoint contract requires them. Never retry a mutation blindly after an uncertain response.
- Keep private responses out of shared caches. Clear account-scoped cached data on logout, account denial, affiliation invalidation, or account switching.

## Authentication and registration

- Use the documented Courier routes: organization options, multipart register, bearer login, generic forgot-password, `/me`, and current-token logout.
- Send `device_name` during login. Do not send client `role`, `abilities`, `status`, `hub_id`, `reviewer_id`, or owner identifiers.
- Store the login token once in secure storage and attach it to later requests; never return it from app state, logs, `/me`, crash reports, or analytics.
- Model checking-session, signed-out, submitting, pending-approval, rejected, active, suspended, deactivated, invalid-affiliation, offline, timeout, and retrying states explicitly.
- Registration uses exact multipart keys, including nested address keys and `government_id`/`vehicle_registration` file parts. Preserve field values after recoverable validation errors but clear password values before retry.
- Client file checks are convenience only. The server enforces JPEG/JPG, PNG, or WebP and a strict size below 10 MiB; never claim success before persistence.
- Courier registration currently uses bundled PSGC/manual address fields and does not require coordinates or a map pin. Do not add Geoapify or map work unless the matching spec explicitly approves it.
- Logistics, not the Courier app, approves the affiliation. The app displays the resulting state and does not provide reviewer controls.

## Modularity and code organization

- Keep each Dart file focused on one responsibility.
- Keep screens responsible for composition and navigation; extract independent sections, forms, upload flows, status views, and reusable widgets into separate files.
- Keep controllers focused on one cohesive workflow. Separate independent concerns such as profile editing, password changes, photo uploads, and vehicle management.
- Proactively split a screen or controller when it exceeds roughly 400 physical lines, contains multiple independent workflows, or becomes difficult to test in isolation.
- Keep API requests in repositories, parsing in domain/data models, state transitions in controllers, and rendering in widgets.
- Do not split code mechanically into tiny files; use meaningful feature and responsibility boundaries.
- When adding a feature, review whether the existing presentation files should be modularized before extending them.
- Apply modularization to the feature or file being changed; do not refactor unrelated areas solely to satisfy the line-count guideline.
- Use readable, `dart format`-formatted Dart code. Do not compress statements, widgets, or functions into single lines to avoid the line-count guideline.
- Evaluate complexity, nesting, responsibilities, and testability in addition to physical line count.
- Apply these modularity rules to hand-written Dart files; do not manually refactor generated files.
- Organize hand-written Dart code by feature and responsibility. Keep components near the feature that owns their behavior.
- Move genuinely reusable, domain-agnostic widgets into `shared/` or the design system only when reuse is demonstrated.
- Shared widgets must not depend on feature-specific controllers, repositories, or screens.
- Avoid circular dependencies and imports into another feature's private implementation.

## Operational and dashboard boundary

- Shared QR/Code 128 camera candidate capture is implemented for the Android release APK and the same Flutter app served on localhost through `web-server`, using the existing `mobile_scanner` dependency. Physical camera and permission acceptance on an installed APK and in a localhost browser remain unverified. Keep decoded values as untrusted candidates; scanning never accepts, picks up, or proves delivery without the explicit documented action and server response.
- Do not implement live task, parcel, scan, waybill, assignment, proof, notification, route, or delivery mutations until the shared operational schema and endpoint contract are implemented by Laravel.
- A Dashboard may display safe read-only sections for notifications, available tasks, active tasks, and freshness only when the API marks them usable.
- Dashboard card taps navigate to the owning feature. Opening a card must not accept, assign, scan, pick up, deliver, or complete a task.
- Treat one Delivery Task as one parcel movement for one leg unless a revised contract explicitly introduces a route/run/manifest batch.
- Do not infer detailed physical states from generic Order statuses such as `assigned` or `picked_up`.
- Do not assume a Courier can accept multiple active tasks, perform batching, or share a route until the server contract defines capacity and task grouping.
- Route optimization, map rendering, background push, WebSockets, earnings, chat, incidents, and full offline synchronization require their own specs.

## Privacy, accessibility, and reliability

- Never display raw storage paths, token hashes, payment credentials, private reviewer notes, or unnecessary Buyer/Seller PII. Display private images only in the owning feature's authorized preview flow; do not log, export, or persist evidence in ordinary app storage.
- Use authorized, server-provided delivery URLs or identifiers for private assets; never construct blob URLs from filenames or IDs.
- Provide visible loading, empty, unavailable, forbidden, stale, partial, retry, success, and offline states. Do not represent a failed request as an empty list.
- Provide semantic labels, visible focus, readable status text, sufficient touch targets, and non-color-only indicators for every interactive screen.
- Deduplicate refresh/event results by server identifiers and ignore obsolete responses. A notification or network failure must not undo a committed state.
- Keep local snapshots bounded and encrypted where permitted by the contract; delete them on logout or account-scope changes.

## Testing and handoff gate

- Run `flutter analyze` and the relevant `flutter test` targets before handoff.
- Test JSON parsing, nullable fields, multipart field names, secure-storage failures, token expiry, `401/403/409/422/429`, timeout, offline, retry, and logout behavior.
- Test that unavailable/scaffold API sections do not create fake operational cards or enable mutation buttons.
- Add widget/accessibility tests for loading, empty, unavailable, forbidden, stale, partial, error, and success states.
- For frontend changes, verify familiar controls, stable navigation/labels, action hierarchy, discoverable secondary choices, preserved essential context, and accessible focus/text scaling against `docs/design-courier.md`. A documentation update alone does not prove existing screens comply.
- Mocks and fixtures support deterministic tests but cannot replace verification against the documented Laravel API when an endpoint is implemented.
- Before handoff, verify spec line count, endpoint paths, backend commit/API version, copied-document synchronization, privacy rules, and progress entry.
- Record the backend commit/API version and Flutter change in this project's `docs/PROGRESS.md`; update it whenever the backend contract changes.
- If a required backend endpoint, migration, status, or permission is missing, stop at a scaffold and report the gap instead of implementing a guess.

## Safe command boundary

- Run commands only within the Flutter project directory.
- Do not run commands that modify the Laravel repository, other repositories, system settings, global packages, or files outside the project.
- Do not use `sudo` or destructive commands unless the user explicitly scopes and approves the exact action.
- Do not include shell output containing environment values, tokens, private URLs, device credentials, or uploaded evidence in an issue or commit.
