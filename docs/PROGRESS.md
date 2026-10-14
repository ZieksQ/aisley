# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:

`

## YYYY-MM-DD

- Feature/change short summary
  `

---

## 2026-10-12

- Archived the complete 151-line progress log at [PROGRESS-2026-10-12.md](logs/PROGRESS-2026-10-12.md) after B08 verification. Both mobile apps already enforce the inclusive 8,000,000-byte limit and permanent 422 replacement recovery; fresh isolated Courier 78, Buyer 36 and Laravel 11 tests/276 assertions passed. See [B08 evidence](features/shared/chat-media/verification.md#b08-verification--2026-10-12); deployed/device acceptance remains open. Continue app-wide entries here.


## 2026-10-12 — Three-project documentation synchronization

- Audited Laravel/web and both Flutter sources; reconciled canonical/portable/client contracts, implementation status, API/DTO/examples, READMEs and source provenance. Preserved separate complete role histories and original archives/reports; corrected stale Cart/Admin/Seller summaries and retained explicit Buyer adoption gaps. See [audit](references/synchronization-2026-10-12.md).
- Documentation validation passes for 111 Buyer operations, 34 bounded mobile specs, portable links/JSON/examples, preserved history and PSGC, paired copies and whitespace; existing Buyer bundle validator passes. Its pre-existing negative-test forwarding-path mismatch is recorded separately. No application tests/builds, live API/provider/device or deployment checks reran.

## 2026-10-14 — Buyer checkout delivery review

- Checkout now excludes incomplete operational/commercial routes and rejects explicit fallback selections; route loss at placement returns `QUOTE_STALE` before atomic Order/stock/voucher/Cart effects. Committed exact-key replay remains valid after coverage loss.
- Added `/checkout/delivery` with lowest-fee defaults per Shop, accepted-choice retention, draft Apply/Cancel and late-response cancellation. Checkout/Vouchers/Delivery share Customer state and consent review. Added a native final confirmation dialog with delivery contact/address, provider/fees, per-Shop totals and total COD; preserved exact-request uncertain recovery.
- Updated checkout/shipping/design specs and the affected portable Buyer API contracts/examples; Flutter implementation and device/deployed acceptance remain unchanged.
- Verification: checkout API 16 tests/151 assertions; adjacent address/image/order/quotation checks 78 passing tests; voucher suites 4 tests/72 assertions and 16 tests/303 assertions pass after avoiding duplicate route fixtures. Storefront checkout regressions, current TypeScript and scoped ESLint pass. Chromium checks 320/390/768/1440px and short dialogs, selection/defaults/cancellation, confirmation/Escape/focus, failed reads, unavailable delivery, account cleanup and exact-key retry pass; synthetic screenshots are under `.next/checkout-voucher-browser/`. No live checkout or PostgreSQL concurrency rerun.
- Full storefront lint retains two existing `no-assign-module-variable` errors in `tests/customer-vouchers.test.mjs`. Default build hit font-fetch/Turbopack socket restrictions; Webpack compilation succeeded, but the full build was terminated during TypeScript (exit 143). Separate current `tsc --noEmit` passes.

## 2026-10-14 — Taste skill workspace

- Created the isolated `.worktrees/taste-skill` workspace on `feature/install-taste-skill` from the active branch. Installed the default `design-taste-frontend` skill from `Leonxlnx/taste-skill` for Codex using `pnpm dlx skills add Leonxlnx/taste-skill --skill design-taste-frontend --agent codex --yes`; tracked its complete `.agents/skills` bundle and `skills-lock.json` source/hash. Verified skill metadata, bundled JSON, and JavaScript syntax; no application code changed.

## 2026-10-14 — Unified web design guidance and Codex skills

- Replaced `docs/design.md` with the supplied NovaSpark system adapted to AISLEY's colors, identity, declared stack, themes, and reusable `packages/ui` structure. Removed duplicate instruction-file styling and conflicting feature visual exceptions; preserved folder/modularity rules, role workflows, API contracts, historical records, and separate Flutter guidance. The revised guide takes priority over design skills.
- Installed `gpt-taste` and `redesign-existing-projects` for Codex using `pnpm dlx skills add` in the isolated workspace on `feature/novaspark-design-guidance`, retaining the original Taste skill and tracking source hashes. Documentation links/source coverage, preserved structural rules, color contrasts, skill metadata/JSON, and bundled JavaScript syntax checked; application UI, builds, and browser checks were not run for these documentation/skill changes.

## 2026-10-14 — Design workspace merge

- Merged the unified NovaSpark-based AISLEY web design guide and all three Codex design skills into the original workspace's active checkout branch. Preserved both progress histories and the committed delivery-review implementation; the new design guide remains authoritative. Checked documentation links, skill metadata/JSON/JavaScript, conflict resolution, and unchanged checkout/API/Flutter files; no application tests or browser checks reran for this documentation/skill merge.

## 2026-10-14 — Role-specific gpt-taste design contract

- Revised `docs/design.md` using gpt-taste: general purple Customer storefront, matching purple Admin/Seller dashboard portals, and a blue/slate Logistics portal. Replaced Inter with Geist; retained compatible component, accessibility, responsive, theme, interaction, and shared-ownership rules. Scoped cinematic AIDA, deterministic campaign choices, bento density, assets, and advanced motion to promotional content while keeping commerce and portal tasks practical; GSAP dependency adoption still requires approval.
- Verified local documentation links, retained contracts, whitespace, and 12 new brand foreground/background pairs (all exceed 4.5:1). Documentation only; no application UI, dependencies, feature/API contracts, or Flutter files changed, and no browser/build checks ran.

## 2026-10-14 — Unified dashboard portals

- Redesigned Admin, Seller and Logistics around `@aisley/ui/portal`: shared Geist typography, role-aware purple/blue light/dark tokens, a 240px sidebar, persistent optional 64px icon rail, sidebar open/close icons, direct grouped links, rail focus/hover tooltips, and a focus-managed mobile drawer. Removed sidebar/account dropdowns while preserving permissions, detail-route matching, Settings destinations, notifications and logout ownership.
- Added configurable Recharts presentation under `@aisley/ui/charts` using the existing project dependency: series colors/types, layout, styling, formatting, grid/legend options, accessible data tables and truthful zero/loading/error states. Dashboard graphs use existing permitted registration, catalog and hub-scoped shipment counts; no new API or invented analytics. Updated owning navigation specs and shared UI documentation.
- Copied both storefront logos unchanged to `packages/ui/public` and exported bundler-safe URLs; bundled the existing Geist font with its license. Fixed mobile drawer focus, 320px scrollbar overflow, narrow toolbar spacing, wordmark contrast and Seller dark captions. Kept API, Courier and Flutter contracts unchanged.
- Verification: all three app typechecks, linters and production builds pass; shared-source lint, script syntax and whitespace pass; Seller action regressions pass (8 tests). Real Chromium with synthetic HTTP verifies 320/390/768/1440px light/dark layouts, expanded/rail/drawer navigation, persistence, focus/Escape, reduced motion, chart data, zero/error/stale states, Admin permission filtering, read-only dashboard requests and Logistics System theme. Screenshots: `node_modules/.cache/portal-browser`. Existing smoke selectors were updated; their broader suites, live API and deployed acceptance were not rerun. Builds retain large-chunk warnings; the supplied raster-backed logo remains 1.77MB.

## 2026-10-14 — Dashboard activity and nonblocking navigation

- Removed whole-screen session/consent checking interstitials across Customer, Admin, Seller and Logistics. Portal session guards now wrap the persistent shell; consent guards gate workspace content inside it. Reuse only account/session-bound in-memory results across ordinary navigation, recheck after consent/account changes, retain required-consent redirects and API enforcement, and preserve the Logistics offline receiving boundary.
- Redesigned all three dashboards with metric strips, role-specific workload/activity charts, linked work queues and shared layout-matched skeletons. Admin adds oldest-application age and authorized queue comparison; Seller adds real 14-day UTC order placement/current-status aggregates and review response coverage; Logistics adds shipment pipeline and pending evidence/completion workload. Removed the Seller deferred-feature list; retained truthful unavailable/empty/error/stale states and existing action ownership.
- Extended the existing private Seller dashboard response with Shop-scoped read-only `order_activity`; no new library, migration, metric store, financial claims or mobile contract changes. Added identity-keyed snapshots and obsolete-read cancellation. Charts suppress pointer outlines while preserving keyboard focus and accessible data tables; skeleton pulses honor reduced motion.
- Verification: Seller dashboard API 8 tests/123 assertions and Admin/shared consent 16 tests/241 assertions pass; Customer session 11 and Seller action 8 regressions pass. Portal production builds, app/shared-source lint, Customer TypeScript and changed-file ESLint pass. Customer checkout/consent Chromium regression passes using its existing cached stylesheet. Portal Chromium verifies 320/390/768/1440px light/dark layouts, persistent shells, consent-bound skeletons, pointer/keyboard chart focus, stale/empty/error states and read-only requests; a separate final-checks run passes permission filtering, consent denial and Logistics System theme. These checks use synthetic HTTP; browser artifacts live under `node_modules/.cache/portal-browser`. No live API/PostgreSQL/deployed verification. Existing large-chunk warnings remain. The attempted storefront Webpack build was terminated (exit 143) before completing; storefront production-build acceptance remains open.

## 2026-10-14 — Vercel SPA route fallbacks

- Added Vercel deep-link rewrites to the Seller, Admin, and Logistics Vite/React Router projects so direct route requests can load the SPA entry point after mobile browser tab restoration. The Customer Next.js app keeps its framework routing and does not use the SPA fallback.

## 2026-10-14 — Dashboard visual composition and graph colors

- Rebuilt Admin, Seller and Logistics dashboard content using independent icon-led metric cards, prominent values, contextual cohort shares, larger primary charts, labeled multicolor distribution charts, and redesigned work lists/catalog health. Added shared `DashboardMetricCard` and `DistributionChart`; updated skeletons to the separate-card layout. Used Linear dashboard documentation and commerce/Logistics design references while retaining AISLEY role palettes, Geist and the existing stack/data sources.
- Removed visible chart-data disclosures while preserving screen-reader tables and numerical legends. Added six theme-aware graph colors with stable Logistics stage colors; clarified graph palette and pointer/keyboard focus rules in `docs/design.md`. Suppressed unnecessary pointer-click rings on portal controls/charts, retained keyboard/editing focus, and fixed narrow-screen tooltip overflow with empty inactive content and bounded placement.
- Verification: all three portal production bundles, TypeScript checks and app/shared-source linters pass; Chromium with synthetic HTTP passes 320/390/768/1440px light/dark layouts, separate cards, graph colors, pointer/keyboard focus, removed disclosures, no overflow, zero/error/stale states, permission filtering, consent denial and Logistics System theme. Screenshots: `node_modules/.cache/portal-browser`. No API/schema/dependency/Flutter changes; no live API or deployed acceptance rerun. Existing large-chunk warnings remain.

## 2026-10-14 — Transactional SMTP email

- Completed asynchronous Customer/Seller/Logistics password-reset and Admin registration-decision email; added Logistics-owned Courier approval/rejection mail. Reused the eight existing mail settings, bounded SMTP timeout, and corrected blank legacy URL handling. No environment files were read or changed.
- Added an additive string-enum transactional-email outbox migration, encrypted content/jobs, atomic source/intent persistence, post-commit database dispatch, safe failure metadata, bounded retries, expiring delivery claims, minute recovery, and operator status/retry commands. Reset creation/completion share User-before-token locking; obsolete links and changed identities are skipped. Mail failure preserves committed decisions and generic acknowledgements.
- Updated owning specs, architecture, SMTP operations, and affected Courier portable approval guidance; existing API/DTOs, mobile recovery boundaries and Flutter implementation/device status remain unchanged.
- Verification: 167 focused mail/auth/registration/approval tests and 1,623 assertions pass using synthetic SMTP configuration, actual encrypted database jobs with array transport, in-memory SQLite, and disposable storage. Scoped Pint, 32 PHP syntax checks, added documentation links and whitespace pass. No live SMTP, production migration, deployed worker/scheduler, PostgreSQL process concurrency, frontend build or Flutter checks ran; SMTP acceptance is not inbox delivery and ambiguous sends may duplicate.
