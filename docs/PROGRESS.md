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

## 2026-10-31 — Stitch landing implementation

- Applied the refined Stitch desktop composition to the Astro landing page, retaining exported spacing, colors, section grids, feature cards, downloads panel, FAQ, portal grid and footer. Replaced generated claims with canonical system copy and authentic app previews; retained destinations, metadata and native image dialogs. No dependencies or Flutter changes.
- Preview and production builds passed; Chromium checked 320/390/768/1024/1440px without horizontal overflow, five FAQ disclosures, and preview dialog opening. Desktop/mobile captures and verification data saved with Stitch context. Local outline icons replace the external Material Symbols font; no pixel-identical certification claimed.

## 2026-10-31 — Landing conversion and accessibility refinement

- Clarified the Astro hero with a concrete shopping headline, one primary action and supporting sentence; repeated shopping CTAs and simplified role copy. Preserved portal/release destinations, authentic previews, early access and approval qualifications. Added phone navigation, 44px targets, consistent headings/focus, readable copy, color variables, responsive WebP variants, font preload and social image metadata. No dependencies or other app changes.
- Preview/production builds passed. Chromium at 360/768/1280/1440px passed overflow, image, CTA visibility, target sizing, headings, destinations, keyboard dialog/FAQ and reduced-motion checks. Taste retains documented design-contract/style exceptions; Lighthouse, assistive-technology and deployed acceptance remain open. See `src/landing-page/docs/quality-review.md`.

## 2026-10-31 — Stitch desktop design refresh references

- Created accessible private Stitch project AISLEY Landing Page (`15557909308404563880`) after historical project lookup failed; generated desktop screen `973c10bb2c70499faee3616805ef3553`. Saved MCP-downloaded screenshot/HTML, metadata, exact prompt, response and review in `src/landing-page/docs/stitch/2026-10-31-refresh/`. Flagged invented panel data, copy drift, small labels and pending mobile/dialog work. Existing frontend and pre-existing deleted context files unchanged; design reference only.

## 2026-10-31 — Exact Stitch landing reference adoption

- Replaced the Astro landing composition with MCP screen `973c10bb2c70499faee3616805ef3553`: exported desktop header, split sections, badges, workflow/release/workspace cards, first-open FAQ and footer. Filled marked screenshot slots with authentic local assets, preserved native enlargement and exact destinations/SEO, and added reproducible local utility compilation. Updated the matching spec; unrelated pre-existing deletions and Flutter remain untouched.
- Preview/production builds and SEO/link checks passed. Chromium at 320/390/768/1024/1280/1440px passed overflow, loaded screenshots, visible navigation/shopping action, FAQ defaults, preview Escape/focus restoration, keyboard FAQ and reduced motion. Saved fresh captures/verification beside the reference. Taste style conflicts are documented as explicit reference choices; no pixel-identical, Lighthouse or deployed acceptance claim.
