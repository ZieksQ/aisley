# AISLEY: What to implement next

Reviewed: 2026-10-07. Repository baseline: `fc3c454` (Seller pickup/checkout routing lock fix), including `f2083df` (connected COD lifecycle verification), `3aecd88` (versioned sorting and exception recovery), and `e97f99d` (POD policies and Courier cash remittance).

This roadmap separates implemented system behavior from proposed work. Current-state claims below follow the canonical specifications and inspected source at the recorded baseline. Existing verification results are attributed to their original runs; no application tests, external Flutter builds, authenticated flows, or device checks were rerun for this documentation refresh.

**Best next new feature: Seller bulk product import/export.** It has a detailed, bounded CSV-first specification and builds directly on the existing catalog and Inventory services. Before expanding commerce, close the Order address-safety and Seller Finance reporting gaps, and verify external Buyer/Courier adoption of current contracts. Pickup-versus-activation and checkout-versus-pickup lock inversions are already fixed; preserve that ordering in later work.

## What already exists

| Area | Existing foundation to extend |
| --- | --- |
| Customer | Public storefront browsing/search, Product/Shop pages, account/address book, Cart, COD Checkout, provider selection, voucher usage, Orders/tracking/cancellation, Wishlist, recency, questions/reviews, chat, notifications, and support tickets. |
| Seller | Registration/approval, catalog/media/variants, SKU Inventory and low-stock controls, Order approval/preparation/pickup, enabled shipping providers, Finance, product questions/reviews, chat, and support. |
| Admin | Registration/account administration, permissions/audit, dashboard, compliance, shared policies/settings, homepage advertisements, notification campaigns, support tickets, Finance/holds, pricing, COD automation settings, manual remittance review, payout controls and gateway simulation. |
| Logistics | Sole-hub operations, Courier approval, pickup scheduling, receiving, immutable sort-plan versions and activation schedules, lane Pause/Hold/Resume, durable exception recovery, offline capture reconciliation, final-mile dispatch, POD Pending/History/Approval settings, Courier cash receipts, masked simulated Billing, COD invoices/collections, company fleet/linehaul, shipping rates, chat, notifications and support. |
| Courier | API authentication/account/vehicle, task/batch reads/actions, first-mile pickup, final-mile handoff/photo POD/COD acknowledgement, correction reasons, confirmed delivery history, failed attempts, chat, notifications and support. Dashboard aggregation and password recovery remain scaffolds. |
| External Flutter | Previous bundle reports describe Buyer Phase 1–4 implementation/Phase 5 tooling and several Courier workflows. Runtime code is outside this repository. This refresh does not establish newer client adoption or change their completion status; backend/web results and installed-device evidence remain separate. |

Some specification headers still say Draft even where source implements the feature. The opportunities below use narrower source-confirmed gaps; do not rebuild auth, catalog, Checkout, messaging, support tickets, or hub operations wholesale. Start with [requirements](../requirements.md), [architecture](../architecture.md), [workflows](../workspace.md), and [progress](../PROGRESS.md).

## Current system logic to preserve

