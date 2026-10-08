---
feature: admin-dashboard
title: Admin Dashboard
system: AISLEY
type: Feature Specification
version: 2.1
status: Implemented read-only MVP
implementation_status: Permission-scoped registration, open support-ticket, and open compliance summaries implemented
canonical: true
role: Admin
scope: Admin Web Application and read-only Laravel API
reviewed: 2026-10-02
verified: 2026-10-02
---

# Admin Dashboard

## WHAT

### Purpose and current implementation

- Give an active Admin a permission-scoped operational overview and links to the owning work queues.
- The implemented `GET /api/v1/admin/dashboard` returns a registration overview, open support-ticket/compliance summaries, and `generated_at`.
- Registration counts cover pending Customer, Seller, and Logistics applications; Courier approval remains with Logistics.
- Existing registration action items show at most five oldest pending applications.
- Support tickets, Seller compliance, Finance, and notifications already have their own features; their existence does not imply Dashboard summaries exist.
- The read-only **Open support tickets** and **Open compliance cases** cards link to their owning filtered queues.

### Scope and boundaries

- Preserve the implemented registration contract; add permission-scoped counts, filtered queue navigation, and independent loading/error states.
- Keep ticket replies/assignment, compliance decisions, registration approval, and notification read state in their owning features.
- Exclude Finance charts, revenue calculations, infrastructure health, campaign management, new notification feeds, and mandatory realtime transport.
- Do not change Order, Shipment, Courier assignment, inventory, or policy-consent state.
- No new library, analytics table, migration, or Flutter change was added.

### Admin flow

- Authenticate, satisfy active-Admin and applicable policy-consent checks, then open the Dashboard.
- Read only authorized sections; distinguish a genuine zero from a failed or unavailable query.
- Open a filtered owning queue to perform work there; returning or refreshing retrieves current server counts.

## MUST

### Authorization and read-only behavior

- Use Sanctum authentication and the persisted `admin` role; enforce active status and the existing policy-consent middleware.
- The Dashboard route has no separate `dashboard.view` permission today; do not invent one as existing behavior.
- Authorize each section on the server before querying or returning its data:
  - Registrations: `registrations.view`.
  - Support tickets: `support-tickets.view`.
  - Seller compliance: `seller_compliance.manage`, matching its existing queue permission.
- A forbidden section is `null`; omit its count and navigation from the UI. Hiding a card is not authorization.
- An Admin without these permissions may receive a safe empty Dashboard, not applicant data or a sign-in loop.
- Dashboard reads must not claim tickets, mark messages read, update cases, send notifications, or create audit events.
- Never accept client-controlled role, organization, owner, or permission fields.

### Sidebar navigation

- Keep Dashboard directly accessible at the top of the Admin sidebar.
- Group the remaining links by task: **Accounts** (registrations, user accounts, seller compliance), **Communication** (support tickets, notifications, campaigns), **Platform** (finance, pricing & fees, finance holds, audit logs, platform settings, feature controls), and **My account** (account settings, policy consent).
- Show a group only when at least one of its destinations is visible to the current Admin. Each feature link still follows its existing permission; hiding a link never replaces backend authorization.
- Keep groups collapsed by default on Dashboard, with one group expanded at a time. Open the group containing the current route, including detail and editor routes, so the active destination remains discoverable after navigation or reload.
- Group controls must be keyboard-operable and expose expanded state to assistive technology. Keep child links and active states clear in both themes and on the mobile sidebar.
- Do not add Dashboard widgets or duplicate destination-feature workflows as part of navigation grouping.

### Exact count and navigation rules

- Registration totals include only `pending` applications of `customer`, `seller`, and `logistics`.
- Keep registration action ordering by ascending `submitted_at`, then `id`, with a limit of five.
- Open support tickets means `SupportTicket.status = open`, across the records visible to the Admin queue and all assignees.
- Do not include `in_progress`, `waiting_for_requester`, or `resolved`, or label this count unread/all unresolved.
- Open compliance cases means `SellerComplianceCase.status = open`; exclude `confirmed`, `dismissed`, and `closed`.
- Do not substitute Product restrictions, suspended Sellers, paginated row counts, or unread notifications for case counts.
- Registration navigation retains `/registrations?status=pending` and owned permission checks on detail routes.
- Support navigation targets `/support-tickets?status=open`; the owning page initializes its allow-listed URL filter.
- The support page initializes allow-listed status/category/assignee filters from the URL, preserves them when opening a ticket, and resets pagination on filter changes; foreign/invalid values are ignored.
- Compliance navigation uses the existing `/seller-compliance?status=open` filter.
- Counts use database aggregates over the same authorized filters as their queues, not fetched-page lengths.
- Counts are current at query time; subsequent queue changes may differ. Do not claim an atomic cross-feature snapshot.

