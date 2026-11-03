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

## 2026-11-01 — Logistics transport and delivery redesign

- Renamed Linehaul to Network with a network sidebar icon, connected-only main list, searchable/paginated Request modal, incoming approvals, and legacy-route redirect. Redesigned Linehaul dispatch, Linehaul inbound, and Last-mile dispatch with blue/slate portal controls, assignment modals, task tabs, operational tables, and responsive scheduling panels.
- Pending and History confirmations now use tables linking to dedicated proof detail pages; preserve list filters on Back, resolve exact proofs across pagination/history, avoid loading photos in lists, and retain COD gates, private-photo handling, revision checks, and uncertain-decision retry identity. Updated canonical web specs; API and external Flutter contracts unchanged.
- Verification: Logistics production build, Oxlint, and diff whitespace checks passed. Synthetic Chromium checks passed 48 route/viewport/theme combinations at 390/768/1440px without page overflow, plus requests/withdrawal/acceptance, modal keyboard behavior, truck capacity and both scheduling flows, inbound rejection, confirmation row navigation, COD approval, idempotent retry, unknown-proof safety, and error/empty recovery. Reviewed mobile and desktop light/dark captures. Live API/deployed and assistive-technology acceptance remain open; existing bundle-size warning remains.

## 2026-11-02 — Seller feedback, inventory and voucher redesign

- Aligned Product Q&A/review queues and detail screens with Seller portal surfaces, filters, tables, state badges, pagination, skeletons and response controls. Preserved role/Shop ownership, plain-text validation and immutable answer/response workflows; guarded superseded Q&A reads.
- Inventory now shows the approved default/first Product gallery thumbnail beside Product/variant/SKU details and emphasizes authoritative available stock. Reused a new `@aisley/ui/portal` thumbnail with Products, retaining missing/failed-image fallback. Added an eager-loaded, safe nullable image projection to Seller inventory and documented its contract. Voucher list now follows portal table styling with status badges and View actions; Admin presentation and lifecycle controls retain their existing behavior.
- Verification: Seller TypeScript/production build, Oxlint, scoped Pint and diff checks passed; inventory API tests passed (5 tests, 44 assertions). Synthetic Chromium passed Q&A/review filters, empty/error/loading recovery and publishing; inventory stock/filter/pagination/retry workflows; voucher authoring/navigation/conflict flows; and Products regressions. Reviewed light/dark captures at 320/390/768/1440px with contained table scrolling. Existing bundle-size warning remains; live API/deployed and assistive-technology acceptance remain open. Other-session Logistics edits remain separate.

## 2026-11-02 — Logistics pricing, application and fleet redesign

- Redesigned Shipping rates, Courier applications, Vehicles and Company fleet with Logistics blue/slate controls, shared portal tables, search, pagination, status labels and loading/error/empty states. Added protected, read-only rate-card version pages with exact-ID deep links, service fees, category rules, legacy history, future-effective labels and Back navigation.
- Replaced fleet browser prompts with validated register/edit dialogs, preserved optimistic revisions and driver capability controls, and added explicit confirmations, safe draft retention and focus restoration. Rate-card publication, tariff acceptance and draft/rule discard use accessible confirmations; calendar and viewport-bounded keyboard help follow Logistics styling. Application/vehicle detail links preserve list filters. API and external Flutter contracts unchanged.
- Verification: TypeScript/production build, Oxlint and diff checks passed. Synthetic Chromium passed 60 route/viewport/theme combinations at 320/768/1440px, deep links, keyboard tabs, calendar/help and narrow dialogs, filter return links, truck create/edit validation and revisions, failed-refresh draft retention, save/close focus, driver capability and error/empty recovery. Reviewed mobile/desktop light/dark captures. Live API/deployed/private-evidence and assistive-technology acceptance remain open; existing bundle-size warning remains.

## 2026-10-31 — Support ticket conversation redesign

- Updated Customer, Seller, Logistics and Admin ticket interfaces with compact responsive inboxes, grouped metadata, chat-style reply bubbles, Manila date/time labels, distinct lifecycle events and visible composers. Added shared ticket history/viewport primitives in `@aisley/ui/chat`, on-demand requester creation, role colors/themes, draft guards and older-history/new-activity scroll behavior. Reused the existing Logistics ticket data hook through the support package; kept APIs, role permissions, ticket lifecycle and Flutter contracts unchanged.
- Verification: Seller/Admin/Logistics production builds, storefront TypeScript, scoped ESLint/Oxlint, Admin URL-filter regression and diff checks passed. Controlled Chromium component checks passed at 320/390/768/1440/1800px for all four role variants and supported themes, including overflow, composer visibility, plain-text safety, cancelled draft switching, exact uncertain retries, older-history anchoring, new-activity navigation and Admin view-only state; screenshots reviewed. The broader Logistics suite stops in its unrelated Settings fixture because notification summary data is missing. Authenticated role-shell navigation, live Admin mutations/API integration and device acceptance remain open. See `packages/support-tickets/tests/README.md`.

