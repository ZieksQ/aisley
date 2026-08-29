---
feature: dashboard
title: Seller Dashboard
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Dashboard
## WHAT
- **Purpose:** Give an authenticated Seller a tenant-scoped overview of shop performance, actionable Orders, Inventory alerts, reviews, traffic, and notifications.
- **Canonical role:** `SELLER`.
- `Seller.md` defines Dashboard as the centralized merchant interface for sales/statistics/charts, including revenue, order volume, and shop traffic. fileciteturn78file0
- The dedicated Seller Dashboard flow additionally requires:
  - revenue
  - Order count/status
  - Product/shop traffic
  - review summary
  - low-stock count
  - unread Seller notifications
  - pending fulfillment actions
  - selected date range
  - comparison period
  - currency
  - timezone
  - data-as-of timestamp
  - drill-down from cards/charts into matching Seller-scoped views
  - stale and partial-error states
- **Recommended route:**
```text
/seller
```
or:
```text
/seller/dashboard
```
- **Recommended flow:**
```text
Seller opens Dashboard / changes period
→ Laravel authenticates Seller
→ validates date range + timezone
→ applies seller/shop scope to every metric
→ aggregates independent dashboard sections
→ returns values + comparison + as_of
→ React renders cards/charts/action lists
→ metric click opens the matching filtered Seller view
```
- **Architecture:**
  - Next.js/React owns dashboard composition, date controls, KPI cards, charts, loading/stale/partial-error states, and drill-down navigation.
  - Laravel owns Seller scoping, metric definitions, financial semantics, aggregation, date boundaries, comparison periods, caching, and dashboard DTO.
  - Orders/Transactions/Inventory/Reviews/Analytics/Notifications remain authoritative; Dashboard does not create competing business records.
- **Feature boundaries:**
  - Generate Report owns detailed financial/performance analysis and export.
  - Order Notifications owns incoming actionable Orders and unread Order alerts.
  - Prepare Orders owns fulfillment mutation.
  - Inventory/Low Stock Alerts owns stock and threshold truth.
  - Review Management owns Review/reply data.
  - Seller Notifications/message domains own notification records.
  - Analytics owns Product/shop traffic if traffic tracking exists.
- **Non-goals:**
  - changing Orders/Inventory directly from KPI values
  - duplicating Generate Report exports
  - inventing Product/shop traffic if no Analytics events are modeled
  - calling net proceeds "profit" when Product cost is unavailable
  - exposing platform-wide confidential metrics
  - using client-side sums as authoritative Seller totals
## MUST
### Authentication and tenant isolation
- Dashboard requires authenticated `SELLER`.
- Apply Seller/shop scope **before every metric query**.
- Never trust client-supplied `seller_id` as authorization.
- Seller must never see:
  - another Seller's Orders
  - another Seller's revenue
  - another Seller's stock/reviews/traffic
  - platform-wide confidential totals
- All cache keys/materialized summaries must include Seller/shop identity.
- Frontend filtering is not tenant isolation.
### Dashboard request
- Conceptual endpoint:
```http
GET /api/seller/dashboard?from=2026-08-01&to=2026-08-29&timezone=Asia/Manila
```
- Laravel validates:
  - date format
  - `from <= to`
  - maximum supported range
  - timezone
  - allow-listed comparison/grouping options if exposed
