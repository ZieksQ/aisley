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

## 2026-11-06 — Shared portal Settings workspace

- Admin and Seller now follow Logistics Settings navigation with Account, Terms and conditions, Billing entry links to existing Finance settings, and System/Light/Dark Appearance. Shared presentation preserves role palettes, account forms, consent/setup gates, legacy query/hash redirects and Finance permissions; Customer and API/mobile contracts remain unchanged.
- Verification: three portal TypeScript/build/lint checks and Customer TypeScript passed (existing Logistics test lint warning remains); 48 Admin/Seller Settings and 88 account browser combinations passed. An adapted local Logistics Settings check passed 24 combinations after correcting stale notification/policy fixtures/selectors. Reviewed responsive light/dark screenshots and passing Taste inspections with a documented sparse-form warning. See [verification](features/shared/account-settings/portal-settings-verification-2026-11-06.md); live/deployed acceptance remains open.

## 2026-11-06 — Support ticket chat UI/UX

- Refreshed Customer, Seller, Logistics and Admin support tickets using Google Stitch MCP with endpoint context: shared readable inbox rows/statuses, clearer public history, anchored labeled composers, resolved-ticket guidance and collapsible Admin management. Consolidated conflicting styles and retained role palettes, draft guards, exact retries, permissions and API/mobile contracts.
- Verification: all four TypeScript/production builds, scoped lint, existing Admin filter test and 35 controlled Chromium role/theme/viewport combinations plus form/navigation/status/management/retry/history checks passed. Reviewed responsive screenshots and Taste inspections; documented sparse-inbox and slate-border allowances. See [verification](features/admin/support-ticket-system/chat-ui-verification-2026-11-06.md) and [Stitch project](https://stitch.withgoogle.com/projects/13843117589710674814). Authenticated/deployed acceptance remains open.

## 2026-11-06 — Seller and Logistics dashboard setup guides

- Added shared six-item dashboard guides with role-specific navigation tips, direct workspace links, automatic Product/provider/rate-card checks, accessible progress, browser-local lessons and hide/reopen preferences. New-account auto-opening uses a fixed deployment cutoff; existing accounts opt in. Preserved operational dashboards, approval/consent gates, tenant isolation and external mobile contracts.
- Verification: both TypeScript/production builds, scoped lint/PHP formatting, 5 new API tests (103 assertions) and 8 existing Seller dashboard tests (123 assertions) passed. Chromium passed 72 task/theme/viewport combinations plus persistence, completion, account isolation and failure/retry checks. Reviewed responsive light/dark captures and passing Taste inspections with documented existing-shell allowances and empty-chart warnings. Configure `DASHBOARD_GUIDE_LAUNCH_AT` at rollout; deployed/PostgreSQL acceptance remains open. See [verification](features/shared/dashboard-setup-guide/verification-2026-11-06.md).

## 2026-11-09 — Production environment recovery

- Deployment now reports a missing/empty private environment file before pulling code and tolerates the known environment Vim swap filename while retaining the checkout-change guard. Ignored Vim swap files, expanded the production template with server Geoapify settings, and added a linked recovery/provider-key guide covering original key/database recovery, frontend build variables, Cloudflare, Azure and SMTP.
- Verification: deployment Bash syntax, isolated Git guard cases (swap accepted, tracked/untracked source changes rejected), and whitespace checks passed. Production VM restoration, provider credentials and frontend redeployment remain operator actions; no production credentials were accessed.

## 2026-11-09 — Linehaul trucks remain visible without active work

- Fleet monitoring now includes owned trucks with no active trip, including after completed/received, cancelled or rejected work, using saved last-confirmed hub pins. Added idle-truck identity, availability and location labels; retained tenant isolation, SQL pagination, search and existing refresh/session handling. Unknown locations remain unavailable; no live GPS collection or external mobile contract changes. Updated canonical monitoring/map docs.
- Verification: 14 focused API tests (226 assertions), Logistics TypeScript, scoped Oxlint, production build, Pint and diff checks passed. Existing bundle-size warning remains; browser and deployed/real-truck acceptance were not rerun.

## 2026-11-09 — Fleet locations and past-transfer pages

- Clarified active/idle truck maps with plate-labelled last-confirmed hub markers and explicit in-transit uncertainty, preserving current schedules. Added sending/Outbound and receiving/Inbound Logistics labels, per-truck Past transfers buttons, a separate terminal-history table and View transfer pages with schedule, manifest references, events and schematic origin/destination maps. Preserved tenant/role/consent boundaries, URL state and external mobile contracts; updated canonical specs/map docs.
- Verification: 15 focused API tests (264 assertions), Logistics TypeScript/build, scoped lint/Pint and whitespace checks passed. Synthetic Chromium passed 66 new transfer, 65 monitoring and 68 assignment checks; reviewed responsive light/dark screenshots. Taste source/inspection passed with documented map/sidebar allowances and an existing below-fold warning. Basemap tiles were intermittent; deployed/PostgreSQL/real-truck acceptance remains open. See [verification](features/logistics/fleet-monitoring/verification-2026-11-09.md).
