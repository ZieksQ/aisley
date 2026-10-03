---
title: Courier Flutter Design Guide
system: AISLEY
type: Design Guide
platform: Flutter / Dart
role: Courier / Rider
status: Active inbox/dashboard previews; photo/COD intent, private POD review, and Logistics/Seller/Buyer chat flows implemented locally
---

# Courier Flutter Design Guide

## Scope

The supplied documentation baseline is `4c3f504` (Auth v2.6); Flutter implementation evidence remains recorded against `d7df220`, with newer Auth integration outstanding.

This guide applies to the external Flutter Courier application on Android and to local browser testing of that same app through Flutter `web-server`. It does not define the separate webapp's Customer storefront or React Admin, Seller, or Logistics dashboards. Laravel remains authoritative for identity, approval, ownership, and operational state.

The current API supports Logistics discovery, Courier registration, approval-gated login, `me`, logout, an explicit password-recovery unavailability response, account management, policy consent, notifications, support tickets, first-mile identifier pickup, task-bound final-mile hub handoff, batch routes, final-mile movement, private photo POD, Logistics-reviewed completion, delivered history, and task-scoped chat with Logistics, Seller, and Buyer. Flutter implements the notification inbox, private support-ticket flow, separate read-only first-/final-mile dashboard task previews, atomic final-mile batch acceptance, Android/web QR/Code 128 candidates, Android rear-camera POD plus browser file fallback, photo upload and completion intent with COD cash confirmation, authenticated in-memory POD review for active/rejected/history detail, and Logistics/Seller/Buyer task chat. Batch-route rendering, failed-attempt submission, and linehaul trip screens remain unadopted. Authenticated support-ticket/batch API and COD/Logistics validation, live chat exchange, and installed-device/browser acceptance remain unverified. The Laravel dashboard aggregate remains unavailable. Background push, live route telemetry, signature proof, earnings, and offline mutations remain deferred.

## Frontend authority

This is the shared Flutter UI contract for every Courier feature, including Android, Linux development, and local web-server testing. Feature specs own API fields, eligibility, and workflow steps; this guide owns their visual and interaction conventions. Architecture and agent rules must link here instead of defining competing UI rules. Copied webapp mockups demonstrate API behavior, not Flutter layout requirements. If a feature needs an exception, document its user need and accessibility impact here and in the matching spec before applying it; never use a visual simplification to change server authority.

The rules below are requirements for new and revised frontend work. Publishing them does not certify that every existing screen already complies; review the affected screens and record remaining gaps when implementing a change.

## Familiar patterns and focused decisions

