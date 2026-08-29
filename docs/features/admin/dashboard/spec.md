---
feature: admin-dashboard
title: Admin Dashboard
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Dashboard

## WHAT

- **Feature:** Admin Dashboard for the AISLEY Admin web application.
- **Purpose:** Give an authenticated Admin a high-level view of platform activity, key performance indicators (KPIs), pending actionable work, and important notifications immediately after login.
- **Primary actor:** Authenticated `ADMIN`.
- **Source-defined role:**
  - primary Admin entry point after authentication
  - overview of the platform
  - display platform-wide telemetry/KPIs
  - surface pending actionable items
  - display important notifications
  - provide a high-level indication of platform/system health
- **Architecture:**
  - Next.js/React renders dashboard cards, lists, charts, loading/error states, and real-time updates.
  - Laravel owns KPI calculations, authorization, aggregation queries, notification state, and dashboard DTOs.
  - Eloquent/database values returned by Laravel are authoritative.
- **Dashboard is read-oriented.**
  - It summarizes other Admin domains.
  - Mutating business actions remain owned by their feature specs.
  - Dashboard actions should normally navigate to the owning feature instead of reimplementing its workflow.
- **Source-backed candidate widgets:**
  - pending account registrations
  - user/account status summary
  - seller-compliance items requiring review
  - open complaints/disputes
  - platform commission/revenue summary from Reports Overview
  - unread/important Admin notifications
- These widgets are **recommended composition from existing Admin features**, not a new mandatory KPI contract where the source does not define exact metrics.
- **Recommended route:**

```text
/dashboard
```

- **Relationship to Admin Authentication:**
  - successful Admin login enters `/dashboard`
  - Dashboard independently enforces Admin authentication and permissions
- **Non-goals:**
  - approving/rejecting accounts inside the Dashboard
  - suspending users/sellers inside the Dashboard
  - resolving complaints inside the Dashboard
  - editing platform settings
  - generating full financial reports
  - sending push/SMS campaigns
  - infrastructure monitoring such as CPU/RAM/uptime unless a later system-health requirement explicitly defines it
  - inventing analytics not supported by the real schema

## MUST

### Access control

- Dashboard requires:
  - authenticated session
  - persisted role = `ADMIN`
  - Dashboard permission when custom permissions are configured
- Laravel is authoritative for access.
- Frontend route guards are UX only.
- Dashboard data must respect feature-level permissions.
- An Admin who lacks permission for a source feature must not receive restricted data from that feature merely because it appears on Dashboard.
- Do not return hidden KPI values and rely on React to conceal them.
- Use project-standard responses:
  - `401` unauthenticated
  - `403` forbidden
  - `422` invalid dashboard filter/request when applicable

### Initial dashboard snapshot

- On entry, Dashboard must request a server-authoritative snapshot.
- The response should group data by dashboard concern instead of exposing raw database records.
- Conceptual response:

```json
{
  "kpis": {},
  "actionItems": [],
  "notifications": [],
  "generatedAt": "ISO-8601 timestamp"
}
```

- Exact field names follow repository response conventions.
- Include only data required to render the authorized dashboard.
- `generatedAt` or equivalent freshness metadata is recommended when metrics may be cached.
- Dashboard must not directly query the database from Next.js.

### KPI rules

- KPI calculations must be performed by Laravel/database queries.
- Do not calculate authoritative money, counts, or status totals from partially loaded frontend collections.
- Metrics must have documented definitions.
- A displayed count must map to a reproducible backend query.
- Money must follow the project's fixed-precision money representation.
- KPI queries must respect:
  - role/permission visibility
  - valid domain statuses
  - soft-delete/archive rules
  - tenant/platform scope where applicable
  - timezone/date boundaries when time filtering is added
- Avoid mixing different business meanings under one label.
- Example: `Pending Accounts` must define which account statuses count as pending.
- Exact KPI set is an Open Question until the relevant feature schemas are confirmed.

### Recommended MVP KPI composition

- If supported by the actual schema and current Admin permissions, prefer a small operational set such as:
  - pending registration count
  - open complaint/dispute count
  - unresolved seller-compliance count
  - user-account summary
  - platform commission/revenue summary
- Do not require all five if the corresponding feature/schema is not yet implemented.
- Do not add vanity metrics solely to fill Dashboard space.
- Full financial breakdowns belong to Reports Overview.
- Full account lists belong to Manage Account Registrations / Manage User Accounts.

