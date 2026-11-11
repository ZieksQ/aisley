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

## 2026-11-09 — Admin Logistics account responses

- Fixed missing Logistics role handling in Admin account list/detail and lifecycle responses, preserving profile names, email fallback and contact masking. Included Logistics profiles in eager loading/name searches and allowed the Logistics role filter; Admin account exclusion and permission boundaries remain enforced.
- Verification: new regressions reproduced the original failures before the fix; all 15 account-management API tests (93 assertions), scoped Pint and whitespace checks passed using SQLite. Deployed/PostgreSQL verification remains open.

## 2026-11-09 — Courier pickup and linehaul schedule conflicts

- Pickup reservations now block linehaul regardless of elapsed end dates or legacy premature completion, and active linehaul blocks pickup availability. Pickup schedules complete and release their Courier only after all parcels reach the Logistics hub, preserving history, idempotency, Inventory and role/tenant boundaries. Removed pickup end-date controls, made API ends nullable through a new migration and updated canonical/portable Courier contracts without changing Flutter status.
- Verification: 31 scoped SQLite API tests (628 assertions), three TypeScript/production builds, scoped lint/Pint and whitespace checks passed. Synthetic Chromium passed six responsive/theme component states plus single-start entry, reserved/available Courier selection, keyboard and overflow checks; reviewed captures. Existing bundle warnings remain. Apply the new migration at deployment; PostgreSQL/concurrent-worker, deployed and external Flutter acceptance remain open. See [verification](features/orders/logistics-pickups/verification-2026-11-09.md).

## 2026-11-09 — Pickup retries, expiry and Courier rejection

- Added same-day Philippine pickup due time, three failed attempts per parcel assignment, a 72-hour retry period and whole-schedule rejection before acceptance. Uncollected parcels return to Logistics scheduling with their existing waybills, stock reservations and assignment/decision history; collected parcels retain custody until hub receipt. Added Courier API/prototype controls, bounded minute expiry, current-assignment receipt/projection handling and canonical/portable mobile contracts without changing Flutter status.
- Verification: 39 scoped SQLite API tests (716 assertions), prototype TypeScript/build/lint, responsive Chromium action/retry/expiry checks, scoped Pint, PHP syntax and whitespace checks passed. One existing linehaul test fails at unchanged sorting setup (`destination_unclear`), reproduced with original tracked API code. Apply the additive migration; PostgreSQL/concurrent-worker, deployed and external Flutter acceptance remain open. See [verification](features/orders/logistics-pickups/retry-verification-2026-11-09.md).

## 2026-11-11 — Flutter address pin privacy and map layering

- Updated the explicitly scoped external Courier and Buyer Flutter repositories: clipped map viewports and isolated web SDK stacking; removed Buyer manual latitude/longitude entry and numeric readouts while retaining validated pins internally. Courier has no coordinate entry/readouts. Updated affected external presentation contracts and progress logs; API contracts remain unchanged.
- Verification: both Flutter analyzers, 104 focused widget/PSGC/recovery tests, formatting and whitespace checks passed. Synthetic Chromium checked Courier map/overlay layering and controls plus Buyer semantics-enabled pin tap/Confirm/Cancel and hidden coordinates; reviewed Buyer capture. Installed Android, live GPS/API/provider and release-build acceptance remain open.

## 2026-11-11 — Seller order thumbnails and pickup collection status

- Added first-item Product thumbnails to Seller order tables using the existing approved-media resolver and shared missing/broken-image fallback. Pickup request list/detail now show confirmed partial/full Seller collection from current first-mile task evidence, including existing requests, while preserving scheduling status, hub-receipt lifecycle and tenant isolation. Updated the canonical Seller preparation spec; no migrations or external mobile contract changes.
- Verification: 20 focused SQLite API tests (309 assertions), 8 existing order-action tests, Seller TypeScript/production build, scoped Oxlint/Pint and whitespace checks passed. Focused synthetic Chromium passed 8 responsive/theme states plus image fallbacks, collection refetch and detail checks; reviewed captures. The broader Orders browser suite stopped at its unrelated approval-sort pagination assertion (`page=2` versus expected `1`); existing bundle-size warning and deployed/PostgreSQL acceptance remain open.

## 2026-11-11 — Logistics pickup schedule parcel details

- Fixed schedule rows opening only their first Seller pickup request. Each row now opens a schedule-specific view showing every assigned parcel grouped by request, with tracking IDs and links to existing request actions. Added a private organization/hub-scoped detail endpoint that preserves historical membership and excludes other parcels when requests are split across schedules; updated the canonical pickup spec.
- Verification: 15 SQLite pickup API tests (319 assertions), Logistics TypeScript/production build, scoped Oxlint/Pint and whitespace checks passed. Synthetic Chromium passed 51 checks covering 7 parcels across 3 requests, schedule navigation/direct links, 320/390/768/1440px light/dark views, overflow, refresh recovery, empty and missing states; reviewed captures. Existing bundle-size warning remains; deployed/PostgreSQL acceptance remains open.

## 2026-11-11 — Sorting reconciliation spacing

- Tightened Logistics Session reconciliation rows to 8px vertical padding, bounded reference/lane/status columns and top-aligned details. Preserved mobile stacking, filters and lane actions, with safe wrapping for long parcel details; no API or workflow changes.
- Verification: Logistics TypeScript/production build, scoped Oxlint and whitespace checks passed. Synthetic Chromium passed eight 320/390/768/1440px light/dark combinations with search, status filtering, empty results, long-content overflow and Move lane checks; reviewed mobile/desktop captures. Existing bundle-size warning remains; deployed acceptance was not run.

