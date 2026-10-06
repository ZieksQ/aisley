# Connected Order lifecycle verification — 2026-10-07

The core COD backend flow is verified through API-created Orders, from Customer checkout to Logistics-confirmed delivery. This report records automated backend evidence; it does not certify every browser interaction, deployment integration or external Flutter device.

## Connected scenarios

`src/api/tests/Feature/Orders/OrderLifecycleTest.php` runs the same complete workflow for local delivery and company-truck transfer between two organizations' sole hubs. Setup creates active users, approved Courier affiliations, catalog stock, enabled providers, accepted tariffs, rate cards, connections, coverage and published active sort-plan versions. It does not fabricate Orders, reservations, waybills or custody transitions.

| Stage | Verified behavior |
| --- | --- |
| Customer Cart and checkout | Add two units, choose the Shop's enabled provider, obtain a server-priced quote and place one COD Order; selected Cart cleanup and reservation happen once on retry. |
| Seller approval | Approval advances `placed → seller_processing`; stock remains reserved and COD remains pending. Repeated approval reuses the committed result. |
| Seller preparation | Pickup uses the frozen provider and a Seller-owned address; one immutable waybill is created, including on retry. |
| First-mile pickup | Logistics schedules the affiliated Courier; a scoped Sanctum Courier bearer token accepts and confirms physical pickup. Two reserved units are fulfilled once, leaving eight on hand and zero reserved. |
| Hub receipt and sorting | Receipt and automatic sorting retry safely. The server uses the immutable purchased recipient postal code and active published version. |
| Company-truck transfer | An eligible company truck/driver, reciprocal accepted connections, destination approval, departure and individual manifest receipt move custody to the destination. Final-mile tasks are absent during transfer. |
| Final-mile dispatch | The destination schedules one Courier; renamed lane labels do not replace frozen assignment evidence. Retrying dispatch creates no second schedule. |
| Courier handoff and movement | Batch acceptance, task-bound hub-pickup evidence, Logistics validation, `in_transit` and `out_for_delivery` use the current task/Shipment revisions. |
| POD and COD completion | A valid private photo plus explicit completion/COD intent stays pending until Logistics validates. Delivery then atomically marks the Order delivered/paid, creates one outstanding collector-owned invoice and one final-mile Courier cash obligation, and appends one completion event. |
| Customer, Seller and Courier reads | Customer status/payable projections are checked along the flow; final Seller Order and Courier history report delivered. Purchased product/recipient facts survive source catalog/Address Book edits. The Customer can submit a verified-purchase review. |

The test charges PHP 210 for local delivery and PHP 217 with one linehaul leg. Later source Product prices and lane names do not change those totals. On transfer delivery, invoice/cash ownership belongs to the final collecting organization, while the Order retains its originally selected first-mile provider.

## Concurrency and regressions

`OrderLifecycleConcurrencyTest` uses independent PostgreSQL processes and a disposable database to verify duplicate placement, two Customers buying the last unit, and Seller approval racing Customer cancellation. Exactly one incompatible action wins; stock cannot oversell, and retries do not duplicate reservations/history. It explicitly refuses migration-based execution against a database outside the disposable runner's naming convention.

`HubRoutingConcurrencyTest` now verifies duplicate accepted company-truck departures and competing per-parcel receipt scans through the current trip/receiving services. Both duplicate receipts identify the same immutable receipt and one custody event. Existing suites additionally check activation/scan races, independent scanners versus unloading closure, delivery approval versus proof rejection, automatic/manual approval and duplicate/competing cash receipts.

Broader API regressions cover Cart/Buy Now and multi-Shop checkout, vouchers, stale quotes, Customer modification/cancellation and tracking, Seller approval/rejection, inventory, pickup addresses/waybills, local/final-mile fulfillment, multi-hop routing, company trucks, partial/damaged/missing receiving, POD corrections, cash remittance, service quotation, Finance ledger/holds, COD automation, simulated gateway contracts, reviews and Customer/Seller/Courier authentication. Their tenant, role, invalid-state and replay tests complement the connected success scenarios.