| Workflow | Implemented rule |
| --- | --- |
| Checkout and inventory | Customer checkout is COD-only, creates one Order per Shop, freezes provider/prices/items/recipient facts and reserves stock once. Seller approval advances `placed → seller_processing` without fulfilling stock. Approved first-mile `picked_up_from_seller` fulfills the reservation once; eligible cancellation/rejection before pickup releases it once. |
| Seller pickup and locking | Pickup is Seller/Shop scoped, uses the checkout-selected eligible provider, and atomically creates readiness history, request links and immutable waybills. Checkout placement and pickup creation acquire the shared routing-settings gate before domain locks; activation/recovery acquire that gate before the hub. Do not reintroduce hub/inventory-before-gate acquisition in a transaction that later reads authoritative routing. |
| Sort-plan changes | Draft edits leave the active published version untouched. Publication freezes a version; explicit immediate or one-time scheduled activation selects it. Scheduler and authoritative reads recover overdue activations; failed activation retains the previous version. New pickup hints use the active selection, exact pickup replay preserves its committed hint, and later physical scans recheck the current published version. |
| Sorting and dispatch evidence | Successful scans freeze version, lane labels and postal/committed-hop destination. Activation or lane renaming does not rewrite assignments, schedules, reservations, dispatch history, commercial routes or Customer totals. An explicit reasoned move records new and previous evidence. Pause/Hold redirects new scans to the protected open exception lane and blocks affected dispatch/hub pickup while preserving staged work for Resume. |
| Exceptions and offline capture | Outstanding exceptions remain received, require configuration correction and automatic rescan, and may require documented damage release. Recovery sessions are bounded to 1–100 selected Shipments. Session closure requires reconciled captures and explicit exception carry-over. Offline captures are Pending verification; only API-confirmed routing is actionable, and uncertain submissions retain the exact key/payload. |
| POD and delivery | Courier photo/completion intent is pending evidence. Shared finalization commits delivery only after Logistics approval or eligible configured automatic prepaid approval. Manual review is the default; COD always requires manual approval and explicit cash acknowledgment. Rejected proof requires correction without marking delivery failed or paid. Prepaid fulfillment support does not enable prepaid checkout/payment capture. |
| Cash and settlement | Confirmed COD marks Customer payment paid and creates separate collector-owned platform invoice and final-mile Courier cash obligation. Receiving a Courier's full selected balances credits the organization's simulated account once; it does not clear platform invoices or create Seller payouts. Only verified remittance clearing funds eligible unheld payouts. A multi-provider Order retains its selected pickup provider while the final collecting organization owns invoice/cash obligations. |
| Automation and Billing | Existing queue/scheduler recover due activations, eligible prepaid approvals, COD invoice documents/alerts and Finance work. Logistics Billing exposes masked account metadata; new simulated accounts start at zero and existing balances are preserved. Simulation moves no real money; live payment, production payout and prepaid settlement integrations remain separate work. |

Canonical contracts: [Checkout](../features/customer/checkout-order/spec.md), [Seller readiness](../features/seller/prepare-orders/spec.md), [pickup creation](../features/orders/logistics-pickups/spec.md), [sort versions/recovery](../features/orders/logistics-sorting/versions-and-recovery.md), [delivery confirmations](../features/logistics/delivery-confirmations/spec.md), [Courier cash](../features/logistics/courier-cash-remittance/spec.md), [Billing](../features/logistics/billing/spec.md), and [COD automation](../features/shared/cod-automation/spec.md).

## Completed verification and remaining acceptance

- `f2083df`: 210 SQLite regressions/3,080 assertions; two connected PostgreSQL local/linehaul lifecycle scenarios/248 assertions; 11 PostgreSQL concurrency checks/240 assertions. Checkout through Logistics-confirmed delivery and verified-purchase review is covered by connected backend tests; see the [lifecycle verification report](../features/shared/shipment-fulfillment/verification.md).
- `fc3c454`: reproduced and fixed pickup-versus-activation and checkout-versus-pickup deadlocks. Final focused runs passed 39 SQLite tests/939 assertions and six PostgreSQL snapshot/concurrency tests/112 assertions. Pickup replay retained its old hint after activation; a new pickup recorded the newly active version. See the dated [progress entry](../PROGRESS.md) and [regression tests](../../src/api/tests/Feature/Seller/SellerPickupSortingConcurrencyTest.php).
- Sorting and POD/Finance revisions have their own bounded browser/backend evidence in the progress log and [Sorting verification report](../features/orders/logistics-sorting/verification.md). These results do not establish a complete marketplace browser flow, physical scanner/dock acceptance, external Flutter adoption, live Azure/email/payment integration, or production worker/scheduler operation.
- Keep the remaining release checks below open. Recorded successful races are regression coverage; other concurrency/recovery combinations require their own evidence rather than repeating a blanket claim that lifecycle/concurrency verification is absent.

