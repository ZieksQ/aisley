# Progress

Short, dated log of what has been implemented across the whole app. Append new entries and preserve archives.

## 2026-10-30 — Progress archive

- Archived the complete log, including details-first registration and its verification, at [PROGRESS-2026-10-30.md](logs/PROGRESS-2026-10-30.md). Web and Flutter clients collect details before OTP, retain in-memory drafts, and require explicit submission. Live/device acceptance remains open.

## 2026-10-30 — Admin registration OTP toggle

- Added audited `registration_email_verification_required` under Admin → Feature controls (enabled by default), public registration configuration for all four roles, and a registration-only transactional bypass that leaves email unverified and preserves approval/evidence rules. Shared web registration skips OTP when disabled and retains drafts/files through failed settings reads or re-enabled verification; password/account email verification stays strict. Updated canonical, role, and portable Flutter contracts; external Flutter adoption and live/device acceptance remain open.
- Verification: focused API role/mail/settings/feature-control regressions passed (78 tests, 761 assertions); all three actual web forms passed mocked Chromium OTP/bypass, settings-retry, draft/evidence, re-enabled OTP, cancellation, stale-response, and submission lifecycle checks. Seller/Logistics production builds, storefront TypeScript/scoped ESLint, shared/role Oxlint and scoped Pint passed. Storefront production build remains blocked by unavailable Google Fonts network fetch (Geist/Geist Mono); no live SMTP, deployed migration or device acceptance claimed.