### Pending actionable items

- Dashboard must be able to surface work requiring Admin attention.
- Action items should reference the owning feature rather than duplicate its mutation logic.
- Conceptual examples:
  - registration awaiting review
  - unresolved complaint
  - seller-compliance item requiring action
- Each action item should include only safe summary fields needed to understand and navigate to the work item.
- Recommended fields:

```text
type
resource_id
title/summary
priority or age when defined
created_at
destination
```

- Destination must be an internal authorized Admin route.
- Do not expose evidence files, full complaint contents, sensitive profile data, or other heavy detail in the Dashboard summary unless explicitly required.
- Clicking an item must still pass authorization in the destination feature.

### Notifications

- Dashboard must display Admin notifications relevant to the authenticated Admin.
- Notification state must be backend-owned.
- Recommended notification fields:
  - ID
  - type
  - safe title/message
  - created timestamp
  - read/unread state
  - optional internal destination
- If the project uses Laravel database notifications, reuse them rather than introducing a second Dashboard-only notification store.
- Unread state must be persisted, not only kept in browser memory.
- Notification links must use validated internal Admin destinations.
- Dashboard notification display is separate from **Push Notification Management**, which sends notifications to user segments.
- Normal Dashboard rendering must not mark every notification read automatically unless the product explicitly chooses that behavior.
- Exact read interaction is an Open Question.

### Real-time updates

- The source requires real-time or polling behavior for incoming notifications.
- The project architecture supports Laravel broadcasting consumed by React.
- Prefer the repository's shared notification/broadcast infrastructure.
- Real-time updates may refresh:
  - notification list/unread count
  - pending-action counts
  - selected KPI values when relevant events occur
- Real-time events must represent committed backend state.
- A broadcast failure must not affect the underlying business transaction.
- If broadcasting is unavailable, polling is an acceptable fallback.
- Dashboard must recover authoritative state through API refetch after reconnect/reload.

### System/platform health interpretation

- Source wording includes high-level "system health."
- Current project sources do not define technical infrastructure telemetry.
- For MVP, interpret health as **platform operational workload/status visible through existing domain data**, such as pending work or unresolved issues.
- Do not invent CPU, memory, queue latency, database health, or uptime monitors without a separate observability requirement.
- If technical health monitoring is later defined, integrate it as a separate authorized dashboard source.

### Charts

- Charts are optional unless a concrete source metric requires trend visualization.
- Any chart must:
  - use server-authoritative data
  - label units and time range
  - handle empty data
  - not imply precision the source data does not support
- Do not choose a chart library in the spec unless the repository already has one.
- Do not create a chart just because a Dashboard exists.

### Date ranges

- The Admin Dashboard source does not define a dashboard-wide date filter.
- If KPI trends or financial widgets use a date range:
  - Laravel must validate the range
  - use ISO 8601/timezone-aware boundaries
  - keep definitions consistent with Reports Overview
- Do not invent a default daily/weekly/monthly range as a MUST.
- Exact default period is an Open Question.

### Performance

- Dashboard aggregates may touch multiple tables.
- Avoid loading entire record collections to count/sum them in PHP or React.
- Use database aggregate queries such as `count`, `sum`, `avg`, or equivalent Eloquent aggregate methods.
- Avoid N+1 queries.
- Index fields commonly used for:
  - status counts
  - timestamps/date ranges
  - role filters
  - unresolved/open-state filters
- Expensive, stable aggregates may use Laravel cache.
- Cache only where freshness requirements allow it.
- Authorization decisions must never be cached in a way that grants stale access.
- Highly actionable counts should remain fresh enough for Admin operations.
- Exact cache TTL is an implementation decision based on measured query cost/freshness requirements.

### Loading and partial failure

- Dashboard must show explicit:
  - loading state
  - loaded state
  - empty state where applicable
  - forbidden state
  - error state
- One optional widget failing should not necessarily make the entire Dashboard unusable.
- Prefer a server response strategy that clearly identifies unavailable sections if partial responses are supported.
- Do not fabricate `0` when a query failed.
- A failed KPI should appear unavailable/error, not as a legitimate zero.

### Freshness and consistency

- A Dashboard is a summary and may not be transactionally consistent across every independent aggregate.
- Do not imply all cards were calculated at the exact same database instant unless the backend guarantees it.
- For cached or asynchronously updated metrics, expose freshness where useful.
- Navigating to the owning feature must fetch its current authoritative data before mutation.

