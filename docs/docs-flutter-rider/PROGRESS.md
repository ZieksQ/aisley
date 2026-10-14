# Courier Flutter Progress

Short, dated implementation log. Append entries; archive complete logs after 150 physical lines. Preserve historical reports and distinguish local verification from deployed/device acceptance.

## Current status

- Auth v2.6 handling, account/vehicle/policy, inbox and targeted notifications, first-mile pickup/filtering, batch acceptance/hub handoff, photo POD/COD intent, failed attempts, exact-reference history, dashboard v2 with default-v1 fallback, read-only MapLibre routes and private chat images/received MP4/documents are implemented locally. Recovery UI and linehaul screens remain unadopted.
- Historical adoption slices: Auth 4c3f504; earlier operations d7df220; maps 51d9694; failed attempts 4d8bfef; media 28fc740. Inspected source: Laravel `240eefddd4e2e2eea2f9558beec0292efa2121fe`, Courier `177eac1d1d132916cef25054cfc959e223fa409c`. Inspection does not promote every contract to client adoption; deployed revision remains unidentified.
- Live authenticated/deployed API, private-media runtime and installed Android/accessibility acceptance remain open. Media video/document upload remains outside the current mobile release.
- Historical application test/build/browser results are in the archives and verification reports. This sync runs documentation validation only.

## Historical progress

- [Platform history](logs/PROGRESS-2026-10-12.md): original dated results with their own execution scope.
- [Client history](logs/PROGRESS-2026-10-12-2.md): original dated results with their own execution scope.

## 2026-10-12 — Three-project documentation synchronization

- Reconciled server contracts with current Flutter sources, imported newer client evidence, corrected status summaries and retained explicit adoption/release gaps. Archived the two complete role histories separately with attribution; existing archives remain unchanged.
- Validated portable links/anchors, JSON/examples, endpoint inventory, spec bounds, synchronized copies, preserved archive prefixes and PSGC bytes, plus Git whitespace. See [audit and validation](references/synchronization-2026-10-12.md). No application tests/builds or live/device checks were rerun.

## 2026-10-14 — Email-verified account password changes

- Added password-code requests and the account email-verification dialog before Courier password changes. Typed API fields, resend/expiry and Retry-After, account cleanup, uncertain outcomes, unsaved-profile warnings and the existing all-device sign-out are preserved. Adopted the new password-code API contract and updated only affected documentation.
- Verification: 44 account/widget tests, Flutter analyzer, web build and Android release APK pass, including existing 320/390px light/dark and 1×/2× accessibility checks. Live SMTP/deployed API and installed-device acceptance remain open.

## 2026-10-14 — Email-first registration OTP

- Adopted registration-email contract v1 (2026-10-14): public code/verify APIs, six-digit OTP, required role/email-bound proof, resend/expiry/Retry-After, memory-only secrets, retained registration drafts and existing approval gates. Existing accounts keep their login behavior. Updated typed API models/repositories and native registration UI; no new dependencies.
- Verification: 190 auth checks, 7 app checks and targeted registration-success cleanup, Flutter analyzer, web build and Android release APK pass. Laravel registration/mail enforcement and isolated PostgreSQL concurrency checks pass independently; live SMTP/deployed API and installed-device acceptance remain open. API enforcement requires coordinated client release and the new backend migration/workers.