## Recommended priorities

P0 closes an existing contract or correctness gap. P1 delivers a bounded improvement. P2 needs further domain decisions before implementation. Effort is relative: M spans several layers; L introduces a substantial workflow or cross-role coordination. These are scope estimates, not delivery dates.

| ID | Priority | Opportunity | Where the work belongs | Effort |
| --- | --- | --- | --- | --- |
| 01 | P0 | Safe Order address corrections | Customer API and storefront; Buyer contract | M |
| 02 | P0 | Current shipping/auth contract adoption in Flutter | External Buyer/Courier projects; contract docs here | M–L |
| 03 | P1 | Seller CSV product import/export | Seller dashboard, catalog API, queue/storage | L |
| 04 | P0 correctness; P1 exports | Accurate Finance reports and usable exports | Shared Finance API; Seller/Admin/Logistics panels | M–L |
| 05 | P1 | Complete Courier password recovery | Courier API and external mobile client | M |
| 06 | P1 | Checkout recovery after an app restart | Customer API; external Buyer, later storefront if needed | M–L |
| 07 | P1 | Support reply alerts and Customer unread totals | Support/notification APIs and affected clients | M |
| 08 | P1 | Real Courier dashboard summary | Courier read API and external mobile client | M |
| 09 | P1 | Bounded image processing and safe asset projections | Existing upload services/resources and policies | M–L |
| 10 | P2 | Admin/Seller voucher authoring | Admin/Seller dashboards and scoped API | L |
| 11 | P2 | Courier availability and capacity monitoring | Courier API/client and Logistics dashboard | L |
| 12 | P2 | Courier incident reporting with dispatch follow-up | Courier API/client and Logistics operations | L |
| 13 | P2 | Customer application status and registration completion | Customer auth, Admin approval, external Buyer | L |

## Implementation slices

### 01. Make Order address corrections commercially safe

- **Finding:** [CustomerOrderMutationService](../../src/api/app/Services/Customer/CustomerOrderMutationService.php) checks ownership, completeness, eligibility, and revision, then writes a new address snapshot. It does not recalculate coverage/shipping. Buyer gap G21 limits the external UI to recipient/contact corrections at the same location.
- **First slice:** enforce that same-location restriction in Laravel too, comparing normalized address fields and coordinates against the committed snapshot. Return a documented conflict for a location change; keep the storefront's choices consistent with the server.
- **Boundary:** preserve the selected provider, checkout pricing, vouchers, COD, reservation, snapshot history, and the existing `placed` window. A later relocation/requote workflow needs explicit approval of provider, funding, price-change consent, and downstream regeneration rules.
- **Done when:** another-location/address-pin change cannot silently retain an obsolete quote; contact-only corrections remain versioned and idempotent; stale revisions, foreign addresses, Seller acceptance races, and legacy snapshots have focused API/UI coverage.
- **Read/update:** [Order modification spec](../features/customer/order-modification-cancellation/spec.md), [Checkout spec](../features/customer/checkout-order/spec.md), [shipping contract](../docs-mobile-buyer/api/shipping-selection.md), and [Buyer gaps G21/G25](../docs-mobile-buyer/references/integration-gaps.md).

### 02. Adopt the current backend contracts in the external clients