### Security and privacy

- Dashboard DTOs must minimize sensitive information.
- Do not include:
  - password/security data
  - full identity documents
  - complaint evidence files
  - full payment credentials
  - private message bodies
  - internal secrets
- Mask PII according to shared project rules.
- Dashboard read requests normally do not create Admin audit entries merely for viewing aggregate cards unless audit policy explicitly requires view tracking.
- Any mutation triggered from a destination feature follows that feature's audit rules.

### Accessibility

- KPI cards must use meaningful text labels.
- Do not communicate status using color alone.
- Charts, if used, need textual/accessible equivalents for important values.
- Notifications and action-item lists must be keyboard navigable.
- Auto-updating regions must avoid disruptive focus changes.
- Real-time updates should use restrained accessible announcements.

### Acceptance criteria

- [ ] Guest cannot access Dashboard API/page.
- [ ] Authenticated non-Admin cannot access Admin Dashboard.
- [ ] Admin without Dashboard permission receives no Dashboard data when custom permissions apply.
- [ ] Dashboard opens after successful Admin login.
- [ ] Dashboard data comes from Laravel, not direct frontend database access.
- [ ] KPI values are produced from reproducible backend aggregate queries.
- [ ] Dashboard does not expose data from features the Admin is not authorized to view.
- [ ] Pending action items link to their owning Admin feature.
- [ ] Dashboard does not duplicate approval/compliance/dispute mutation workflows.
- [ ] Admin notifications are returned from authoritative backend state.
- [ ] Unread state is not browser-only.
- [ ] Notification real-time/polling updates can be recovered by API refetch.
- [ ] Failed optional widget is not silently rendered as zero.
- [ ] Money uses project-approved fixed precision.
- [ ] Sensitive PII/evidence/security fields are absent from Dashboard DTOs.
- [ ] Cached metrics, when used, have a defined freshness strategy.
- [ ] UI supports loading, empty, forbidden, error, and loaded states.
- [ ] Dashboard remains usable when no notifications/action items exist.
- [ ] Accessibility does not depend on color or pointer interaction alone.

## HOW

### Project findings

- `Admin.md` defines Dashboard as the primary Admin command interface for platform overview, KPIs, pending actions, and notifications.
- It explicitly calls for aggregate queries across users, transactions, and reports plus real-time or polling notification updates.
- Admin Authentication routes successful login to `/dashboard`.
- Other Admin features provide natural Dashboard sources:
  - Manage Account Registrations
  - Manage User Accounts
  - Seller Compliance
  - Complaints & Disputes
  - Reports Overview
- `README.md` requires:
  - Next.js/React presentation
  - Laravel-owned business data and authorization
  - Eloquent persistence
  - Laravel broadcasting for live dashboard changes
  - shared API client
  - explicit loading/error/forbidden states
- Exact application models, table names, dashboard routes, and KPI definitions were not available during research.

### Laravel API

- Prefer a dedicated read model/service, e.g. `AdminDashboardService` or `GetAdminDashboard`.
- Conceptual endpoint:

```http
GET /api/admin/dashboard
```

- The action/service should:
  1. authenticate Admin
  2. resolve feature permissions
  3. run only authorized aggregate queries
  4. gather authorized action-item summaries
  5. gather recent/unread Admin notifications
  6. map to a compact Dashboard Resource/DTO
- Keep controller logic thin.
- Avoid exposing raw Eloquent models.
- Separate expensive KPI query methods so they can be measured/cached independently.
- Use query-builder/Eloquent aggregate methods rather than hydrating full collections.
- Reuse domain query scopes/status definitions from owning features.

### Suggested response shape

```json
{
  "kpis": {
    "pendingRegistrations": 0,
    "openDisputes": 0
  },
  "actionItems": [],
  "notifications": [],
  "generatedAt": "2026-08-29T00:00:00Z"
}
```

- This shape is conceptual.
- Omit unauthorized/unimplemented widgets instead of returning misleading values.
- Exact metric names must match approved domain definitions.

### Notifications and broadcasting

- If the shared `User`/Admin model uses Laravel `Notifiable`, database notifications can provide persisted notification history/read state.
- Broadcast notifications can update the React Dashboard in real time.
- Use private authorized channels.
- Queue/broadcast after source transactions commit.
- On React reconnect, refetch Dashboard/notification state to reconcile missed events.