### Privacy, failures, and refresh

- New cards return counts and safe queue metadata, not ticket bodies, applicant details, Seller evidence, payment data, or raw storage paths.
- A successful authorized count is a nonnegative integer; zero is a real result, not an error fallback.
- For each new authorized section, `state = ready` carries a count; `state = unavailable` carries `count = null`.
- A section-local failure must not erase other successful sections. Authentication/authorization or shared database failures must fail closed.
- Responses use `Cache-Control: private, no-store` and client reads use `cache: no-store` with a 15-second deadline.
- Do not share-cache personalized Dashboard data or reuse it across accounts or changed permissions.
- Show a loading state on first fetch, visible retry on failure, and a clearly stale timestamp if retaining a previous result.
- Refresh on entry and explicit refresh; foreground/focus recovery may coalesce requests without overlapping fetch loops.
- Use explicit read retries and coalesced foreground recovery; abort obsolete reads. A throttled response pauses automatic focus/reconnect retries until an explicit later retry. No offline mutations or new websocket infrastructure.
- A 401 follows existing session cleanup/sign-in behavior; distinguish forbidden/inactive access and policy-consent gating from network failure.
- Abort obsolete reads and clear private data on logout, denied access, or account changes.

### Web presentation and navigation

- Follow `docs/design.md`: mobile-first layouts, existing typography/spacing, compatible shared primitives, and Admin light/dark themes.
- The page must fetch permitted support/compliance sections even when `registrations.view` is absent.
- Preserve registration cards and action links; replace misleading placeholder copy rather than declaring existing Finance features unimplemented.
- Use clear card titles, textual counts, loading/zero/unavailable/forbidden states, and keyboard-accessible links and retry controls.
- Preserve direct Dashboard navigation and existing Accounts, Communication, Platform, and My account groups.
- Show only authorized links; keep current-route groups open, detail-route highlighting, one expanded group, and responsive navigation.
- The notification bell retains its own API/read-state contract; Dashboard counts must not silently mark notifications read.
- Verification below distinguishes mocked browser interaction and focused database tests from broader production acceptance.

### Acceptance criteria

Existing baseline and enhancement verified on 2026-10-02:

- [x] Guests and non-Admins cannot read the Dashboard; absent registration permission returns no registration overview.
- [x] Registration counts exclude approved/rejected applications and Courier applications.
- [x] Registration action items are bounded and ordered; the read excludes private applicant contact fields and writes no audit events.

- [x] Every permission combination returns only authorized sections, including support/compliance access without registration access.
- [x] Open counts match queue filters and distinguish ready zero, unavailable null, and forbidden null.
- [x] Support queue URL initialization and existing compliance filters make card navigation reproduce the counted set.
- [x] Section failure preserves other successful sections; session/permission changes clear denied cached data.
- [x] DTOs remain minimal and private/no-store; Dashboard reads have no domain, notification, or read-marker side effects.
- [x] Registration response compatibility, bounded action ordering, and middleware behavior remain intact.
- [x] Mocked-HTTP Chromium verifies loading, empty, unavailable, retry, stale, and consent/forbidden states at 390/768/1280px in both themes.
- [x] Keyboard/focus checks, focused Dashboard API tests, TypeScript, changed-file lint, and Admin build pass.

Production acceptance is not implied by mocked browser contracts. The separate PostgreSQL compliance case-creation audit assertion fails even when run alone; it does not exercise Dashboard reads and remains an owning-feature verification issue.

## HOW

### API contract and owning queues

- Existing route: `GET /api/v1/admin/dashboard`; no body or feature-selection query is required.
- Authorization: `auth:sanctum`, active Admin, applicable policy consent; section permissions are server-derived.
- 200 envelope: `{data: {registrations: overview | null, support_tickets: summary | null, seller_compliance: summary | null, generated_at: ISO8601}}`.
- Existing overview: `{pending: {total, by_role: {customer, seller, logistics}}, action_items: [{id, role, submitted_at}]}`.
- Additive fields inside `data`: `support_tickets` and `seller_compliance`; each is `null` when unauthorized.
- Ready support example: `{state: "ready", count: 3, filter: {status: "open"}, destination: "/support-tickets?status=open"}`.
- Compliance uses the same shape with its own destination; unavailable sections retain the filter/destination and return `state: "unavailable", count: null`.
- Existing owning reads: `GET /api/v1/admin/support-tickets?status=open&assignee=all` and `GET /api/v1/admin/seller-compliance/cases?status=open`.
- Owning queues retain their independent pagination and response envelopes; do not treat their list endpoints as Dashboard aggregates.
- Existing denial behavior includes 401/403; respect `POLICY_CONSENT_REQUIRED` where returned. Unavailable request infrastructure is an error, not a successful zero.
- GET retries have no mutation or idempotency-header requirement; they return newly read authorized data.