- **Finding:** the prior Buyer bundle reports implementation against `57e9eb2` and shipping DTO adoption gap G25; prior Courier notes identify Auth/recovery and batch-route/failed-attempt/linehaul adoption gaps. Those historical reports do not establish adoption of the current baseline. Current Courier task projections also carry frozen sorting assignment/lane context and blocked-pickup reasons, with Logistics-owned handoff validation and POD correction behavior.
- **First Buyer slice:** consume `POST /api/v1/customer/checkout/logistics-options`, select an enabled provider per Shop, freeze `logistics_selections` in quote/place intent, and parse current quote/Batch fields and nullable Order `shippingProvider`.
- **First Courier slice:** verify current Auth denial/duplicate responses and truthful recovery-unavailable presentation, task sorting/lane/blocked-handoff fields, pending completion and POD correction reasons. Add advisory batch-route/failed-attempt views separately; linehaul reads do not grant Logistics trip actions. Confirm actual external source before treating any previously reported screen gap as still open.
- **Done when:** empty/single/multiple provider choices, invalid/disabled providers, rate failures, changed quote intent, exact-key replay, and legacy null providers pass controlled client/API checks; record the actual adopted commit plus authenticated/device evidence.
- **Boundary/reference:** client code changes belong to the external projects. Preserve storefront guest browsing and guest recency; required sign-in/account-only recency are Buyer Flutter decisions. Read the [Buyer bundle](../docs-mobile-buyer/README.md) and [Courier bundle](../docs-flutter-rider/README.md).

### 03. Build Seller bulk product import/export

