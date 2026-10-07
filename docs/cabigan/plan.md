# AISLEY: What to implement next

Reviewed: 2026-10-07. Source baseline: `14776719d2c59a650467660b0f6c5e913141aacc` (`feat: add separate chat notifications`). This refresh supersedes the October 4 roadmap baseline.

This is a proposed roadmap based on current canonical specifications, API routes, selected services/resources, and role screens. Completion and verification records come from [app-wide progress](../PROGRESS.md); they were not rerun for this documentation update. Proposed work remains unimplemented and requires its owning specification. External Flutter source and documentation bundles were not re-audited; previously imported client reports do not establish adoption of subsequent API changes.

**Next work: close the Order address-safety gap (01) and Seller Finance total/period gaps (04), then verify external client contract adoption (02).** Seller bulk product import/export (03) remains the best bounded new Seller feature: its CSV-first specification builds on existing catalog and Inventory services. The [current reconciliation](need_revised_updated-old-do-not-use.md) separates active findings from the preserved historical review.

## What already exists

| Area | Existing foundation to extend |
| --- | --- |
| Customer | Public browsing/search, Product/Shop pages, account/address book, Cart, COD Checkout with per-Shop provider selection, voucher usage, Orders/tracking/cancellation/address versions, Wishlist, recency, questions/reviews, chat, notifications, and support tickets. Chat has shared web presentation, runtime-gated private media, and a separate unread header control. |
| Seller | Registration/approval, catalog/media/variants, SKU Inventory and low-stock controls, Order approval/preparation/pickup, enabled shipping providers, Finance/payout history/read-only payment settings, product questions/reviews, shared web chat/media/unread control, and support. CSV bulk catalog work remains absent. |
| Admin | Registration/account administration, permissions/audit, dashboard, compliance, policies/settings, homepage advertisements, notification campaigns, support tickets, pricing, Finance/holds, invoice/remittance review, payouts, automation, and gateway sandbox controls. No private-chat interface is added. |
| Logistics | Sole-hub operations, Courier approval, pickup scheduling, receiving/sorting with bounded offline queues, dispatch, company fleet/linehaul, rates, POD Pending/History/Approval settings, Courier cash receipt/history, masked simulated Billing, COD invoice payments/payouts/settings, shared web chat/media/unread control, notifications, and support. |
| Courier | Mobile-consumed API authentication/account/vehicle, task/batch reads/actions, pickup, final-mile handoff/photo POD/COD intent, correction reasons/delivery timestamps, failed attempts, history, chat/private attachments, notifications, and support. Dashboard aggregation and password reset remain incomplete; no production Courier web app exists. |
| External Flutter | The October 4 imported record reports Buyer Phase 1–4 and Phase 5 verification tooling; earlier canonical Courier specs attribute several client workflows. Runtime code is external. Current shipping/auth/POD/media adoption and installed-device acceptance need evidence from the owning projects. |

Some specification headers still say Draft even where source implements the feature. The opportunities below use narrower source-confirmed gaps; do not rebuild auth, catalog, Checkout, messaging, support tickets, or hub operations wholesale. Start with [requirements](../requirements.md), [architecture](../architecture.md), [workflows](../workspace.md), and [progress](../PROGRESS.md).

## Completed since the previous review