### Implementation and verification approach

- Extend the existing Admin Dashboard controller through focused query/service and DTO/resource responsibilities.
- Reuse the Support ticket reader's Admin scope and the compliance queue filters; permission checks precede aggregate queries.
- Keep aggregates bounded in query count; do not hydrate ticket bodies or case relationships to count records.
- Extend Dashboard client types and extract card/state components within the Admin structure instead of mixing independent workflows into one page.
- Coordinate support URL-filter initialization with its owning feature; no ticket or compliance mutations are added here.
- Extend `AdminDashboardTest` for permission combinations, exact status counts, partial failures, privacy, and read-only behavior.
- Verify queue-filter parity, logout/permission-loss cleanup, both themes, responsive states, keyboard focus, type checks, lint, and build.
- Deploy compatible additive response fields before enabling their cards; document actual verification in `docs/PROGRESS.md`.

### Implementation record

- `DashboardController` delegates to `DashboardService`, `DashboardQueueCounts`, and `DashboardResource`. Permissions are read before aggregates; Support uses `SupportTicketReader::scoped`, and compliance uses the owning queue's global Admin/status scope.
- Each new count uses a transaction/savepoint so a missing table/column can return section-local unavailable without leaving PostgreSQL's transaction aborted. Connection/database-permission and unexpected query failures propagate as request errors, never successful zeros. Registration compatibility is unchanged.
- Focused Dashboard components and `useDashboard` replace the decorative scaffold/obsolete Finance placeholder. Account/permission-keyed state, cancellation, no-store reads, explicit retry, stale timestamps, consent redirect, and 401 cleanup are implemented. The sidebar and notification bell contracts are unchanged.
- `node tests/dashboard-browser.smoke.mjs` in `src/admin` uses real Chromium against mocked HTTP; start Admin Vite on 15175 and ChromeDriver on 19515. Generated artifacts remain in ignored `node_modules/.cache/`.
- Verification on 2026-10-02: SQLite Dashboard/support/compliance/consent regressions pass (32 tests/369 assertions); disposable PostgreSQL Dashboard/support/consent regressions pass (24 tests/305 assertions), including savepoint recovery after real missing-table/column errors. The broader PostgreSQL compliance audit assertion failure is separately reproduced above. URL-filter tests, Admin TypeScript/changed-file oxlint/Vite build, PHP Pint, and mocked browser checks pass; the existing large-chunk build warning remains. No migration was needed and the application database was not modified.

### Sources and deferred expansion

- Current implementation: `src/api/app/Http/Controllers/Admin/DashboardController.php`, `src/api/routes/api.php`, `src/api/tests/Feature/Admin/AdminDashboardTest.php`.
- Current UI: `src/admin/src/pages/DashboardPage.tsx`, `src/admin/src/types/dashboard.ts`, and the existing support/compliance queue pages.
- Project authority: `docs/requirements.md`, `docs/workspace.md`, `docs/domains/Admin.md`, and `docs/design.md`.
- Owning specs: `docs/features/admin/support-ticket-system/spec.md` and `docs/features/admin/monitor-seller-compliance/spec.md`.
- Server-side authorization and aggregate approach: [Laravel authorization](https://laravel.com/framework/docs/13.x/authorization) and [query aggregates](https://laravel.com/framework/docs/13.x/queries#aggregates).
- Broader analytics, Finance summaries, multi-status workloads, health monitoring, and realtime Dashboard events need a separate approved scope before implementation.

## Finance navigation extension (2026-10-05)

- Finance retains the overview and adds role-owned links to payout history and applicable payment settings. Admin and Logistics also have COD invoice/remittance pages; Admin owns automation and gateway simulation controls.
- These workflows are specified in `../../shared/cod-automation/spec.md`; Dashboard aggregates and operational role boundaries remain unchanged.

## Voucher navigation extension (2026-10-09)

- Add Vouchers (`/vouchers`, `/vouchers/new`, `/vouchers/:id`) under **Platform**, preserving active-route expansion and mobile close behavior. The [voucher specification](../vouchers/spec.md) owns the workflow.
- Navigation/reads require `vouchers.view`; mutations additionally require `vouchers.manage`. Read-only Admins can inspect terms, versions, actions and redemption reports. Provision permissions through the additive migration and `AdminPermissionSeeder`; grant them explicitly to the appropriate Admins.
