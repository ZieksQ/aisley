# Commission, COD remittance, settlement, and finance reporting

## WHAT

- Snapshot effective Seller and Logistics commissions at Order placement.
- Admin commission history derives Active/Scheduled/Inactive/Expired from publication and effective windows. Publication closes only intersecting earlier windows for the same beneficiary, preserves later published schedules, and clamps past/absent effective dates to publication time. Stored draft/published state and existing Order snapshots remain compatible; an expired published policy cannot be republished.
- Maintain an append-only, balanced integer-centavo ledger for receivables, cash, revenue, expenses, liabilities, refunds, and recoverables.
- Reconcile full COD remittance before Seller or Logistics settlement.
- Allocate the Logistics pool from completed service evidence and pay eligible balances through a sandbox simulator.
- Provide role-isolated Finance workspaces for Admin, Seller, and Logistics.

## MONEY RULES

- Customer COD is merchandise subtotal minus merchandise discounts plus quoted shipping minus shipping discounts. Commission never increases COD.
- Seller commission base is merchandise after Seller-funded merchandise discounts. Seller proceeds subtract Seller commission and Seller-funded shipping discounts.
- Platform-funded vouchers are platform expenses and preserve beneficiary proceeds.
- New shipping uses Logistics service bases once per leg, destination surcharge, and one Shop main-category weight/size extra per Parcel/service leg, with no platform base. The extra uses the combined billable weight of all Product Category lines in that Shop Order. Frozen full leg charges (base plus extra) remain the allocation weights. Historical `platform_base_v1` snapshots retain their original totals; new `logistics_service_base_v1` snapshots separate aggregate service bases and extras. Finance drill-downs must label components according to this marker when showing them.
- Logistics commission applies once to quoted shipping plus an explicitly funded subsidy.
- Apply Logistics commission exactly once to the complete frozen shipping amount; never apply commission independently to every transfer.
- Allocate the post-commission Logistics pool across the frozen first-mile, linehaul, and last-mile charges in proportion to each approved quoted leg charge. Do not use fixed 25/35/40 shares.
- Require actual service evidence to agree with each frozen leg owner: selected pickup organization for first mile, departed/arrived trip owner for linehaul, and current destination organization for last mile.
- Missing or contradictory carrier evidence holds allocation. Deterministic largest-remainder allocation reconciles every centavo.
- An unplanned fallback route has no invented leg weights. Hold its pool until Admin records actual provider allocations; Admin may add an explicit platform-funded subsidy and must provide an audited note.
- Confirmed delivery recognizes revenue. Confirmed collection remains `orders.payment_status = paid`; remittance and payout have independent state.

## SETTLEMENT

- Final-mile Logistics receives an automatic COD invoice at confirmed delivery; its default deadline is 72 hours. Scheduled or manual full-balance payments fund Orders only after a verified gateway result; legacy manual receipts require Admin clearing. See `../cod-automation/spec.md`.
- Seller balances default to 14 days after delivery; Logistics balances default to 24 hours. Admin customizes future-delivery delays. Both require full funding and no financial holds; Admin can send early Logistics payouts without a written reason.
- `finance:automate` evaluates persisted daily collection and separate payout schedules every minute. Defaults are 09:00 Asia/Manila; Logistics chooses collection time, Admin chooses payout times. Gateway-backed transfers reserve liabilities atomically and retain attempt history. `finance:settle` remains a manual eligible-payout command.
- Sandbox outcomes are deterministic: success, failure, delay/unknown, duplicate callback, and insufficient funds. Sandbox beneficiaries and callbacks stay marked and cannot be treated as live transfers.
- Refunds and corrections use reversing entries. Pre-payout reversals reduce liabilities; post-payout reversals create recoverables.

## REPORTING

- Admin is platform-wide and permission-gated. Seller queries derive one Shop from the session. Logistics queries derive one organization from the session.
- Reports include revenue, costs, provisional/actual operating profit, available balance, remittance aging, payout schedule, ledger search/CSV, Order drill-down, and money-flow data.
- Seller, Admin, and Logistics use the same responsive Finance dashboard composition with role-specific revenue labels. Recorded revenue and the server-provided 30-day low/base/high projection share one accessible time-series graph; the projection is not presented as a separate dashboard mode or recalculated by React.
- Costs remain unknown until recorded. Monthly close requires an explicit completeness confirmation.
- Forecast 30 days from weekday averages across eight complete usable weeks, forecast revenue and variable cost separately, include recurring expenses, and expose low/base/high activity scenarios at -20/0/+20 percent. Suppress profit forecast when cost coverage is incomplete.

## API

- Shared role prefixes expose `/finance/summary`, `/finance/series`, `/finance/ledger`, `/finance/ledger.csv`, `/finance/orders/{order}`, `/finance/costs`, `/finance/periods/{month}/close`, `/finance/forecast`, and `/finance/payouts`.
- Admin additionally manages commission policies, remittance clearing, financial holds, route reconciliation through `GET /finance/holds`, `GET /finance/holds/{hold}`, and `POST /finance/holds/{hold}/reconcile-logistics`, and payout callbacks.

## VERIFICATION

- Cover commission snapshots, voucher funding, zero shipping, frozen quoted leg weights, actual carrier ownership, pro-rata remainder reconciliation, unplanned-route hold and Admin subsidy reconciliation, partial/full remittance, duplicate receipts/callbacks, 14-day eligibility, atomic reservations, unknown outcomes, reversals, ledger balancing, cost completeness, close rules, forecast reproducibility, tenant isolation, and sandbox separation.