- **Finding:** [the CSV-first spec](../features/seller/bulk-product-import-export/spec.md) explicitly says its routes, jobs, tables, and screens are unavailable; the current [Seller router](../../src/seller/src/App.tsx) has no bulk workflow.
- **First slice:** download a versioned template/export, upload one CSV in create or update mode, validate a private dry run, review row differences/errors, explicitly confirm valid rows, then show progress and downloadable results.
- **Approach:** reuse [ProductCatalogService](../../src/api/app/Services/Seller/ProductCatalogService.php) and Inventory initialization. Follow the existing 2 MiB/1,000-record limits, queued chunks of at most 50 rows, per-row transactions, Shop scoping, revision checks, and durable replay records.
- **Boundary:** simple Products only; creates are draft with zero stock. Keep variants, XLSX, images/Markdown, stock edits, and publication out of the first release.
- **Done when:** preview changes no catalog data; foreign IDs and malformed files fail safely; worker retries/crashes never duplicate Products/SKUs; partial outcomes reconcile; Seller mobile/light/dark/keyboard flows work.
- **Implementation basis:** dispatch queue work after durable commit ([Laravel queue transactions](https://laravel.com/framework/docs/13.x/queues#jobs-and-database-transactions)); test the spec's spreadsheet-safe encoding after save/reopen in supported clients ([OWASP CSV injection](https://community.owasp.org/attacks/CSV_Injection)).

### 04. Improve Finance correctness before adding more charts

- **Finding:** [FinanceReportService](../../src/api/app/Services/Finance/FinanceReportService.php) filters Seller remittance batches by owned allocations but sums whole batch totals. Its workspace combines all-time totals with current-month closure state; reporting-period consistency and bounded exports remain work. The scoped ledger already supports bounded pagination and search.
- **First slice:** use owned allocation totals for Seller aging; reconcile provisional/actual labels with the periods that can actually close; define a consistent reporting-period contract before exposing new filters.
- **Next slice:** extend the existing paginated scoped ledger and owned Order drill-down with consistent reporting filters and bounded exports, export failures/loading, and spreadsheet-safe text cells. Keep unknown cost visible instead of implying zero; do not rebuild working pagination as an absent feature.
- **Done when:** a mixed-Shop remittance exposes only the requesting Shop's amounts; role totals reconcile to owned ledger lines; period boundaries and CSV output match the selected view; permission loss clears private reports.
- **Boundary/reference:** preserve confirmed-delivery recognition, collector-owned invoices, separate Courier cash receipts, cleared COD funding, financial holds, automated/manual payout reservations, and sandbox labels. Invoice outstanding/cleared, Courier cash outstanding/received, Customer paid and beneficiary eligible/paid are distinct states. Read [Seller reports](../features/seller/generate-report/spec.md), [Admin reports](../features/admin/reports-overview/spec.md), and existing [Finance tests](../../src/api/tests/Feature/Finance).

### 05. Complete Courier password recovery

- **Finding:** [Courier AuthController](../../src/api/app/Http/Controllers/Courier/AuthController.php) currently returns “Courier password recovery is not available yet.” No reset delivery/completion flow exists.
- **First slice:** role-scoped reset issuance, an approved email/reset destination or mobile handoff, expiring single-use tokens, reset completion, throttling, and an explicit bearer-token revocation policy.
- **Approach:** reuse the repository's role-aware reset conventions; default email-only lookup is insufficient because `unique(email, role)` allows the same address in different roles. Laravel provides configurable providers/brokers, but project role scoping remains mandatory ([password reset docs](https://laravel.com/framework/docs/13.x/passwords)).
- **Done when:** a Courier reset cannot alter a same-email Customer/Seller; expired/reused tokens fail; delivery failures stay recoverable; responses avoid account enumeration; reset never grants pending/rejected accounts operational access.
- **Read/update:** [Courier Auth spec](../features/courier/auth/spec.md), current Customer/Seller/Logistics reset implementations, and the external Courier's recovery presentation. Decide the reset destination before adding a client screen.

### 06. Recover uncertain Checkout after an app restart

- **Finding:** Buyer G12 records memory-only pending mutation intent and no placement-by-key read. [CheckoutService](../../src/api/app/Services/Customer/CheckoutService.php) already replays an exact placement key/body; a new idempotency implementation is unnecessary.
- **First slice:** define an authenticated Customer-scoped recovery lookup for a prior placement key and a minimal protected client record containing the exact approved replay intent. Persist no bearer token or unnecessary address/payment data in that record.
- **Boundary:** an unresolved request is not a failed Order. Refetch/reconcile before retry; retain the same key/body for the same intent and require a new quote/key for a new purchase. This adds recovery, not unattended offline ordering.
- **Done when:** app termination immediately before/after server commit, network loss, changed account, expired quote, and changed payload cannot duplicate Orders, reservations, or voucher redemptions; logout/account loss clears private recovery state.
- **Read/update:** [Checkout spec](../features/customer/checkout-order/spec.md), [shipping replay rules](../docs-mobile-buyer/api/shipping-selection.md), and [G12](../docs-mobile-buyer/references/integration-gaps.md). Lookup retention and protected storage policy must be specified before implementation.

### 07. Add useful alerts to existing support and notifications

- **Finding:** tickets already work across roles, but [SupportTicketWriter](../../src/api/app/Services/Support/SupportTicketWriter.php) has no notification fanout. Customer has list/detail/read endpoints, but no global unread-count/read-all contract (G13/G17).
- **First slice:** after-commit notifications for opposite-party replies/status changes, with deduplication by committed ticket event and role-correct destinations. Then add separate Customer-owned unread-count and bounded read-all operations.
- **Boundary:** ticket read markers and notification read state remain distinct. Count the complete owned notification scope, not unread items on one page. Native push/device registration and support attachments are later features.
- **Done when:** retried events create one alert; rollbacks create none; notification failure preserves the reply; foreign recipients cannot read it; global counts/read-all stay correct during concurrent delivery and reading.
- **Read/update:** [Admin Support spec](../features/admin/support-ticket-system/spec.md), [Customer Support spec](../features/customer/support-tickets/spec.md), existing role notification contracts, and [Buyer notification gaps](../docs-mobile-buyer/references/integration-gaps.md). Define new Customer operations separately from existing routes.

### 08. Replace the Courier dashboard aggregate scaffold

- **Finding:** [DashboardController](../../src/api/app/Http/Controllers/Courier/DashboardController.php) returns empty data and `OPERATIONAL_SCHEMA_DEFERRED` for notifications, available tasks, and active tasks even though their separate APIs exist.
- **First slice:** a bounded read-only aggregate of unread notifications and task/batch previews with server time, freshness, stable identifiers, and navigation targets; reuse existing scoped readers and eligibility rules.
- **Boundary:** distinguish first-mile tasks from atomic final-mile batch acceptance; company-truck trip reads remain separate. Dashboard reads must not accept work, clear notifications, or claim earnings/live location.
- **Done when:** summaries agree with authoritative task endpoints, remain within the Courier's active affiliation/hub, show unavailable sections truthfully, and never turn stale cached previews into actionable authority.
- **Read/update:** [Courier Dashboard spec](../features/courier/dashboard/specs.md), [existing dashboard tests](../../src/api/tests/Feature/Courier/CourierDashboardTest.php), and the external client's separate preview controllers.

### 09. Close documented image-processing and asset-privacy gaps

- **Finding:** Buyer G15/G24 flag missing demonstrated bounded full decode/rewrite, numeric dimension ceilings, uncertain multipart replay, and a registration Resource's raw profile path field. [CustomerAccountService](../../src/api/app/Services/Customer/CustomerAccountService.php) inspects image metadata; that alone does not prove the complete processing policy.
- **First slice:** audit the affected upload paths, remove raw storage paths from public Resource projections, then centralize bounded decode/validation and metadata stripping for confirmed gaps. Set per-purpose edge/pixel ceilings through the shared policy before enforcing values.
- **Next slice:** safe orphan cleanup and replay/reconciliation contracts for profile/review uploads. Inventory all existing asset lifecycles before introducing shared cleanup.
- **Done when:** malformed/spoofed/oversized-dimension inputs fail within bounded resources, private evidence remains authorized, EXIF is handled, retries cannot silently attach duplicate media, and legitimate assets survive cleanup.
- **Read/update:** [upload requirements](../references/file-upload-requirements.md) and affected upload specs. Use the existing JPEG/PNG/WebP, under-10-MiB policy; other formats need their own policy ([OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)).

### 10. Add voucher authoring for Admin and Seller

- **Finding:** [Customer voucher usage](../features/customer/voucher-usage/spec.md) implements eligibility, calculation, snapshots, and redemption. Admin App-voucher and Seller Shop-voucher authoring, claiming, and a wallet remain deferred; the current role routers have no authoring screens.
- **First slice:** separate Admin App-voucher and Seller-owned Shop-voucher CRUD, term validation, start/end dates, usage caps, activation/deactivation, audit events, and a preview using the existing Checkout evaluator.
- **Boundary:** specify new Admin/Seller authoring features before coding; the Customer usage spec is not their complete contract. Preserve existing one-App-voucher/Shop-target rules, reciprocal stacking, authoritative money calculation, and funding snapshots.
- **Done when:** foreign-Shop edits fail, invalid terms cannot publish, simultaneous final-cap redemptions never exceed limits, historical Order savings survive definition changes, and quote/placement revalidate current eligibility.
- **Decisions:** issuer permissions, editing terms after redemption, funding liability, code uniqueness, and discoverability. A wallet/claim requirement is a separate later slice; do not block current voucher usage on an invented claim step.

### 11. Implement Courier availability and capacity monitoring

- **Finding:** [the availability spec](../features/logistics/flexible-availability-and-capacity-monitoring/specs.md) is a draft; inspected Courier profile/routes lack a self-availability contract. Logistics already has operational queues and company-truck capacity, which are different concepts.
- **First slice:** Courier-controlled available/offline state with server timestamps and a defined stale/expiry policy; a Logistics-scoped summary of eligible available Couriers versus actionable first/final-mile demand.
- **Approach:** share eligibility/demand readers with Dispatch and the Logistics dashboard. Decide whether availability only informs operators or also gates offers before changing dispatch behavior.
- **Done when:** Logistics cannot force a Courier online, wrong organizations cannot read/change availability, stale signals are explicit, and both views count the same operational demand. Going offline must not silently cancel accepted work.
- **Decisions:** demand statuses, freshness duration, disconnected behavior, and personal-vehicle capacity units. Reconcile the draft with current sole-hub dispatch; defer forecasting, live GPS, and multi-hub expansion.

### 12. Build incident reporting and Logistics follow-up

- **Finding:** [Incident Reporting](../features/courier/incident-reporting/specs.md) remains an oversized draft; no incident route/workflow was found in the current API. Existing failed-delivery attempts and support tickets cover different actions.
- **First slice:** idempotent task-owned reports for breakdown, accident, or inaccessible address; server timestamp/details, associated Logistics alert, and a scoped acknowledgement/resolution queue with immutable history.
- **Boundary:** revise the draft and define its Logistics counterpart before coding. Use current task/affiliation authority and approved Geoapify policy; old Mapbox wording is stale. Begin with online submission and truthful disconnected states.
- **Done when:** only an authorized active-task Courier can report; repeats do not duplicate incidents/alerts; authorized Logistics can acknowledge/resolve; reports do not fabricate delivery completion, payment changes, or emergency-service contact.
- **Decisions:** eligible task states, duplicate/open-incident policy, who resolves, whether reporting blocks completion, and SLA handling. Automatic rerouting, SLA pauses, evidence uploads, and SOS integration require explicit owning contracts.

### 13. Complete Customer application status and registration policy

- **Finding:** registration creates a pending Customer without a token. G01/G02 identify reference address/ID fields and pending-application status/resubmission workflows that the implemented registration does not provide.
- **First slice:** reconcile [registration requirements](../references/user-registration-requirements.md) with [Customer Auth](../features/customer/customer-auth/spec.md); decide which evidence is required and why, then define a narrowly authorized application-status channel and approval/rejection communication.
- **Next slice:** only after that contract is agreed, add required PSGC/manual address fields and private evidence upload, plus a controlled rejected-application correction/resubmission workflow.
- **Boundary:** preserve no-token pending registration and active-only Customer APIs. Status access needs its own verified application/email proof; do not open account, Orders, or support endpoints to pending accounts or leak application existence by email alone.
- **Done when:** source/client fields agree, age validation is server-owned, private evidence is scoped, rejection guidance is safe, retries are duplicate-safe, and pending/inactive users cannot access shopping-account privileges.
- **Decisions:** necessity/retention of ID evidence, status-access proof, verification method, resubmission window, and appeal/support exceptions. This is policy work before additional sensitive-data collection.

## Release work to complete alongside P0

Existing implementation evidence does not establish production readiness. Track these separately from new feature delivery:

- Complete the connected browser/authenticated deployment COD journey, including registration/approval, provider selection/checkout, Seller pickup, hub/linehaul/sorting, final-mile POD/Logistics validation, Courier cash receipt, platform clearing and beneficiary payouts. Backend checkout-to-delivery tests and bounded POD browser checks are already recorded; compose the remaining interfaces/infrastructure against a recorded release revision.
- Retain existing PostgreSQL exact-key placement, last-unit stock, approval-versus-cancellation, activation/scan, pickup/activation, checkout/pickup, transfer receipt and delivery/cash race coverage. Add focused evidence for unverified combinations such as voucher caps, address modification versus Seller approval, chat/ticket writes and production worker interruption/recovery. Historical blanket test-blocker statements do not describe the now-passing disposable-database suites.
- External Buyer/Courier installed-device and accessibility acceptance, signing/deployment, approved native map credentials, CORS/header exposure, cookie/bearer isolation, uploads/private reads, and expiry/revocation states.
- Web mobile/keyboard checks, Customer light-only and dashboard light/dark states, loading/empty/error/retry flows, and permission-loss clearing. Imported browser/test reports remain attributed external evidence.
- Operations validation: queue/scheduler execution, retry/failed-job observation, storage access/cleanup, backup restore, and policy decisions for communication retention/abuse and sensitive assets. Choose measurable release thresholds before launch.

## Suggested delivery order

1. **Close current commerce gaps:** 01, the correctness part of 04, and verified remaining adoption work in 02; complete remaining release checks against recorded backend/client revisions while retaining the already-passing lifecycle and lock-order regressions.
2. **Ship the first new Seller capability:** 03 as a complete CSV-only workflow, from dry run through recoverable partial results.
3. **Improve trust and daily usability:** the reporting/export improvements in 04, then 05, 07 and 08 in separate bounded changes; handle confirmed 09 issues before public production release.
4. **Strengthen interrupted purchases:** 06 after recovery/storage/retention decisions. It can be designed while CSV work proceeds.
5. **Expand growth and operations:** 10, then 11 and 12 after their domain decisions; undertake 13 when registration policy and private evidence handling are settled.

## Later opportunities requiring separate specifications

| Opportunity | Prerequisite and narrow starting point |
| --- | --- |
| Abandoned-cart promotions | First implement voucher authoring and consent/frequency policy; start with one deduplicated in-app reminder. [Existing draft](../features/seller/abandoned-cart-promotions/spec.md) must be reconciled to Seller React/Vite, not its stale Next.js wording. |
| Admin complaints/disputes and returns/refunds | Support tickets are not adjudication. Define case relationships, evidence access, authority, custody/inventory disposition, and Finance reversals before monetary decisions. [Disputes draft](../features/admin/manage-complaints-and-disputes/spec.md) exists; returns/refunds still need an owning executable contract. |
| Courier earnings statements | Define who funds/recognizes Courier earnings and an authoritative ledger first. Start with read-only earnings; never call COD collected or shipping fees Courier profit. [Profit Dashboard draft](../features/courier/profit-dashboard/specs.md) needs revision. |
| Live location, online payment, production payouts, multi-hub operations | Each changes privacy, financial or operational authority. Give each an owner and dedicated specification; payment enum values and sandbox payouts do not implement these workflows. |

## Rules for every implementation

- Keep Laravel/Sanctum/Postgres, Next.js Customer, and React/TypeScript role dashboards. Use existing packages and configured queue/storage; adding frameworks/providers/libraries needs explicit agreement.
- Enforce role/status/consent and Shop/organization/task ownership in the API. Keep controllers thin and services, Requests, Resources, DTOs, and clients focused on their responsibilities.
- Add new migrations; never edit executed ones. Store enum-like columns as strings with PHP enum casts. Derive owners server-side and preserve immutable Order/Finance/fulfillment facts.
- Follow [web design](../design.md), [PSGC/maps policy](../maps-location-api.md), upload and registration policies, and the matching feature spec. Update/resolve draft contracts and missing specifications before introducing new behavior.
- Keep Courier mobile-only. External Flutter work must occur in its owning project; update only affected portable contracts here and record actual client adoption and test evidence.
- Verify meaningful API/transaction/tenant tests and affected web type/lint/build checks for each change, plus focused responsive/accessibility states. Document unexecuted live/device gates explicitly.
- Use a new feature branch, append dated app-wide/client progress, preserve archives and imported snapshots, and commit the completed bounded change. This plan does not authorize implementing the whole roadmap at once.

## Verification of this plan

The original 2026-10-04 research included canonical documents, selected source, role routers and Flutter bundles. This 2026-10-07 refresh compared current progress, API routes, mutation/report/checkout/pickup services, Courier Auth/dashboard, support writes, Customer asset projections, and the current sorting/POD/cash/Billing/Finance/lifecycle specifications. The remaining source-confirmed gaps include unsafe destination changes without repricing, Seller aging summing whole mixed-Shop remittance batches, Courier recovery/dashboard scaffolds, absent bulk catalog/voucher/availability/incident routes, absent Customer global notification/recovery reads, support alert fanout and bounded image processing. External-client claims remain attributed prior reports pending actual client-source/device verification; their bundles/status were not changed. Existing external reference links remain background guidance, not newly verified implementation evidence. Local document/source links, whitespace, roadmap IDs and documentation-only scope are checked for this refresh; no application tests or live/device acceptance were rerun.
