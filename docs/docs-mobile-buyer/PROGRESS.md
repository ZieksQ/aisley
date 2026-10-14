# Buyer Flutter Progress

Short, dated implementation log. Append entries; archive complete logs after 150 physical lines. Preserve historical reports and distinguish local verification from deployed/device acceptance.

## Current status

- Buyer Phases 1–4/Phase 5 tooling, MapLibre/PSGC addresses, per-Shop shipping, voucher collection/wallet, Order/Checkout thumbnails and private chat images/received MP4/documents are implemented locally. Voucher names/pairing, Order coordinates and Shop-context adoption have explicit remaining gaps.
- Historical adoption slices: General 57e9eb2; shipping 22b0a48; collection 7e89b391; Order/Checkout images 5d55ecf; media 28fc740. Inspected source: Laravel `240eefddd4e2e2eea2f9558beec0292efa2121fe`, Buyer `7924cf06158817a2dcd709ec19a7442e3496dda5`. Inspection does not promote every contract to client adoption; deployed revision remains unidentified.
- Live authenticated/deployed API, private-media runtime and installed Android/accessibility acceptance remain open. Buyer provider configuration and signing gates remain open.
- Historical application test/build/browser results are in the archives and verification reports. This sync runs documentation validation only.

## Historical progress

- [Platform history](logs/PROGRESS-2026-10-12.md): original dated results with their own execution scope.
- [Client history](logs/PROGRESS-2026-10-12-2.md): original dated results with their own execution scope.

## 2026-10-12 — Three-project documentation synchronization

- Reconciled server contracts with current Flutter sources, imported newer client evidence, corrected status summaries and retained explicit adoption/release gaps. Archived the two complete role histories separately with attribution; existing archives remain unchanged.
- Validated portable links/anchors, JSON/examples, endpoint inventory, spec bounds, synchronized copies, preserved archive prefixes and PSGC bytes, plus Git whitespace. See [audit and validation](references/synchronization-2026-10-12.md). No application tests/builds or live/device checks were rerun.

## 2026-10-14 — Backend complete-route checkout contract

- Updated affected shipping/checkout contracts, error descriptions, field notes and synthetic examples: discovery omits incomplete routes, explicit quote rejects with `SHIPPING_COVERAGE_UNAVAILABLE`, and lost coverage at placement returns `QUOTE_STALE` before effects. Historical unplanned Orders and committed same-key replay retain their behavior.
- The web storefront now defaults providers, uses a separate draft/Apply selection page and confirms before placement. These changes do not establish Flutter adoption; existing client/device/live acceptance remains open. Affected portable links and JSON validate; Laravel/web evidence is recorded in the canonical app progress log.

## 2026-10-14 — Email-verified account password changes

- Added current/new passwords → emailed verification code → confirmed password change in Buyer account settings. Typed code requests/confirmation preserve the current bearer, expiry/resend limits, cancellation, account-switch cleanup and uncertain-result sign-in reconciliation. Adopted the new password-code API contract and updated only affected documentation.
- Verification: 27 focused contract/controller/widget tests, Flutter analyzer, web build and Android release APK pass; portable bundle validation passes (988 links, 22 specs, 19 PSGC registrations). Live SMTP/deployed API and installed-device acceptance remain open.

## 2026-10-14 — Email-first registration OTP

- Adopted registration-email contract v1 (2026-10-14): public code/verify APIs, six-digit OTP, required role/email-bound proof, resend/expiry/Retry-After, memory-only secrets, retained registration drafts and existing approval gates. Existing accounts keep their login behavior. Updated typed API models/repositories and native registration UI; no new dependencies.
- Verification: 77 networking/session/OTP/responsive checks and the additional registration-screen draft test, Flutter analyzer, web build and Android release APK pass. Laravel registration/mail enforcement and isolated PostgreSQL concurrency checks pass independently; live SMTP/deployed API and installed-device acceptance remain open. API enforcement requires coordinated client release and the new backend migration/workers.
