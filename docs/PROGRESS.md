# Progress

Short, dated log of what has been implemented across the whole app. Append new entries and preserve archives.

## 2026-11-05 — Progress archive

- Archived the complete log, including the Admin Seller compliance queue and seller-picker refresh with verification, at [PROGRESS-2026-11-05.md](logs/PROGRESS-2026-11-05.md).

## 2026-11-05 — Account settings UI/UX refresh

- Refreshed Customer, Seller, Admin and Logistics account settings with shared identity/section presentation, responsive role themes, focused forms, accessible image removal, retained ordinary drafts and session-safe security disposal. Preserved existing APIs, role boundaries, Admin email verification and external mobile contracts.
- Verification: all four TypeScript/production builds and scoped lint passed; Chromium passed 88 role/theme/viewport/section combinations plus profile/image, keyboard/history, role-form, password-recovery and account-switch checks. The existing Customer ID-image smoke passed. Taste inspection passed light/dark screens at 1440/768/390px; reviewed captures. Browser data/APIs are synthetic; live storage/email/deployed acceptance remains open. See [verification](features/shared/account-settings/verification-2026-11-05.md).

## 2026-11-05 — Finance portal UI and period reporting

- Refreshed Admin, Seller and Logistics Finance with Stitch-guided shared layouts, role themes, accessible date presets/custom ranges, server-filtered reports/queues/histories, matching bounded CSV exports, and explicit current-versus-period financial labels. Preserved tenant/permission boundaries, payment workflows, uncertain retry identities and external mobile contracts; updated canonical Finance specs.
- Verification: 57 scoped API tests (568 assertions), three TypeScript/production builds, scoped lint and PHP formatting passed. Chromium passed 114 role/theme/viewport/screen combinations plus payment/settings/reconciliation/download, date/history, account/access-loss and uncertain-retry checks. Reviewed screenshots; Taste measurements passed Admin light and Logistics dark. Browser APIs are synthetic; PostgreSQL/deployed/production-volume acceptance remains open. See [verification](features/shared/commission-settlement/finance-ui-verification-2026-11-05.md) and [Stitch project](https://stitch.withgoogle.com/projects/18092453032071230043).

## 2026-11-05 — Logistics parcel search and Sorting lane pagination

- Refreshed Parcel search with search-first blue/slate portal controls, responsive selected details, labeled filters/reset, focused custody/task/evidence sections, safe lookup ordering, read-only offline cache and exact uncertain-update retry. Added eight-lane pagination to Sorting with selection preservation, refresh clamping and scanned-lane page reveal. Preserved API/mobile contracts and updated canonical specs.
- Verification: Logistics TypeScript, production build, lint and diff checks passed. Chromium passed 16 Parcel search and 24 existing Sorting/dispatch responsive/theme states plus lookup/filter/history/cache/proof/retry and pagination/printing checks; real camera frames passed parcel barcode/QR lookup and repeated lane-QR page reveal. Reviewed screenshots. Existing sidebar Beta-label Taste failures and deployed/device limitations are recorded in [verification](features/logistics/dashboard/parcel-search-verification-2026-11-05.md).

## 2026-11-05 — Fleet pickup and delivery monitoring

- Added a private paginated active-assignment API and synchronized Leaflet map/list for first-mile pickup/return-to-hub, owned-truck linehaul and last-mile delivery work. Added interactive stage icons/colors, grouped stops, safe schedule/event details, URL filters, refresh recovery and session-safe disposal; preserved truck monitoring and external mobile contracts.
- Verification: 13 focused API tests (206 assertions), Logistics TypeScript/build/lint, scoped Pint and diff checks passed. Chromium passed 68 assignment, 74 existing monitoring and 2 unconfigured-provider checks; reviewed light/dark responsive captures and passing Taste inspections with documented map/shell allowances. Eight broader linehaul tests fail in existing unpinned Seller fixture setup; PostgreSQL/deployed/real-account acceptance remains open. See [verification](features/logistics/fleet-monitoring/verification-2026-11-05.md).

## 2026-11-05 — Customer homepage main categories

- Homepage now lists active main category groups with matching icons and a fallback, and hides Save across homepage product sections while retaining it elsewhere. Added main-group cache invalidation and updated canonical/Buyer API documentation without changing Flutter status.
- Verification: 6 API tests (111 assertions), Customer TypeScript/build, scoped ESLint/Pint, URL/session regressions and synthetic Chromium responsive/navigation/session checks passed. Reviewed Taste captures; category source lint passed, while the full-page inspector retains existing commerce/shell and fixture findings. See [verification](features/customer/customer-homepage/verification-2026-11-05.md).

## 2026-11-05 — Admin Campaigns UI/UX refresh

- Refreshed Campaigns with history-first URL pagination, a dedicated draft composer and live plain-text preview, saved-revision audience review, accessible confirmation, delivery-first results and responsive Admin themes. Added stale-revision comparison, uncertain-send reconciliation with stable retry keys, and session/permission-safe disposal; preserved API/mobile contracts.
- Verification: Admin TypeScript/build, scoped lint and diff checks passed; 4 existing API tests (67 assertions) and 91 synthetic Chromium checks passed. Reviewed before/after captures and final Taste inspections at 1440/768/390px in both themes: no failures, with documented natural-height column warnings. PostgreSQL/deployed acceptance remains open. See [verification](features/admin/push-notification-bar/verification-2026-11-05.md).

## 2026-11-05 — Policy consent reading boxes

- Terms and Privacy now use separate bounded, keyboard-focusable scroll regions on Customer, Seller, Admin, and Logistics consent screens. Confirmation checkboxes and Accept remain outside the reading regions; the shared policy specification records this interaction.
- Verification: Seller, Admin, and Logistics production builds, scoped Oxlint/ESLint, and 28 synthetic Chromium role/theme/viewport checks plus acceptance and independent-scroll flows passed. The Customer Next.js build stalled during optimized compilation and was stopped; Customer production-build verification remains open.