Two stale tests were corrected during verification: the pickup routing-hint fixture must publish/activate its draft plan, and the old transfer concurrency test must use the required company-truck trip rather than a forbidden standalone departure. These were test-contract mismatches; production code was not changed to bypass either guard.

## Results

- Final SQLite backend regression run: **210 passed, 3,080 assertions**.
- Final connected PostgreSQL scenarios: **2 passed, 248 assertions**.
- Final combined PostgreSQL concurrency run: **11 passed, 240 assertions**, including the three new checkout/stock/approval races.
- PostgreSQL final total across the two runs: **13 passed, 488 assertions**. Temporary databases were removed and the final test-database audit found none remaining.
- PHP Pint and Git whitespace checks apply to the changed tests/docs. No frontend source changed in this verification revision.

## Repeatable checks

Run from the repository's `src/api` directory with its existing dependencies and local PostgreSQL configuration:

```sh
php artisan test --compact --filter=OrderLifecycleTest
php artisan test --compact --filter='CustomerCheckoutTest|CustomerOrderMutationTest|CustomerOrderStatusTest|CustomerCartTest|SellerAcceptOrderTest|SellerProductInventoryTest|SellerPickupAddressTest|LogisticsPickupWaybillTest|FinalMileFulfillmentTest|DeliveryApprovalTest|CourierCashRemittanceTest|HubRoutingTest|LinehaulTest|LinehaulReceivingTest|CompanyTruckLinehaulTest|ShippingServiceQuotationTest|FinanceLedgerTest|CodAutomationTest|FinanceHoldReviewTest|GatewayHttpContractTest|OrderLifecycleTest|ProductReviewTest|CustomerAuthenticationTest|SellerAuthenticationTest|CourierAuthenticationTest'
php tests/Support/run-delivery-postgres.php OrderLifecycleTest
php tests/Support/run-delivery-postgres.php 'SortingConcurrencyTest|HubRoutingConcurrencyTest|LinehaulReceivingConcurrencyTest|DeliveryCashConcurrencyTest|OrderLifecycleConcurrencyTest'
vendor/bin/pint --test tests/Feature/Orders tests/Support/OrderLifecycleFixtures.php tests/Feature/Logistics/HubRoutingConcurrencyTest.php tests/Feature/Logistics/LogisticsPickupWaybillTest.php
```

The PostgreSQL runner creates a temporary database, applies migrations there and drops it when the run exits. Never point `DatabaseMigrations` tests at the application database. A process killed before cleanup may require removing its identified inactive temporary database.

## Limits

- API integration tests execute the real Laravel HTTP kernel, middleware, controllers, services and database writes. Customer/Seller/Logistics web identity is established by the test harness; Courier workflow requests use actual scoped bearer tokens. Authentication regression tests run separately. This is not a connected browser checkout-to-delivery click-through or browser CSRF/cookie verification.
- Geoapify HTTP is mocked and POD storage is a fake local disk. These checks do not establish live map availability, Azure storage permissions or real private-image delivery in deployment.
- Queue/finance simulations in tests do not establish a running production worker/scheduler, real email delivery or movement of real money. Customer-paid COD, Courier cash receipt, platform remittance and beneficiary payout remain separate states.
- Registration/approval setup, every Product/variant/voucher combination, every failure/recovery path and all frontend layouts are not composed into these two success scenarios. The existing role-specific suites provide additional bounded coverage.
- Physical scanners, dock operations and the external Flutter Courier app were not tested here; their completion statuses remain unchanged. The prior Sorting/POD browser evidence has its own stated scope and is not a full marketplace click-through.
- Online payment, refunds, returns, partial fulfillment, signature POD, automatic first-mile rejection/reassignment and exceptional delivery recovery remain outside the implemented P0 contract.

Owning specifications: [Shipment fulfillment](spec.md), [Customer checkout](../../customer/checkout-order/spec.md), [Seller approval](../../seller/accept-order/spec.md), [pickup scheduling](../../orders/logistics-pickups/spec.md), [lane-aware dispatch](../../orders/lane-aware-dispatch/spec.md), [company-truck Linehaul](../../logistics/company-truck-linehaul-dispatch/spec.md) and [delivery confirmations](../../logistics/delivery-confirmations/spec.md).