## 2026-11-11 — Fleet Monitoring alignment polish

- Aligned assignment/company filters, moved Past transfers into a dedicated action column, tightened truck/history table spacing and removed duplicated map-panel padding. Preserved themes, responsive table scrolling, navigation, API and mobile contracts.
- Verification: Logistics TypeScript/production build, scoped application Oxlint and whitespace checks passed; 213 synthetic Chromium monitoring/assignment/transfer checks passed. Subagent reviewed responsive light/dark captures and scored UI/UX 6.9 → 7.6/10; final Taste inspection had zero failures and one existing below-fold warning. Existing bundle-size/test-helper warnings, intermittent map tiles and deployed acceptance remain documented in [verification](features/logistics/fleet-monitoring/verification-2026-11-11.md).

## 2026-11-11 — Linehaul driver availability and assignment context

- Driver selection now lists Available/Busy status, blocking schedules, truck/route or planned-area context and honest operational/last-confirmed locations. Busy drivers remain readable but cannot be selected; refresh clears stale selections. Shared API/scheduling work queries include active delivery acceptance/transit, preserve pickup reservations and redact foreign-work details. Updated the canonical spec; no migration or mobile contract change.
- Verification: 16 focused SQLite API tests (343 assertions), Logistics TypeScript/production build, scoped Oxlint/Pint and whitespace checks passed. Synthetic Chromium covered 48 route/theme/viewport states, six driver-modal states and driver search/selection/refresh/keyboard plus transport interactions; reviewed captures and passing Taste inspection with documented modal/sidebar allowances. Two older company-truck tests fail on unpinned Seller fixtures, reproduced with the original service. Existing bundle warning and deployed/PostgreSQL acceptance remain. See [verification](features/logistics/company-truck-linehaul-dispatch/driver-availability-verification-2026-11-11.md).

## 2026-11-11 — Last-mile dispatch excludes linehaul parcels

- Last-mile dispatch now requests a server-filtered final-mile queue, excluding pending transfers, intermediate/wrong hubs, unresolved/unavailable routes and condition holds before pagination and lane/status counts. Completed destination-hub, same-hub and historical route-less parcels remain visible; general parcel queues and transactional dispatch guards are preserved. Updated the canonical dispatch spec; no migration or external mobile contract changes.
- Verification: the new regression failed without the fix; 11 focused SQLite API tests (487 assertions), Logistics TypeScript/production build, scoped Oxlint/Pint and whitespace checks passed. The broader hub-routing suite had 21 failures at existing unpinned Seller-address setup before routing assertions. Existing bundle warning remains; browser, deployed and PostgreSQL acceptance were not rerun.


## 2026-11-12 — Linehaul outbound table and monitoring links

- Aligned Active outbound trips with compact consistent insets, separate Status/Actions columns and fixed-width button stacks. Rows and keyboard route links open the selected truck trip in Fleet Monitoring, with terminal-history fallback and explicit unavailable handling when assignments change. Preserved operational controls, role themes, API/mobile contracts and organization boundaries; updated canonical specs.
- Verification: Logistics TypeScript/production build, scoped Oxlint/Taste source lint and whitespace checks passed. Synthetic Chromium passed 34 new outbound checks, 79 monitoring checks, 66 past-transfer checks and existing transport interactions; reviewed responsive light/dark and destination captures. Taste inspection had zero failures and two existing shell/composition warnings. Existing bundle warning and contained phone table scrolling remain documented in [verification](features/logistics/company-truck-linehaul-dispatch/outbound-table-verification-2026-11-12.md). Deployed/real-account acceptance remains open.

## 2026-11-12 — Logistics rate-rule modal layout

- Aligned Shipping rates Add/Edit rule fields, shortened the title and kept the header and 44px shared action buttons visible around independently scrolling fields. Applied Logistics blue hover/pressed states and theme-aware native controls; preserved rule validation, local drafts, focus handling and API/mobile contracts. Updated the canonical spec.
- Verification: Logistics TypeScript/production build, scoped Oxlint/Taste source lint and whitespace checks passed. Synthetic Chromium passed 60 existing rates/fleet route/theme/viewport combinations and 12 modal states plus add/edit, validation, tooltip, keyboard and close checks. Reviewed before/after captures; final light/dark Taste inspections passed with documented existing-sidebar/modal-overlay allowances. Existing bundle warning, deployed/device and actual browser-zoom acceptance remain. See [verification](features/logistics/rate-cards/modal-verification-2026-11-12.md).

## 2026-11-12 — Logistics ticket chat and requester status

- Reworked Logistics support into an Aqours/Stitch-inspired inbox, chat and details/status workspace with responsive themes and visible mobile reply actions. Added own-ticket resolve/reopen with public reasons, revision/idempotency checks, Admin notifications/unread history and protected private drafts; preserved Admin work states and other requester contracts.
- Verification: 30 scoped SQLite support API tests (912 assertions), Logistics TypeScript/build, scoped lint/Pint/whitespace and 16 focused Chromium chat/details states plus status/retry/conflict/access-loss checks passed. Independent subagent Stitch review passed; Taste source scan had no failures. Existing bundle warning, unrelated stale Settings policy fixture and deployed/PostgreSQL/device limitations remain. See [verification](features/logistics/support-tickets/verification-2026-11-12.md).