- Exact default/max range is Open.
- Server must not accept arbitrary metric/query definitions from the browser.
### Date range semantics
- All period-based metrics use one normalized date-window definition.
- Convert Seller-selected local dates into explicit UTC query boundaries.
- Recommended interval:
```text
[from_inclusive, to_exclusive)
```
- Same range/timezone semantics must be shared with Generate Report.
- Exact day/week/month presets are Open.
### Comparison period
- Dashboard flow explicitly requires a comparison period.
- Recommended default:
```text
selected period
vs
immediately preceding period of equal duration
```
- Exact comparison rule is Open if business wants previous week/month/year instead.
- Laravel returns both current/comparison values or a safe delta.
- React does not independently choose different comparison boundaries.
### Data-as-of timestamp
- Response must include:
```text
data_as_of
```
- Represents when dashboard metric data was calculated/read.
- Cached/stale sections must expose freshness honestly.
- Render server UTC timestamp in Seller locale.
- Do not label cached metrics "live" without appropriate freshness.
### Currency
- Financial metrics include explicit currency.
- Use fixed-precision money.
- Do not sum incompatible currencies unless AISLEY defines conversion.
- Multi-currency behavior is Open.
- React formats money; Laravel owns authoritative amounts.
### Revenue terminology
- Dashboard source requires revenue, but financial cards must distinguish lifecycle/payment meanings.
- Dedicated Dashboard flow explicitly says financial cards distinguish:
```text
placed
paid
refunded
settled
```
- Do not collapse all of these into one ambiguous `revenue` number.
- Recommended headline financial metric is one explicitly defined value such as:
  - gross paid sales, or
  - net proceeds
- Final label/definition must match Generate Report.
### Profit vs net proceeds
- Generate Report source says:
  - if Product cost is modeled, profit may be calculated
  - without cost data, label the value `net proceeds`, not profit
- Dashboard must follow the same rule.
- Do not infer profit as:
```text
sales - platform fee
```
if cost of goods is unknown.
### Financial reconciliation
- Dashboard financial totals must reconcile with Generate Report for identical Seller/date/status definitions.
- Dashboard may display fewer summary fields, but definitions must be shared.
- Refunds/reversals must not disappear from totals.
- Pending and settled values remain distinct.
- A card click should route to the report/order view capable of explaining the total.
### Order metrics
- Dashboard may aggregate Seller-owned Order count/status.
- Use canonical Order lifecycle, not dashboard-specific statuses.
- Recommended summary groups:
  - new/actionable
  - processing
  - ready/fulfillment
  - in delivery
  - delivered/completed
  - cancelled/failed/exception
- Exact UI grouping is Open and must map explicitly to canonical statuses.
- Dashboard grouping labels are presentation only.
### Pending fulfillment
- Source explicitly requires pending fulfillment actions.
- Derive from Order states/actions owned by Seller fulfillment.
- Do not equate unread notification with pending fulfillment.
- Order Notifications source says read state and fulfillment state remain distinct.
- Clicking pending fulfillment should open the corresponding Seller-scoped filtered Order/Prepare Orders view.
### New Order indicator
- New-order count/badge may use Order Notifications/inbox state.
- Valid Seller Orders appear once after configured payment/confirmation condition.
- Failed payment/cancelled Orders must not appear as ordinary actionable new Orders.
- Realtime event may refresh badge/list after committed new-order event.
### Low-stock metric
- Derive from Seller Inventory/Low Stock Alerts.
- Recommended:
  - active low-stock alert count, or
  - count of Seller SKUs currently at/below configured threshold
- Final definition must be explicit and consistent with Low Stock Alerts.
- Do not calculate stock from Product-level duplicated fields.
- Clicking metric routes to Seller Inventory filtered to affected SKUs.
### Inventory freshness
- Inventory metric uses committed `available`/alert state.
- Inventory events may invalidate/refresh low-stock indicators after commit.
- A transient dashboard cache must never become Inventory authority.
### Review summary
- Dashboard flow requires a Review summary.
- Use Reviews associated only with Seller-owned Products.
- Recommended fields when supported:
  - review count in period
  - average rating
  - unanswered Review count
- Exact fields are Open.
- If rating scale is configurable, do not hard-code a 5-star denominator in backend assumptions.
- Clicking routes to Review Management.
### Shop/Product traffic
- `Seller.md` requires shop traffic and mentions an `Analytics` source. fileciteturn78file0
- Dashboard may show Product/shop traffic **only if Analytics events/records exist**.
- Possible metrics:
  - shop views
  - Product views