| Change | Current boundary and owning contract |
| --- | --- |
| COD automation and Finance pages, October 5 | Collector-owned invoices/private PDFs, full-balance Pay now, scheduled collection, verified gateway clearing, payout reservations/history, delays/settings, and sandbox recovery are implemented. [COD automation](../features/shared/cod-automation/spec.md) uses simulated money; production gateway integration remains separate. |
| Shared web chat and isolated mutation counters, October 5–6 | All seven web chat surfaces use `@aisley/chat-ui`; Customer chat starts/replies have counters separated from browsing/polling. [Shared chat](../features/shared/chat-messaging/spec.md) retains separate role/channel histories and memory-only retry state. |
| POD policies, Courier cash, and Billing, October 6 | [Delivery review](../features/logistics/delivery-confirmations/spec.md) defaults to manual; configured automatic approval applies only to new eligible paid prepaid intents, with no visual-quality assessment. COD stays manual. [Cash receipts](../features/logistics/courier-cash-remittance/spec.md) credit the simulator once and leave platform invoices outstanding; [Billing](../features/logistics/billing/spec.md) is masked. Customer checkout stays COD-only. |
| Private chat attachments, October 6 | [Chat media](../features/shared/chat-media/spec.md) implements private images, H.264/AAC MP4, and approved documents across the existing channels. New uploads default off pending operator readiness; processing/scanning, exact binding/retries, private reads/ranges, and abandoned-upload cleanup exist. Admin/support-ticket attachments, audio, and external Flutter adoption remain separate. |
| Separate web chat alerts, October 6 | Customer/Seller/Logistics headers show committed unread incoming-message totals and five previews, including attachment-only messages. [The notification contract](../features/shared/chat-messaging/spec.md#dedicated-web-chat-notifications--2026-10-06) uses foreground polling and existing chat read markers; general notifications, support alerts, native push, and Courier APIs are separate. |

The recorded checks include scoped SQLite/PostgreSQL suites, connected browser flows for POD/cash and chat media, and mocked responsive/theme checks for the latest chat alerts. They cover the recorded revisions and scenarios, not a new release certification or external Flutter completion.

## Recommended priorities

P0 closes an existing contract or correctness gap. P1 delivers a bounded improvement. P2 needs further domain decisions before implementation. Effort is relative: M spans several layers; L introduces a substantial workflow or cross-role coordination. These are scope estimates, not delivery dates.

| ID | Priority | Opportunity | Where the work belongs | Effort |
| --- | --- | --- | --- | --- |
| 01 | P0 | Safe Order address corrections | Customer API and storefront; Buyer contract | M |
| 02 | P0 | Current shipping/auth/POD/media contract adoption in Flutter | External Buyer/Courier projects; affected contract docs here | M–L |
| 03 | P1 | Seller CSV product import/export | Seller dashboard, catalog API, queue/storage | L |
| 04 | P0 correctness; P1 exports | Owned Finance totals, reliable period labels, and usable exports | Shared Finance API; Seller/Admin/Logistics overview | M–L |
| 05 | P1 | Complete Courier password recovery | Courier API and external mobile client | M |
| 06 | P1 | Checkout recovery after an app restart | Customer API; external Buyer, later storefront if needed | M–L |
| 07 | P1 | Support reply alerts and general Customer notification totals | Support/general-notification APIs and affected clients | M |
| 08 | P1 | Real Courier dashboard summary | Courier read API and external mobile client | M |
| 09 | P1; resolve before public release | Bounded processing and safe projections for non-chat images | Existing image services/resources and policies | M–L |
| 10 | P2 | Admin/Seller voucher authoring | Admin/Seller dashboards and scoped API | L |
| 11 | P2 | Courier availability and capacity monitoring | Courier API/client and Logistics dashboard | L |
| 12 | P2 | Courier incident reporting with dispatch follow-up | Courier API/client and Logistics operations | L |
| 13 | P2 | Customer application status and registration completion | Customer auth, Admin approval, external Buyer | L |

## Implementation slices

### 01. Make Order address corrections commercially safe

- **Finding, rechecked:** [CustomerOrderMutationService](../../src/api/app/Services/Customer/CustomerOrderMutationService.php) checks ownership, completeness, eligibility, and revision, then copies another saved address into a new snapshot. It neither restricts the change to the committed location nor recalculates provider coverage/shipping. Immutable checkout pricing can therefore remain attached to a different destination; this is a source finding, not a newly reproduced runtime case.
- **First slice:** specify and enforce same-location corrections in Laravel, comparing normalized address fields and coordinates against the committed snapshot. Return a documented conflict for a location change; keep the storefront's choices consistent with the server.
- **Boundary:** preserve the selected provider, checkout pricing, vouchers, COD, reservation, snapshot history, and the existing `placed` window. A later relocation/requote workflow needs explicit approval of provider, funding, price-change consent, and downstream regeneration rules.
- **Done when:** another-location/address-pin change cannot silently retain an obsolete quote; contact-only corrections remain versioned and idempotent; stale revisions, foreign addresses, Seller acceptance races, and legacy snapshots have focused API/UI coverage.
- **Read/update:** [Order modification spec](../features/customer/order-modification-cancellation/spec.md), [Checkout spec](../features/customer/checkout-order/spec.md), and [shipping quotation](../features/shared/shipping-quotation/spec.md). An implementation changing the consumed address contract must update affected Buyer portable sections alongside the canonical spec.

### 02. Adopt the current backend contracts in the external clients

- **Finding:** the previously imported Buyer record used `57e9eb2`; the October 4 progress entry explicitly retains a shipping adoption gap. Canonical Courier specs retain unadopted route/failed-attempt/linehaul views. October 6 progress records newer POD completion projections and private media contracts without advancing external Flutter status. The latest web chat-alert change preserves those mobile contracts.
- **First Buyer slice:** consume `POST /api/v1/customer/checkout/logistics-options`, select an enabled provider per Shop, freeze `logistics_selections` in quote/place intent, and parse current quote/Batch fields and nullable Order `shippingProvider`.
- **First Courier slice:** verify Auth v2.6 denial/duplicate responses and truthful recovery-unavailable presentation, completion correction reasons and actual delivery timestamps. Adopt advisory batch-route/failed-attempt views separately; linehaul reads do not grant Logistics trip actions.
- **Media slice:** implement upload/checking/readiness, ordered `attachment_ids`, attachment-only fallback bodies, authorized image/video/document transport, and exact retry/clearing behavior in each owning mobile chat. Respect capabilities/default-off activation; updated portable DTOs are not client implementation evidence.
- **Done when:** provider choices/errors, changed quote intent, exact-key replay, legacy null providers, Auth denials, POD corrections, media readiness/private reads, authorization loss, and uncertain sends pass scoped client/API checks. Record each client's actual adopted commit, fixtures, authenticated exchanges, and installed-device evidence separately.
- **Boundary/reference:** client code changes belong to the external projects. Preserve storefront guest browsing and guest recency; required sign-in/account-only recency are Buyer Flutter decisions. Read the [Buyer bundle](../docs-mobile-buyer/README.md) and [Courier bundle](../docs-flutter-rider/README.md).

### 03. Build Seller bulk product import/export

- **Finding:** [the CSV-first spec](../features/seller/bulk-product-import-export/spec.md) explicitly says its routes, jobs, tables, and screens are unavailable; the current [Seller router](../../src/seller/src/App.tsx) has no bulk workflow.
- **First slice:** download a versioned template/export, upload one CSV in create or update mode, validate a private dry run, review row differences/errors, explicitly confirm valid rows, then show progress and downloadable results.
- **Approach:** reuse [ProductCatalogService](../../src/api/app/Services/Seller/ProductCatalogService.php) and Inventory initialization. Follow the existing 2 MiB/1,000-record limits, queued chunks of at most 50 rows, per-row transactions, Shop scoping, revision checks, and durable replay records.
- **Boundary:** simple Products only; creates are draft with zero stock. Keep variants, XLSX, images/Markdown, stock edits, and publication out of the first release.
- **Done when:** preview changes no catalog data; foreign IDs and malformed files fail safely; worker retries/crashes never duplicate Products/SKUs; partial outcomes reconcile; Seller mobile/light/dark/keyboard flows work.
- **Implementation basis:** dispatch queue work after durable commit ([Laravel queue transactions](https://laravel.com/framework/docs/13.x/queues#jobs-and-database-transactions)); test the spec's spreadsheet-safe encoding after save/reopen in supported clients ([OWASP CSV injection](https://community.owasp.org/attacks/CSV_Injection)).

### 04. Improve Finance correctness before adding more charts

- **Finding, rechecked:** [FinanceReportService](../../src/api/app/Services/Finance/FinanceReportService.php) still filters Seller batches by owned allocations and sums their whole `total_cents`. It checks current-month closure for `profitState`, while [FinanceWorkflowService](../../src/api/app/Services/Finance/FinanceWorkflowService.php) rejects closing that month. COD payment automation does not fix these overview calculations.
- **P0 slice:** use owned allocation amounts for Seller aging; reconcile provisional/actual labels with the periods that can actually close. Define a consistent reporting-period contract before exposing filters or claiming final profit.
- **P1 slice:** stable ledger pagination, owned Order drill-down, filter-aware bounded exports, export failures/loading, and spreadsheet-safe text cells. [The shared overview](../../packages/finance-ui/src/workspace.tsx) still requests one ledger page; the new invoice/payout/history pages already have their own pagination and private PDFs. Keep unknown cost visible instead of implying zero.
- **Done when:** a mixed-Shop remittance exposes only the requesting Shop's amounts; role totals reconcile to owned ledger lines; period boundaries and CSV output match the selected view; permission loss clears private reports.
- **Boundary/reference:** preserve collector-owned invoicing, separate Courier cash receipts, confirmed-delivery recognition, cleared COD funding, holds/reservations, configured waits, reversals, and simulated-money labels. Read [Seller reports](../features/seller/generate-report/spec.md), [Admin reports](../features/admin/reports-overview/spec.md), [settlement](../features/shared/commission-settlement/spec.md), [COD automation](../features/shared/cod-automation/spec.md), and [Finance tests](../../src/api/tests/Feature/Finance).

### 05. Complete Courier password recovery

- **Finding, rechecked:** [Courier AuthController](../../src/api/app/Http/Controllers/Courier/AuthController.php) returns “Courier password recovery is not available yet.” No Courier reset-completion route exists. Auth v2.6 already fixed denial consistency, duplicate-registration races, and misleading email promises; retain those fixes while implementing actual recovery.
- **First slice:** role-scoped reset issuance, an approved email/reset destination or mobile handoff, expiring single-use tokens, reset completion, throttling, and an explicit bearer-token revocation policy.
- **Approach:** reuse the repository's role-aware reset conventions; default email-only lookup is insufficient because `unique(email, role)` allows the same address in different roles. Laravel provides configurable providers/brokers, but project role scoping remains mandatory ([password reset docs](https://laravel.com/framework/docs/13.x/passwords)).
- **Done when:** a Courier reset cannot alter a same-email Customer/Seller; expired/reused tokens fail; delivery failures stay recoverable; responses avoid account enumeration; reset never grants pending/rejected accounts operational access.
- **Read/update:** [Courier Auth spec](../features/courier/auth/spec.md), current Customer/Seller/Logistics reset implementations, and the external Courier's recovery presentation. Decide the reset destination before adding a client screen.

### 06. Recover uncertain Checkout after an app restart

- **Finding:** current Checkout routes provide quote/place and result-by-batch, with no placement-by-key recovery read. [CheckoutService](../../src/api/app/Services/Customer/CheckoutService.php) already replays an exact placement key/body. Earlier imported Buyer records describe memory-only pending intent; current external persistence was not inspected.
- **First slice:** define an authenticated Customer-scoped recovery lookup for a prior placement key and a minimal protected client record containing the exact approved replay intent. Persist no bearer token or unnecessary address/payment data in that record.
- **Boundary:** an unresolved request is not a failed Order. Refetch/reconcile before retry; retain the same key/body for the same intent and require a new quote/key for a new purchase. This adds recovery, not unattended offline ordering.
- **Done when:** app termination immediately before/after server commit, network loss, changed account, expired quote, and changed payload cannot duplicate Orders, reservations, or voucher redemptions; logout/account loss clears private recovery state.
- **Read/update:** [Checkout spec](../features/customer/checkout-order/spec.md) and [shipping quotation](../features/shared/shipping-quotation/spec.md), plus affected Buyer contracts when implementing the lookup. Define retention and protected storage first; existing chat/payment retry handling is not a durable Checkout recovery contract.

### 07. Add useful alerts to existing support and notifications

- **Finding, rechecked:** [SupportTicketWriter](../../src/api/app/Services/Support/SupportTicketWriter.php) has no notification fanout. Customer general notifications have list/detail/read routes, with no global unread-count/read-all operations. The new `/customer/chat-notifications` count covers conversation messages only and does not close either gap.
- **First slice:** after-commit notifications for opposite-party replies/status changes, with deduplication by committed ticket event and role-correct destinations. Then add separate Customer-owned unread-count and bounded read-all operations.
- **Boundary:** ticket markers, chat markers/header totals, and general notification read state remain distinct. Count the complete owned general-notification scope, not unread items on one page. Preserve the dedicated chat control without adding duplicate general chat alerts. Native push/device registration and support attachments remain later features despite chat media implementation.
- **Done when:** retried events create one alert; rollbacks create none; notification failure preserves the reply; foreign recipients cannot read it; global counts/read-all stay correct during concurrent delivery and reading.
- **Read/update:** [Admin Support spec](../features/admin/support-ticket-system/spec.md), [Customer Support spec](../features/customer/support-tickets/spec.md), existing role notification contracts, and [dedicated chat alerts](../features/shared/chat-messaging/spec.md#dedicated-web-chat-notifications--2026-10-06). Define new general-notification operations and any affected Buyer contract separately.

### 08. Replace the Courier dashboard aggregate scaffold

- **Finding, rechecked:** [DashboardController](../../src/api/app/Http/Controllers/Courier/DashboardController.php) still returns empty data and `OPERATIONAL_SCHEMA_DEFERRED` for notifications, available tasks, and active tasks even though their separate APIs exist. Canonical client reports describe independent previews, which do not implement the Laravel aggregate.
- **First slice:** a bounded read-only aggregate of unread notifications and task/batch previews with server time, freshness, stable identifiers, and navigation targets; reuse existing scoped readers and eligibility rules.
- **Boundary:** distinguish first-mile tasks from atomic final-mile batch acceptance; company-truck trip reads remain separate. Dashboard reads must not accept work, clear notifications, or claim earnings/live location.
- **Done when:** summaries agree with authoritative task endpoints, remain within the Courier's active affiliation/hub, show unavailable sections truthfully, and never turn stale cached previews into actionable authority.
- **Read/update:** [Courier Dashboard spec](../features/courier/dashboard/specs.md), [existing dashboard tests](../../src/api/tests/Feature/Courier/CourierDashboardTest.php), and the external client's separate preview controllers.

### 09. Close non-chat image-processing and asset-projection gaps

- **Finding, rechecked:** [CustomerAccountService](../../src/api/app/Services/Customer/CustomerAccountService.php) inspects metadata with `getimagesize` and stores the original photo; that path does not demonstrate bounded full decoding/rewrite or EXIF removal. [CustomerUserResource](../../src/api/app/Http/Resources/Customer/CustomerUserResource.php) still declares legacy `profile_photo_path`; the inspected registration flow has no uploaded photo, so this is a projection-policy gap rather than proof of a current non-null path disclosure. Other image paths need their own audit.
- **Already implemented:** chat images have bounded decode/rewrite, 8,000-pixel edges/40-megapixel limits, ClamAV, private previews, replay-safe binding, and 24-hour abandoned-upload cleanup under [Chat Media](../features/shared/chat-media/spec.md). Do not rebuild those controls or assume they cover account, review, catalog, registration, or POD images.
- **First slice:** audit non-chat upload paths, remove the legacy raw-path projection, and centralize bounded decode/validation and metadata stripping for confirmed gaps. Define per-purpose edge/pixel ceilings through the owning policy; chat's approved bounds do not automatically apply elsewhere.
- **Next slice:** safe orphan cleanup and replay/reconciliation contracts for profile/review uploads. Inventory existing asset ownership/lifecycles before reusing processing code or cleanup; chat's expiry applies only to unbound chat uploads.
- **Done when:** malformed/spoofed/oversized-dimension inputs fail within bounded resources, private evidence remains authorized, EXIF is handled, retries cannot silently attach duplicate media, and legitimate assets survive cleanup.
- **Read/update:** [upload requirements](../references/file-upload-requirements.md), [Customer Account](../features/customer/account-management/spec.md), [Reviews](../features/customer/product-review-ratings/spec.md), and other audited feature specs. Keep JPEG/PNG/WebP strictly under 10 MiB for these image features; the chat-only MP4/document policy grants no new formats elsewhere ([OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)).

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

- **Finding, rechecked:** [Customer RegisterRequest](../../src/api/app/Http/Requests/Customer/RegisterRequest.php) accepts profile/credentials without registration address or ID evidence. [Customer Auth](../features/customer/customer-auth/spec.md) records those reference extensions and rejected-applicant resubmission as incomplete. Registration creates a pending Customer without a session/token; no narrowly authorized pending-application status workflow was found in current routes.
- **First slice:** reconcile [registration requirements](../references/user-registration-requirements.md) with [Customer Auth](../features/customer/customer-auth/spec.md); decide which evidence is required and why, then define a narrowly authorized application-status channel and approval/rejection communication.
- **Next slice:** only after that contract is agreed, add required PSGC/manual address fields and private evidence upload, plus a controlled rejected-application correction/resubmission workflow.
- **Boundary:** preserve no-token pending registration and active-only Customer APIs. Status access needs its own verified application/email proof; do not open account, Orders, or support endpoints to pending accounts or leak application existence by email alone.
- **Done when:** source/client fields agree, age validation is server-owned, private evidence is scoped, rejection guidance is safe, retries are duplicate-safe, and pending/inactive users cannot access shopping-account privileges.
- **Decisions:** necessity/retention of ID evidence, status-access proof, verification method, resubmission window, and appeal/support exceptions. This is policy work before additional sensitive-data collection.

## Release work to complete alongside P0

Existing implementation evidence does not establish production readiness. Track these separately from new feature delivery:

- Controlled authenticated COD journey: registration/approval → provider quote/place → Seller approval/pickup → hub/linehaul/sorting → final-mile batch/handoff/POD → manual Logistics approval → Courier cash receipt → platform invoice payment/verified clearing → eligible Seller/Logistics payout. Reconcile each boundary separately; recording physical cash never clears the invoice or creates a payout.
- PostgreSQL concurrency/recovery: reuse the recorded Finance, POD/cash and chat-media suites, then cover outstanding report ownership, voucher caps, exact-key placement, Customer modification versus Seller approval, and ticket writes on the release revision. Existing scoped passes are not evidence that every release race passed.
- Finance operations: confirm queue/scheduler execution, configured collection/payout times, unknown-payment recovery, pending simulator credits, holds/reservations and private PDFs. Keep fake balances/transfers labelled; choose and specify a live provider before claiming production payment readiness.
- Media rollout: the October 6 entry says the ordinary database was not migrated. Verify the additive migration in each target environment, private shared Azure storage, dedicated media worker, FFmpeg/ffprobe/GD/ZIP, ClamAV/signatures, request ceilings, capability checks, processing recovery and locked cleanup before enabling uploads. Azure production delivery remains unverified.
- External Buyer/Courier installed-device/accessibility acceptance, signing/deployment, approved map credentials, CORS/header exposure, cookie/bearer isolation, POD corrections, uploads/private reads/ranges, app restarts and expiry/revocation states. Preserve each client status until implementation evidence supports changing it.
- Web mobile/keyboard and screen-reader checks for changed flows, Customer light-only and dashboard light/dark, loading/empty/error/retry states, focus and permission-loss clearing. Distinguish recorded connected checks from mocked browser checks; the latest chat-alert responsive checks used mocks.
- Operations validation: failed-job observation, storage/cleanup, backup restore, and communication retention/abuse and sensitive-asset decisions. Production scanner/storage and a whole commerce journey remain release work even when individual feature checks passed.

## Suggested delivery order

1. **Close current correctness gaps:** 01 and the P0 portion of 04. Confirm 02 in the external projects and run the controlled release checks against recorded backend/client revisions; address confirmed 09 gaps before public release.
2. **Ship the first new Seller capability:** 03 as a complete CSV-only workflow, from dry run through recoverable partial results.
3. **Improve trust and daily usability:** the P1 portion of 04, then 05, 07, and 08 as separate bounded changes.
4. **Strengthen interrupted purchases:** 06 after recovery/storage/retention decisions. It can be designed while CSV work proceeds.
5. **Expand growth and operations:** 10, then 11 and 12 after their domain decisions; undertake 13 when registration policy and private evidence handling are settled.

## Later opportunities requiring separate specifications

| Opportunity | Prerequisite and narrow starting point |
| --- | --- |
| Abandoned-cart promotions | First implement voucher authoring and consent/frequency policy; start with one deduplicated in-app reminder. [Existing draft](../features/seller/abandoned-cart-promotions/spec.md) must be reconciled to Seller React/Vite, not its stale Next.js wording. |
| Rich Product/Order chat cards and Seller product sharing | Shared web chat, media and header alerts already exist. Extend current label/link context with role-safe fields and an owned visible-Product picker inside an existing Shop thread; [shared chat targets](../features/shared/chat-messaging/spec.md) still require an executable send/DTO contract. No arbitrary Buyer outreach or cross-Shop sharing. |
| Courier registration with separate OR/CR | Vehicle editing already replaces OR/CR independently, but [Courier Auth](../features/courier/auth/spec.md) and its controller still accept combined `vehicle_registration` during registration. Define a coordinated API/client registration rollout preserving historical evidence and rejecting mixed legacy/new forms. |
| Admin complaints/disputes and returns/refunds | Support tickets are not adjudication. Define case relationships, evidence access, authority, custody/inventory disposition, and Finance reversals before monetary decisions. [Disputes draft](../features/admin/manage-complaints-and-disputes/spec.md) exists; returns/refunds still need an owning executable contract. |
| Courier earnings statements | Define who funds/recognizes Courier earnings and an authoritative ledger first. Start with read-only earnings; never call COD collected or shipping fees Courier profit. [Profit Dashboard draft](../features/courier/profit-dashboard/specs.md) needs revision. |
| Live location, online checkout/payment, production payouts, multi-hub operations | Each needs an owner and dedicated specification. Paid prepaid delivery approval and simulated collection/payouts exist; neither implements online payment capture/settlement or a live gateway. Sole-hub organizations already transfer by company truck; adding hubs within an organization is separate. |

## Rules for every implementation

- Keep Laravel/Sanctum/Postgres, Next.js Customer, and React/TypeScript role dashboards. Use existing packages and configured queue/storage; adding frameworks/providers/libraries needs explicit agreement. Web apps use HttpOnly cookie sessions/CSRF; Courier uses scoped bearer tokens, and Customer login supports them when `device_name` is supplied.
- Enforce role/status/consent and Shop/organization/task ownership in the API. Keep controllers thin and services, Requests, Resources, DTOs, and clients focused on their responsibilities.
- Add new migrations; never edit executed ones. Store enum-like columns as strings with PHP enum casts. Derive owners server-side and preserve immutable Order/Finance/fulfillment facts.
- Follow [web design](../design.md), [PSGC/maps policy](../maps-location-api.md), upload and registration policies, and the matching feature spec. Update/resolve draft contracts and missing specifications before introducing new behavior.
- Keep Courier mobile-only. External Flutter work must occur in its owning project; update only affected portable contracts here and record actual client adoption and test evidence.
- Verify meaningful API/transaction/tenant tests and affected web type/lint/build checks for each change, plus focused responsive/accessibility states. Document unexecuted live/device gates explicitly.
- Use a new feature branch, append dated app-wide progress, apply its 150-line archive rule, preserve imported snapshots/archives, and commit the completed bounded change. Update external-client progress only in its owning project when client work is actually performed. This plan does not authorize implementing the whole roadmap at once.

## Verification of this plan

This October 7 refresh checked canonical requirements/architecture/design/workflow and upload/registration policies, relevant feature contracts, current API routes, selected controllers/services/Resources, Finance overview components, role routers, test inventory, and the app-wide progress log at the source baseline above. The official Laravel and OWASP references linked in the implementation slices were rechecked; they support approaches, not project completion. External Flutter bundles/source, copied snapshots, and archived logs were left unchanged and were not re-audited.

Verification for this change is documentation-only: local document/source links and heading anchors, roadmap IDs, preserved historical-review content, progress-log append/archive threshold, Git whitespace, and changed-file scope. No application tests, builds, migrations, browser flows, live gateway/Azure checks, or Flutter/device acceptance ran for this refresh.
