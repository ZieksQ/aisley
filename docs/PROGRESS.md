# Progress

## 2026-10-31 — Stitch landing design context

- Reused AISLEY Landing Page project and generated an Astro desktop reference refinement; saved project/screen IDs, screenshot URLs, project thumbnail, exact prompt, response and contract review in src/landing-page/docs/stitch. Flagged unsupported generated copy for correction; full-resolution screenshot downloads require authentication (HTTP 401). Frontend and Flutter unchanged.

Short, dated log of what has been implemented across the whole app. Append new entries and preserve archives.

## 2026-10-30 — Progress archive

- Archived the complete log, including details-first registration and its verification, at [PROGRESS-2026-10-30.md](logs/PROGRESS-2026-10-30.md). Web and Flutter clients collect details before OTP, retain in-memory drafts, and require explicit submission. Live/device acceptance remains open.

## 2026-10-30 — Admin registration OTP toggle

- Added audited `registration_email_verification_required` under Admin → Feature controls (enabled by default), public registration configuration for all four roles, and a registration-only transactional bypass that leaves email unverified and preserves approval/evidence rules. Shared web registration skips OTP when disabled and retains drafts/files through failed settings reads or re-enabled verification; password/account email verification stays strict. Updated canonical, role, and portable Flutter contracts; external Flutter adoption and live/device acceptance remain open.
- Verification: focused API role/mail/settings/feature-control regressions passed (78 tests, 761 assertions); all three actual web forms passed mocked Chromium OTP/bypass, settings-retry, draft/evidence, re-enabled OTP, cancellation, stale-response, and submission lifecycle checks. Seller/Logistics production builds, storefront TypeScript/scoped ESLint, shared/role Oxlint and scoped Pint passed. Storefront production build remains blocked by unavailable Google Fonts network fetch (Geist/Geist Mono); no live SMTP, deployed migration or device acceptance claimed.

## 2026-10-31 — AISLEY marketing landing page

- Added the static Astro landing page at `src/landing-page`, informed by the AISLEY Landing Page Stitch design, with buyer/seller/logistics sections, all five portal/release destinations, native FAQ, local branding/font, and redacted live-app screenshots. Added root `dev:landing` and LANDING to concurrent `pnpm dev`.
- Added canonical/social metadata, Organization/WebSite JSON-LD, sitemap, branded PNG preview, noindex 404, and opt-in production indexing via `build:production`. Preview builds default to noindex.
- Verification: preview/production static builds passed; generated metadata, exact links, JSON-LD, sitemap and 404 assertions passed. Chromium showed no horizontal overflow at 320/390/768/1024/1440px; all images loaded. Lighthouse, full keyboard/zoom acceptance and deployed-domain checks remain open.

## 2026-10-31 — Landing page density and preview UX

- Tightened hero and role sections, moved feature lists alongside role descriptions, alternated Seller media, consolidated downloads/footer, and added accessible native screenshot dialogs with direct-image fallbacks. Retained exact portal/release links, early-access copy, branding and SEO.
- Production build and generated SEO/link assertions passed. Chromium measured no overflow at 320/390/768/1024/1440px; desktop height fell from 5666px to about 4020px. Escape/focus restoration passed; all final viewport screenshot sheets reviewed. Taste flags for contract-permitted boundaries and restrained typography/motion remain documented in the feature spec; Lighthouse/deployed acceptance remains open.

## 2026-10-31 — Landing page left-to-right composition

- Refined the marketing page with left branding/right shopping action at all widths, desktop navigation between them, wider uncropped screenshots, primary/secondary hero actions, alternating role sections, side-by-side app introduction/downloads, and grouped brand/links in the footer. Preserved existing content, destinations, preview dialogs and SEO; consolidated the affected CSS cascade.
- Verification: preview and production Astro builds, generated production SEO/JSON-LD/sitemap/noindex-404 assertions, and diff whitespace checks passed. Chromium passed 320/390/640/768/1024/1440px overflow, image, heading and alignment/destination checks, plus preview Escape/focus restoration, FAQ and reduced-motion checks. Desktop/tablet/mobile screenshots reviewed; Taste style exceptions remain documented in the feature spec. Lighthouse and deployed-domain acceptance remain open.