- Do not invent unique visitors, conversion rate, impressions, click-through rate, or sessions unless Analytics defines them.
- Traffic metric definitions must be documented.
- Analytics must remain Seller-scoped.
### Conversion metrics
- Conversion rate is not source-required; add it only if Analytics defines an explicit numerator/denominator.
### Notifications
- Dashboard loads unread Seller notifications/action summaries.
- Do not duplicate notification ownership/state inside Dashboard.
- Notification reads/deep-links use their owning feature.
- Recommended Dashboard only shows a bounded recent subset plus unread count.
- Full notification list remains paginated elsewhere.
### Action list
- Recommended actionable Dashboard items:
  - new Orders
  - pending fulfillment
  - low-stock SKUs
  - unread notifications
  - unanswered Reviews only if Review Management defines this state
- Do not introduce unsupported operational tasks.
- Every item deep-links to the owning Seller feature.
### Drill-down
- Source explicitly requires selecting a metric to open the matching Seller-scoped filtered view.
- Example:
```text
low_stock_count
→ /seller/inventory?stock=low

pending_fulfillment
→ /seller/orders?status=...

review_summary
→ /seller/reviews?...
```
- Exact route/query parameter names follow actual route contracts.
- Filters on target pages are still server validated.
### Aggregate queries
- Calculate counts/sums/averages in Laravel/database, not by fetching all rows into React.
- Laravel Query Builder provides aggregate functions including `count`, `avg`, and `sum`. citeturn501158view1
- Select only fields needed for lists/previews.
- Add indexes appropriate to:
  - Seller ID
  - timestamps
  - Order/payment status
  - Product/SKU ownership
  - Review/Product relation
- Exact indexing follows final schema/query plans.
### Single dashboard DTO
- Recommended one Seller Dashboard API response containing independent sections:
```text
period
financial
orders
inventory
reviews
traffic
notifications
actions
data_as_of
errors[]
```
- This centralizes date/scope semantics.
- Sections remain independently computed so one failure need not destroy all others.
### Partial failures
- Dedicated Dashboard flow requires a marked partial response when one metric fails.
- Example:
```json
{
  "financial": { "...": "..." },
  "traffic": null,
  "errors": [
    { "section": "traffic", "code": "METRIC_UNAVAILABLE" }
  ]
}
```
- Do not silently replace failed values with zero.
- `0` means authoritative zero; `null/unavailable` means metric failed/unavailable.
- HTTP status strategy for partial success is Open; response must make section failure explicit.
### Empty data
- No Orders/traffic/reviews in a valid period is not an error.
- Return valid zero/empty series with normal section state.
- Differentiate:
  - zero data
  - metric unavailable
  - request validation error
  - whole-dashboard service failure
### Chart series
- Server returns chart-ready time buckets using one timezone/grouping rule.
- Recommended:
```text
bucket_start
value
```
- Missing bucket periods should be returned/normalized as zero only when the metric truly has zero activity.
- Do not let each chart independently reinterpret date boundaries.
- Exact chart types/library are Open.
### Chart library
- Source requires charting but selects no library; use the repository-standard React chart library.
- Charts still need textual summaries for accessibility.
### Caching
- Dashboard is read-heavy and aggregated; bounded caching is recommended where queries are expensive.
- Cache key must include at least:
```text
seller/shop ID
date range
timezone
metric/version
```
- Never use one global Seller-dashboard cache value.
- Database remains authoritative.
- Exact TTL is Open and metric-specific.
### Stale-while-revalidate
- Dashboard source explicitly has a stale UI state.
- Laravel 12 `Cache::flexible()` supports stale-while-revalidate: serve a bounded stale value while recalculating after the response. citeturn501158view0
- This is a recommendation, not mandatory.
- If used:
  - return `data_as_of`
  - mark stale section
  - bound stale duration
  - never use stale dashboard value for mutations/settlement decisions