### Caching

- First measure aggregate query cost.
- Use no cache for inexpensive/action-critical counts when fresh queries are acceptable.
- For expensive/stable aggregates, use Laravel Cache `remember` or the repository's cache abstraction.
- Cache keys must include any scope/permission dimension that affects the value.
- Invalidate/expire based on source-domain changes.
- Never use stale cache to authorize access.
- Do not prematurely create precomputed analytics tables unless real query performance requires them.

### Next.js / React

- Implement `/dashboard` using the repository's router.
- Fetch through the shared Laravel API client.
- Render Dashboard sections based on the returned authorized DTO.
- Do not hard-code hidden KPI data in frontend configuration.
- Use client components only for:
  - real-time subscription
  - interactive chart/filter state
  - notification read actions
- Recommended UI hierarchy:
  1. KPI summary
  2. pending actions
  3. notifications
  4. optional trends/charts
- Cards/action rows link to owning feature routes.
- On real-time event:
  - update a safe local value when event payload is sufficient
  - otherwise invalidate/refetch affected Dashboard data
- Refetch on reconnect to recover missed state.

### Testing

- **Laravel tests:**
  - guest rejected
  - non-Admin rejected
  - custom Dashboard permission enforced
  - per-widget source permission enforced
  - aggregate definitions return expected counts/totals
  - archived/invalid statuses excluded correctly
  - money precision preserved
  - action items contain safe summary fields
  - notification read/unread data correct
  - sensitive fields absent
  - cached metric behavior when enabled
  - widget query failure is not represented as valid zero
- **Frontend tests:**
  - Dashboard loading/loaded/error/forbidden states
  - empty action/notification states
  - authorized KPI cards render
  - unauthorized widgets absent
  - action links navigate correctly
  - notification event updates/refetches
  - reconnect recovers state
  - no direct mutation workflow is duplicated
  - accessible card/list/chart behavior

### Research-backed recommendations

- Use Laravel query-builder/Eloquent aggregate methods for counts/sums instead of loading full datasets.
- Use Laravel database notifications for persisted Admin notification state when compatible with the existing model.
- Use broadcast notifications/events for real-time React updates when the broadcasting stack is configured.
- Cache only expensive aggregates whose freshness tolerance is defined.
- Keep the Dashboard a read model/composition layer; domain mutations stay in their owning feature.

### Risks

- **Undefined KPI semantics:** vague labels can produce misleading numbers.
- **Permission leakage:** aggregated counts can reveal restricted feature information.
- **Slow aggregate fan-out:** many independent full-table scans can make Dashboard load expensive.
- **Stale action counts:** excessive caching can mislead Admins about pending work.
- **False zero:** swallowing backend errors as `0` hides operational problems.
- **Feature duplication:** adding approval/dispute/compliance mutations to Dashboard creates competing workflows.
- **Notification duplication:** a Dashboard-only notification table would fragment the shared notification system.
- **Over-monitoring:** interpreting "system health" as infrastructure telemetry would invent scope not defined by current sources.

### Open questions

- Final MVP KPI list.
- Exact definitions for each KPI.
- Whether user totals should be split by role/status.
- Whether commission/revenue appears directly on Dashboard or only Reports Overview.
- Whether charts are required for MVP.
- Dashboard date-range/default period.
- Action-item priority/ordering rules.
- Number of recent action items/notifications shown.
- Notification mark-read interaction.
- Selected real-time broadcasting driver.
- Polling fallback interval.
- Whether Dashboard cards are individually permissioned.
- Cache TTL/invalidation strategy for expensive metrics.
- Whether technical infrastructure health will ever be in Dashboard.
- Exact Dashboard endpoint/DTO naming.

### Sources

- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Admin feature model: `Admin.md`
- Admin Authentication spec: `admin/auth/spec.md`
- Laravel Query Builder aggregates:
  - https://api.laravel.com/docs/12.x/Illuminate/Database/Query/Builder.html
- Laravel Eloquent relationship aggregates:
  - https://api.laravel.com/docs/12.x/Illuminate/Database/Eloquent/Concerns/QueriesRelationships.html
- Laravel Notifications:
  - https://laravel.com/docs/12.x/notifications
- Laravel Cache:
  - https://laravel.com/docs/12.x/cache