## 2026-10-31 — Support ticket rate-limit isolation

- Replaced shared numeric ticket throttles with named per-role/account creation (10/minute) and reply (30/minute) counters for Customer, Seller, Logistics, Courier and Admin replies. Browsing/polling and unrelated requests no longer consume ticket mutation allowances; existing overall API limits, authorization, idempotency and client contracts remain intact.
- Verification: reproduced the first-submission HTTP 429 after ordinary browsing before the fix. Isolated SQLite support, notification and Customer chat suites passed (38 tests, 1,888 assertions), including all-role quota boundaries, polling/read isolation, separate creation/reply budgets, per-account isolation, account limits across IP changes, cooldown recovery and overall Customer throttling. Scoped Pint and diff whitespace checks passed. Deployed acceptance remains open.

## 2026-11-02 — Support branch rebase resolution

- Resolved the progress-log conflict by preserving both upstream and support-ticket entries, then completed both commits onto `92e3093c`. No application code required conflict edits. Verified the rebased diff has no whitespace errors or remaining conflict markers.

## 2026-11-03 — Courier vehicle details during Logistics assignment

- Added safe, eager-loaded personal vehicle type/plate summaries to the scoped pickup and dispatch Courier APIs, with null for missing or ambiguous records. Pickup creation/rescheduling and last-mile dispatch/re-offer pickers show vehicle details in options and selected summaries and search by type/plate. Preserved contact/availability, approval and tenant boundaries, assignment limits and separate company-truck linehaul selection; updated canonical specs.
- Verification: isolated SQLite API suites passed (42 tests, 1,057 assertions); Logistics TypeScript/production build, Oxlint, scoped Pint and diff whitespace checks passed. Synthetic Chromium passed 18 picker scenarios across 320/768/1440px and light/dark themes, covering four vehicle types, missing data, searches, keyboard selection and selected summaries, plus six re-offer checks; narrow/desktop screenshots reviewed. The broader transport smoke repeatedly timed out on Delivery confirmations during its viewport sweep. Existing bundle-size warning and live/deployed/assistive-technology acceptance remain open.

## 2026-11-03 — Seller Approval sorting options

- Expanded Approval sorting to oldest/newest placement, recent activity, and highest/lowest total, retaining oldest-first defaults, URL state and pagination reset. Accepted `newest` in the scoped Seller orders API using its existing descending placement/ID ordering; Monitoring and Pickup remain unchanged. Updated the approval specification.
- Verification: isolated SQLite approval API suite passed (9 tests, 157 assertions), including all five sorts, stable placement ties, pagination, invalid input and Shop/status isolation. Seller TypeScript/production build, Oxlint, scoped Pint and diff checks passed; existing bundle-size warning remains. Synthetic Chromium passed Approval Apply/Cancel, requests, history/reload/fallback, keyboard/focus and six dialog viewport/theme combinations, with mobile light and desktop dark captures reviewed. The broader Orders rerun passed all interactions and 48 responsive/theme checks after an initial picking-sheet assertion failure, then exited on an existing browser-profile cleanup `ENOTEMPTY` error. Live/deployed acceptance remains open.

## 2026-11-03 — Unified role chat inboxes

- Combined Customer, Seller and Logistics chats into one Messages workspace per app, with mixed activity ordering, counterpart role labels, All/role filters, unread/read-only summaries, canonical thread links and legacy redirects. Preserved Shop/Order/pickup/task identities, initiation, private media, drafts, exact retries and mobile Back/scroll restoration; support tickets and Admin remain separate. Added scoped, read-only inbox APIs using existing participant/tenant services; no migration, dependency or Flutter contract change.
- Verification: isolated SQLite chat/notification/operational suites passed (32 tests, 577 assertions); three-app TypeScript and production builds, scoped ESLint/Oxlint/Pint and diff checks passed. Synthetic Chromium passed 93 unified-inbox checks and the existing 56 layout/theme regressions plus first-send/retry checks. Reviewed final viewport/theme captures; Taste authenticated DOM captures had 0 failures with documented contract/pre-existing-shell exceptions and two warnings per role. Existing dashboard bundle warnings and live/deployed/device/assistive-technology acceptance remain open. See `docs/references/unified-chat-inbox-verification.md`.