### Cache invalidation
- Events that may refresh/invalidate relevant metric caches include:
  - Order placed/state/payment changes
  - refund/settlement changes
  - Inventory availability/low-stock changes
  - Review creation/response if relevant
  - Analytics ingestion
- Event invalidation is an optimization; TTL/recalculation must recover from missed invalidations.
- Use after-commit events so Dashboard does not refresh from rolled-back data.
### Realtime
- Realtime is supplementary for new-Order, low-stock, and unread-notification indicators.
- On committed events, React may refetch affected Dashboard data; full financial/chart recomputation per event is unnecessary.
- Database/API remains authoritative.
### Next.js data fetching
- AISLEY architecture requires Next.js to consume Laravel APIs rather than directly query the database.
- Current Next.js dashboard guidance supports server-side data fetching and notes parallel independent fetching can avoid request waterfalls. citeturn308191search0
- For AISLEY, prefer:
  - one Laravel dashboard endpoint, or
  - parallel Laravel API section requests if architecture intentionally splits them
- Do not copy Next.js examples that query the DB directly because that conflicts with AISLEY's Laravel-authoritative boundary.
### Performance
- Aggregate in Laravel/database, keep previews bounded, profile/index slow queries, and reserve large historical analysis for Generate Report.
### Financial/security privacy
- Never expose Buyer payment credentials, other Sellers' transactions, or unrelated platform-confidential totals.
- Aggregate KPIs need no Buyer identity; actionable Order previews expose only fulfillment-needed data.
### Frontend states
- Whole page: loading, loaded, partial, stale, error.
- Section: loading, loaded, empty, unavailable, stale.
- Date control: valid, applying, invalid.
- Realtime: connected/reconnecting/refetching where shown.
- Never display failed metrics as authoritative zero.
### Accessibility
- Use descriptive KPI labels, non-visual chart summaries, non-color-only trends, keyboard-accessible date/drill-down controls, and textual stale/partial-error states.
### Acceptance criteria
- [ ] Every Dashboard metric is Seller-scoped server-side.
- [ ] Seller cannot access another Seller/platform-wide confidential totals.
- [ ] Date/timezone semantics are consistent across all sections.
- [ ] Financial labels distinguish paid/refunded/settled states and never call net proceeds profit without cost data.
- [ ] Dashboard totals reconcile with linked Seller records/Generate Report definitions.
- [ ] Order/pending-fulfillment metrics map to canonical lifecycle/actions.
- [ ] Low-stock count uses authoritative Inventory/alert state.
- [ ] Review summary uses only Seller-owned Product Reviews.
- [ ] Traffic is shown only when authoritative Analytics data exists.
- [ ] Each metric/action deep-links to a matching Seller-scoped view.
- [ ] Response includes currency/timezone/comparison/data-as-of metadata.
- [ ] One failed metric is marked unavailable rather than zeroing/breaking the entire Dashboard.
- [ ] Cached/stale metrics identify freshness and never become mutation authority.
- [ ] Realtime updates/refetches new-order/inventory indicators from committed state.
- [ ] Dashboard does not duplicate detailed reporting/export functionality.
## HOW
### Project findings
- `Seller.md` requires revenue, order volume, shop traffic, statistics, charts, and Seller-specific scope. fileciteturn78file0
- The dedicated Dashboard flow additionally requires Order-status totals, Review summary, low-stock count, unread notifications, pending fulfillment, comparison period, currency/timezone, `data_as_of`, drill-down, realtime/refresh, stale states, and partial errors.
- Generate Report defines the financial semantics Dashboard should reuse: gross sales/discounts/refunds/platform fees/net proceeds, separate pending/settled amounts, and profit only when Product cost exists.
- Order Notifications defines the actionable Order inbox and keeps unread state distinct from fulfillment state.
- Low Stock Alerts defines Seller-owned SKU threshold state and committed availability transitions.
- Current source does not define exact KPI labels/formulas, traffic event schema, chart library, default range, comparison rule, cache TTL, or realtime driver.
### Recommended Laravel endpoint
```http
GET /api/seller/dashboard
```
Query:
```text
from
to
timezone
comparison optional
```
Response:
```text
period
financial
orders
inventory
reviews
traffic
notifications
actions
data_as_of
is_stale
errors[]
```
- Use an explicit `SellerDashboardResource`/DTO rather than raw Eloquent models.
### Recommended services
```text
GetSellerDashboard
GetSellerFinancialSummary
GetSellerOrderSummary
GetSellerInventorySummary
GetSellerReviewSummary
GetSellerTrafficSummary
GetSellerDashboardActions
```
- Every service receives already-authenticated Seller + normalized period.
- Reuse underlying Report/Inventory/Notification metric definitions rather than duplicating formulas.
### Recommended financial DTO
```text
gross_paid_sales
refunds
net_sales_or_net_proceeds
pending_amount
settled_amount
currency
comparison
```
- Only include fields that actual Transaction/ledger schema can define correctly.
- Do not return a fake `profit`.
### Recommended chart DTO
```text
series: [
  { bucket_start: "...", value: "..." }
]
grouping: day|week|month
timezone: "Asia/Manila"
```
- Grouping rule is server-controlled/validated.
### Cache recommendation
- Start without complex caching if indexed Seller/date aggregates are fast.
- When needed:
```text
seller_dashboard:{seller}:{range}:{timezone}:{metric_version}
```
- Laravel's cache supports `remember`, and `Cache::flexible()` is available for bounded stale-while-revalidate behavior. citeturn943414view0turn501158view0
- Keep `data_as_of` inside cached payload.
### Next.js / React
Recommended:
```text
/seller/dashboard
├── DashboardDateRange
├── FinancialKpiCards
├── SalesTrendChart
├── OrderStatusSummary
├── PendingFulfillmentList
├── LowStockCard
├── ReviewSummaryCard
├── TrafficSummary
└── NotificationPreview
```
- Interactive date/chart/filter controls use Client Components where needed.
- Initial Dashboard data may be loaded server-side through the shared Laravel API client.
- Next.js guidance favors server-side dashboard fetching and avoiding unnecessary request waterfalls. citeturn308191search0
### Tests
- **Laravel:** Seller isolation; dates/timezones; financial definitions/comparison; Order grouping; low stock; Reviews; traffic unavailable-vs-zero; unread/actions; partial errors; cache scope/freshness.
- **Reconciliation:** Dashboard totals match Generate Report/Inventory/Order source records for identical filters.
- **Frontend:** loading/empty/partial/stale/error; charts/cards; dates; drill-down; realtime refetch; accessibility.
### Risks
- **Tenant leakage:** a missing Seller predicate/cache key can expose another shop.
- **Metric ambiguity/drift:** vague or duplicated formulas can mislabel revenue/profit or disagree with Reports/Inventory.
- **Staleness/traffic invention:** aggressive cache or nonexistent Analytics can mislead Sellers.
- **Dashboard bloat:** duplicating Generate Report increases scope/query cost.
### Open questions
- Date presets/max range and comparison rule.
- Financial cards/ledger definitions and whether Product cost exists.
- Order presentation groups; Review summary fields.
- Analytics traffic schema.
- Chart library/types.
- Cache TTL/stale/invalidation and realtime scope/driver.
- Multi-currency behavior, route, and actionable-preview limits.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller source: `Seller.md`
- Seller flow: `feature-system-flows/seller/dashboard.md`
- Seller flow: `feature-system-flows/seller/generate-report.md`
- Seller flow: `feature-system-flows/seller/order-notifications.md`
- Seller flow: `feature-system-flows/seller/low-stock-alerts.md`
- Laravel 12 Query Builder: https://laravel.com/docs/12.x/queries
- Laravel 12 Cache: https://laravel.com/docs/12.x/cache
- Next.js Dashboard Data Fetching: https://nextjs.org/learn/dashboard-app/fetching-data