Apply Jakob's Law by retaining recognizable platform interactions and consistent meaning across screens. Apply Hick's Law by reducing unnecessary simultaneous decisions and organizing necessary choices around the current task. These are design principles, not a fixed limit on menu items or a reason to hide essential information. See [NN/g on consistency and standards](https://www.nngroup.com/articles/consistency-and-standards/) and [IxDF on Hick's Law](https://ixdf.org/literature/topics/hick-s-law).

- Reuse the app's Material components, theme, navigation behavior, field conventions, and status presentation. The same action has the same visible label, icon meaning, and relative placement wherever its context is equivalent.
- Keep destination names stable: **Pickup orders**, **Delivery work**, **Delivery history**, **Notifications**, **Task messages**, and **Account**. Preserve familiar Back, Cancel, Save, Retry, and Sign out behavior; do not replace visible controls with gestures alone.
- Give each active task or form step one visually dominant next action when an action is available. Use secondary emphasis for alternatives, help, refresh, and cancellation. A read-only list or pending-review state need not have a primary mutation button.
- Present only the actions relevant to the server-returned state. Keep the current state and next prerequisite visible; explain a temporarily disabled next action beside it. Omit unauthorized or unimplemented mutation controls instead of displaying a wall of disabled buttons.
- Group necessary choices by task or purpose. Put optional details and infrequent actions behind clearly labelled expansion or secondary controls; preserve discoverability and keyboard/screen-reader access. Use search or filters for long lists only where the feature contract supports them.
- Keep work entry points easy to find. Bound dashboard previews and link to their complete owning lists; do not duplicate every task action on the dashboard or treat a preview as a complete workload count.
- Reveal workflow steps as prerequisites become satisfied. For final-mile delivery, movement, photo selection/upload, explicit cash acknowledgment when required, completion intent, and pending Logistics review remain distinct steps. Never skip a required step to reduce clicks.
- Keep task identity, leg, current status, required address/contact context, cash due, validation errors, and consequences visible at the decision where they matter. Do not collapse essential information or preselect policy consent, cash collection, or an operational confirmation.
- Label buttons by what the tap does. **Choose photo** opens a picker, **Open camera for POD** opens still-photo capture, and **Scan** opens a scanner. A **Delivered** intent action must explain before submission that Logistics review is pending; only the server-confirmed result may be labelled delivered.
- Use one explicit confirmation at the point of a consequential action, following the owning spec. Avoid chains of equivalent confirmation dialogs and confirmations for ordinary navigation. Retain discard protection for unsaved work and the documented sign-out/removal confirmations.
- Keep navigation and choices stable during refresh. Update status in place without stealing focus, changing the selected task, or moving an action under the user's pointer. Android and web-server share labels and workflow semantics while using their supported picker, permission, and input controls.

## Design goals

- Make a Courier's next action obvious on a small screen and in poor network conditions.
- Keep registration and approval states understandable without exposing private review data.
- Use consistent, calm professional surfaces for work-related information and strong contextual emphasis for safety or blocking states.
- Prefer simple, fast, touch-friendly interactions over dense desktop dashboard patterns.
- Never let visual state imply permission or operational authority that the API has not granted.

## Visual language

### Brand colors

- Brand accent: `#E6007A`. Readable semantic primary uses `#C00065` in light mode and `#FF85BD` in dark mode, with white/black foregrounds respectively.
- Secondary/deep purple: `#4C1268` in light mode; `#DCB0F1` in dark mode, with white/black foregrounds respectively.
- Error family: `#FF3B30`; readable semantic error uses `#B3261E` in light mode and `#FFB4AB` in dark mode, with white/black foregrounds respectively.
- Warning: `#FF8800`.
- Use a neutral background and readable foreground for the majority of the screen; accents should guide attention, not fill every surface.
- Use neutral surfaces with restrained accents. Any 60/30/10 color balance is optional guidance; readable contrast, status meaning, and clear action priority take precedence.

### Themes

- Support light and dark themes and follow the device's system preference by default.
- Define colors through Flutter `ColorScheme`/theme extensions rather than inline values. Every semantic color must have a readable foreground in both themes.
- Keep destructive, warning, pending, and success meanings consistent across screens. Pair color with text, iconography, or shape; never rely on color alone.

### Typography and spacing

- Use one app-wide `TextTheme` with a clear hierarchy for screen titles, section labels, body copy, helper text, and errors.
- Support system text scaling without clipping, overlap, or hiding required actions. Long server messages must wrap or become scrollable.
- Use a small, consistent spacing and radius scale. Keep form sections visually separated and avoid decorative density.
- Respect `SafeArea`, keyboard insets, display cutouts, and platform navigation bars.

## Navigation and layout

- Use a single, predictable authentication stack: Logistics selection → registration → pending result, or login → authenticated state.
- Navigate to the implemented Notifications, Pickup orders, Delivery work, Delivery history, and Task messages screens from the dashboard, but distinguish a screen's existence from end-to-end backend acceptance. The notification inbox works against its adopted v1 contract; first-/final-mile dashboard previews are separate read-only task-list reads, not Laravel aggregate cards. Final-mile photo/COD validation and live chat exchange remain unverified. Do not fabricate jobs or controls for unadopted capabilities.
- Use Flutter's adaptive navigation primitives. Phones are the primary target; tablets may use wider constrained content but must not become a desktop sidebar clone.
- Preserve user input when validation or a recoverable network error returns. Confirm before discarding a partially completed registration.
- Keep primary actions reachable above the keyboard when possible; use bottom action areas only when they do not obscure content or accessibility focus.

## Components and interaction patterns

- Use Material components (or the project's approved equivalent) with a centralized theme: buttons, text fields, dropdowns, searchable lists, dialogs, banners, progress indicators, cards, and navigation controls.
- Give every interactive control a visible label, meaningful semantics label, disabled state, pressed/focused state, and clear success/error feedback.
- Retain Material's default touch targets (normally at least 48 × 48 logical pixels); never shrink a custom interactive target below the shared 44 × 44 minimum. Avoid gesture-only actions; provide visible controls for back, retry, remove, and submit.
- Keep forms single-column on phones. Group related fields into named sections and show required markers and input examples before submission.
- Use confirmation dialogs for sign-out, destructive local-data removal, or discarding unsaved form changes. Operational confirmation follows the owning feature spec and the focused-decision rule above.

## Authentication and registration screens

### Logistics selection

- Present active Logistics organizations as a searchable, bounded list using the safe organization name returned by the API.
- Do not show or let the Courier choose a hub/sub-hub ID. The selected organization owns one sole operational hub, derived by the server.
- Show loading, no-results, unavailable, and retry states distinctly.

### Registration

- Organize personal, address, vehicle, and evidence sections in a scrollable form with progress or section headings.
- Display age as a read-only value derived from the entered birth date; never ask the user to edit age.
- Use Region → Province → City/Municipality → Barangay cascading selectors backed by the bundled PSGC data, plus a complete manual fallback for address fields.
- Current registration does not require a map pin or coordinates. Do not add Geoapify, Mapbox, or another map dependency without an approved API contract.
- Evidence pickers must clearly show accepted JPEG/JPG/PNG/WebP formats and the strict under-10-MiB limit. Show selected filename, size, replace/remove controls, and a readable validation error.
- Apply the same evidence-picker and error states on Android and local Flutter web-server; a browser-selected file must remain available for multipart submission without requiring a disk path. Follow [`flutter-file-uploads.md`](flutter-file-uploads.md); do not claim browser upload success before server confirmation.
- Keep the submit action disabled only for locally known invalid/incomplete fields; the API remains the final validator.

### Approval and login

- After registration, show a clear pending-approval screen and explain that the selected Logistics organization must decide. Do not expose reviewer notes or promise an email that the backend does not send.
- Login requires email, password, and a device name. Never display role, ability, hub, or reviewer fields as editable inputs.
- Use explicit states for checking session, signed out, authenticated, pending, rejected, suspended/deactivated, invalid affiliation, and recoverable network failure.
- The current `/me` endpoint is protected and succeeds only for an approved active Courier. Do not use it as a pending-status endpoint; cross-device approval refresh requires a future backend contract.
- The current forgot-password API returns HTTP 200 with `{"message":"Courier password recovery is not available yet."}` for every valid email; it sends no reset instructions and does not complete a reset flow. Flutter has no forgot-password flow; integration of this newer Auth v2.6 behavior remains outstanding. Do not present a reset form until the backend endpoint and notification contract exist.

### Account management

- Show the authenticated Courier's private account projection and keep email, status, legal identity fields, affiliation, and sole hub read-only.
- Allow only the documented first name, middle name, last name, and contact number profile edits. Keep unsaved profile text local during recoverable failures and show field-level server validation.
- Allow profile-photo selection only when the server capability flag is true. Show the JPEG/JPG/PNG/WebP and strict under-10-MiB policy before opening the picker, keep the local preview separate from the saved private photo, and show upload progress, cancellation, retry, missing-photo fallback, and server rejection states.
- Fetch the saved profile photo through the authenticated private URL with the bearer token; never use a browser-style public URL, raw storage path, or unauthenticated network image widget. Confirm success only after the server response and private refresh succeed.
- Confirm photo removal and reconcile uncertain upload/removal responses with a fresh account/photo read. Do not queue photo writes offline or expose the original filename as storage identity.
- Registration and Account reuse the same Material **Discard unsaved changes?** dialog with **Keep editing** as the default focused action and **Discard** as the secondary choice. Only user-initiated exits that lose drafts require it; account-scope loss clears private state immediately.
- The implemented forms use labelled password visibility controls, logical keyboard actions, and scroll/focus to the first local/server invalid control in form order, including registration selectors/uploads. Widget checks cover large text and dialog semantics; installed-device/browser and assistive-technology acceptance remain separate.
- Use the same photo and independent OR/CR document controls on Android and local web-server. Browser selection, upload cancellation, CORS failure, and authenticated private preview need explicit feedback; keep Android's existing picker/upload behavior and verify both targets before marking web uploads supported.
- Require current password confirmation before a password change. Clear password fields after every attempt and explain that a successful change revokes all sessions and returns to sign-in.

### Pickup orders

- Show server-assigned Seller pickups and final-mile hub pickups in separate sections. First-mile acceptance is per task. Normal final-mile acceptance is atomic for a server-defined dispatch batch and is available through its dedicated list/detail flow. Reading a task or batch never accepts it.
- Seller pickups offer the labelled Material **Pickup schedule** selector and **Clear schedule filter** secondary action. Choices are only IDs/references discovered on the loaded unfiltered task page, never a complete schedule catalog or an assignment control. Keep the unfiltered view available, filtered empty/error states explicit, Hub pickups unaffected, and schedule labels/route buttons stacked at narrow widths or large text sizes.
- Show only authorized schedule, Seller/hub, pickup address, reference, and destination context. Present human-readable status labels while preserving lowercase server values in models. Do not expose Buyer contacts before the owning contract permits them. The final-mile projection may show **Parcel price** from `parcel.price`/`currency` when adopted; it is merchandise subtotal, never the COD cash amount.
- For first mile, require an explicit confirmation after the QR/manual identifier candidate is resolved to the matching task. A waybill QR payload is untrusted text; the current client supports camera, scanner keyboard/paste input, and a manual Order ID/reference fallback. Final-mile hub handoff has no identifier step.
- **Scan** opens the camera only when selected, works in the installed Android release APK and in the same Flutter app at `http://localhost:8765` through the fixed-port web-server run, and displays a visible manual-input control. Show permission denied, unavailable, busy, unsupported, and insecure-origin states with a manual alternative; release the stream when leaving the screen or switching tasks. Linux remains manual-input only.
- Decode QR payload as `qr` and the waybill Code 128 tracking ID as `tracking_id` for **first-mile** verification; do not route tracking IDs through the QR-only resolver. Suppress repeated-frame candidates and show the matched task before explicit Seller pickup. The implemented final-mile hub-handoff control uses the accepted task and revision without QR/reference input. Do not log decoded values.
- Use the documented idempotency key for physical first-mile confirmation and preserve the same key and identifier after an uncertain response. Final-mile hub evidence must remain visibly “Awaiting Logistics validation” until the server reports validated custody.
- Present the schedule route manifest as an ordered, accessible stop list. It is not a Buyer delivery route, and the client does not add map credentials, provider calls, or turn-by-turn navigation.

### Delivery work

- Show only server-returned final-mile tasks. Keep `delivery_assigned`/`delivery_accepted` visibly separate from hub custody; accepting an offer does not mean the parcel was picked up.
- After the server records `picked_up_from_hub`, show one explicit movement action at a time: `in_transit`, then `out_for_delivery`. Each action confirms the server-authorized transition and revision; it never writes an Order status locally.
- Show the authorized hub, destination, recipient contact, instructions, and server-provided advisory metrics. The backend now offers a schedule-scoped batch route, but the supplied Flutter snapshot does not verify its map UI. Missing route geometry or metrics remain visibly unavailable; do not fabricate distance, ETA, or coordinates.
- At `out_for_delivery`, the backend requires a private JPEG/PNG/WebP **photo POD** tied to the task. Show pending review after upload and Delivered intent; only Logistics validation may mark delivered. The implemented COD screen refetches `data.order.payment_method`, `payment_status`, `payable_total`, and `currency`, requires explicit acknowledgment of the displayed cash due, and rechecks it before sending `cod_collected: true`. Missing, unsupported, or changed payment data blocks the intent; Flutter never submits an amount or marks payment paid.
- On Android, **Open camera for POD** uses the rear camera for still capture, then shows preview, retake, file replacement, removal, and upload actions. Local web-server and unsupported targets use **Choose photo** without invoking the camera plugin. First-mile barcode capture stays separate. Physical-device/browser acceptance remains required.
- Completion is an explicit intent followed by a fresh completion read. Display delivered only when the server returns the committed `delivered` projection.

### Operational messaging (live exchange not yet verified)

- The implemented client offers **Message Logistics** on an eligible active offered/accepted task, **Message Seller** only while a first-mile task is accepted, and **Message Buyer** on an accepted nonterminal final-mile task. These remain secondary Material actions beside the task's operational next step. Existing threads require current server `send_allowed: true`; Buyer starts refresh the exact final-mile task. Seller and Customer web counterparts are implemented, but authenticated live exchange remains unverified; Laravel rechecks eligibility on every call.
- Keep the task reference, leg, and safe counterpart label visible in a private thread. Render messages as plain text, show unread/read-only states, and offer explicit retry without claiming an uncertain send succeeded.
- Poll only while the inbox/thread is foregrounded, clear private message state on logout or affiliation loss, and keep a failed draft and its UUID idempotency key for exact retry. Do not queue offline sends or treat chat text as a delivery/status action.

### Delivery history

- Present delivered final-mile records as read-only cards with order reference, delivered time, pickup/destination areas, item count, and safe proof/completion status.
- History detail may show immutable item snapshots, opaque proof references, and the adopted authenticated private photo viewer. Keep validated image bytes only in account-scoped memory and clear them when detail/session scope ends; exclude street addresses, contact phone numbers, raw storage paths, public media URLs, and mutation controls.
- Keep cursor pagination unavailable when the server does not provide a usable cursor; distinguish an empty successful list from unavailable, unauthorized, offline, and retryable states.

## Status, error, and network presentation

- Every API-backed screen has loading, empty, validation, unauthorized, forbidden, timeout/offline, retry, and success states appropriate to its operation.
- Use server error codes such as `INVALID_CREDENTIALS`, `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_INACTIVE`, and `LOGISTICS_ASSOCIATION_INVALID` as state inputs, not as permission decisions made locally.
- Explain what the Courier can do next. Do not expose another account's existence, private rejection reason, raw storage path, or sensitive server details.
- Retry safe reads with bounded backoff. Do not blindly replay multipart registration, token issuance, or future operational writes after an uncertain response.
- Preserve the last known authenticated UI during a transient network failure, but block protected mutations until the server confirms authorization.

## Privacy and mobile security

- Store Sanctum bearer tokens only in platform secure storage (Keychain/Keystore or the approved Flutter secure-storage implementation).
- Never put tokens, passwords, private evidence, full addresses, or raw API payloads in logs, analytics, crash reports, URLs, clipboard data, or ordinary preferences.
- Redact sensitive fields from debug tooling and disable verbose network logging in release builds.
- Keep notification previews and screenshots privacy-conscious. Sensitive delivery details require an explicit approved product decision.
- Use HTTPS in every non-local environment and retain normal platform certificate validation.

## Accessibility and quality

- Test with TalkBack/VoiceOver, large text, high-contrast settings, dark mode, reduced motion where available, and one-handed use.
- Announce validation results, loading completion, authentication changes, and retry outcomes to assistive technology without stealing focus unexpectedly.
- Keep focus order logical, labels associated with fields, and errors adjacent to the field or action they explain.
- Do not communicate state through animation, color, or icons alone; include readable text.

- Reported automated registration, account, batch-detail, POD/camera and support tests use the production themes at 320×640/390×844, 1×/2× text and light/dark. Scroll through complete screens and check Android/iOS touch targets, labels and text contrast; test keyboard actions, menus/dialogs, draft preservation, loading/recovery and pending review. These widget checks do not establish installed-device, browser or TalkBack/VoiceOver acceptance.
- Keep interactive card paragraphs and actions independently readable in the semantics tree; allow evidence actions and selector options to wrap, and keep confirmations, camera controls and recovery messages scrollable at large text sizes.

## Testing and implementation notes

- For every frontend change, review the affected screens against the familiar-patterns and focused-decisions rules. Record which existing component/interaction is reused, the current step's primary action, discoverability of secondary choices, and any unresolved deviations.
- Verify that Back/Cancel, selection, and focus behave consistently; large text and keyboard navigation retain required controls; loading/offline/error states preserve context; pending review never offers an unauthorized next mutation. Add or update relevant behavior/accessibility tests when UI code changes.
- Keep contract terminology in developer documentation. Courier-facing messages should explain the work and recovery action in plain language rather than expose DTO, aggregate, endpoint, or idempotency implementation details. Dashboard summaries now share one notice only for matching confirmed unavailable states; technical response errors in Dashboard, Delivery, Policy, Notifications, Task messages, Support tickets, and batch acceptance use workflow-specific recovery wording.
- Centralize API calls in a client/repository layer and map responses into immutable Dart models and explicit authentication states.
- Unit-test validation, multipart field names, PSGC cascading behavior, JSON parsing, status mapping, secure-storage failures, and theme semantics.
- Run integration/contract tests against the Laravel API for Logistics options, registration, login, `/me`, logout, role isolation, status denial, upload limits, and error codes. Mocks may support deterministic widget tests but cannot replace contract verification.
- Add golden or screenshot tests only for stable, approved screens; verify text scaling and light/dark variants before accepting them.
- Before marking physical scanning acceptance complete, exercise QR and Code 128 capture, permission denial, manual fallback, task mismatch, duplicate-frame suppression, and camera cleanup in an installed Android release APK and the local fixed-port browser run.
- Keep this guide and the copied Courier feature specs synchronized with the backend API version. Changes to deferred delivery UI require the matching API/schema decision first.

**Related documents:** `../AGENTS.md`, `docs/features/courier/auth/spec.md`, `docs/domain/Courier.md`, `docs/domain/Logistics.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/references/user-registration-requirements.md`, and `docs/references/file-upload-requirements.md`.
