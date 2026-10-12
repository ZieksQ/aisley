# B06 historical Order funding verification

## 2026-10-12 — Local development inventory

The user selected the local development environment for B06 verification. The
inventory ran against the configured PostgreSQL database `aisley` at
`127.0.0.1:5436`, with `APP_ENV=local`, from source revision
`67a5ae26786bd7a107e53b8755c7e4906da34205` on
`fix/b06-local-funding-verification`.

Run from the repository root:

```sh
PGOPTIONS='-c default_transaction_read_only=on' php src/api/artisan finance:audit-order-funding --json
```

The command completed with exit code **0** and returned:

```json
{"discrepancies":[],"summary":{"scanned_snapshots":0,"discrepancies":0,"totals_by_currency":[]}}
```

The inventory found no pricing snapshots and therefore no outstanding, terminal
or already-recognized funding discrepancies in this local database. There are no
local records to remediate. PostgreSQL writes were disabled for this invocation;
no migration, seeding, funding adjustment or delivery approval was performed.

This empty inventory supplies no historical-record acceptance evidence. It does
not establish staging/production impact or resolve deployed B06 remediation.
The inventory is an observation during the run, not a locked database-wide
snapshot; finalization continues to recheck funding inside its transaction.

## Existing regression verification

Run from the repository root with isolated SQLite in memory:

```sh
APP_ENV=testing DB_CONNECTION=sqlite DB_DATABASE=:memory: DB_URL='' CACHE_STORE=array QUEUE_CONNECTION=sync SESSION_DRIVER=array php src/api/vendor/bin/phpunit --configuration src/api/phpunit.xml --filter='OrderSnapshotFundingTest|OrderFundingAuditTest|UnfundedLegacyDeliveryTest|LegacyShippingVoucherDeliveryTest|OrderPricingFundingTest|FinanceLedgerTest|CodAutomationTest|DeliveryApprovalTest'
```

Result: **44 tests passed, 589 assertions**, exit code **0**. Delivery evidence
uses fake private storage and gateway/transport fixtures are synthetic.

- Funding unit cases preserve snapshots and reject both a one-cent shortfall and
  a one-cent surplus with `409 ORDER_FUNDING_HOLD`; exact equality, App funding,
  explicit subsidy, zero shipping and snapshot-less compatibility remain covered.
- Inventory cases execute SELECT-only queries, classify outstanding/terminal/
  recognized history, keep shortfalls and surpluses separate by currency, omit
  Customer details, and cover filters, exit codes and 202-row chunk boundaries.
- Historical shortfall cases drive actual proof approval and repeated identical
  requests. Rejection preserves Order/payment, pricing, voucher history, custody,
  revisions, proof and intent; it creates no allocation, journal, invoice, Courier
  cash obligation, completed-delivery event or delivered notification. Direct
  finance recognition rejects before allocation. Paid-prepaid automatic review
  retains only its existing safe fallback metadata, and manual approval stays
  blocked.
- Funded legacy delivery, balanced recognition, remittance and sandbox payout
  pass; committed delivery replay remains unchanged and an injected recognition
  failure rolls finalization back before a successful retry.

The root-level Artisan test helper could not locate its relative PHPUnit path;
the installed PHPUnit entry point above executed the suite successfully. No
application source or tests were changed. PostgreSQL concurrency, live API/
storage/provider exchange, deployment, browser and Flutter/device acceptance
were not exercised.

## Remaining operational acceptance

Follow the [canonical funding and inventory policy](spec.md#historical-funding-inventory)
in each approved release environment before treating its B06 gate as resolved:

1. Record the environment, deployed revision and run timestamp; run the read-only
   inventory and retain its complete output and exit code. Confirm the run
   succeeded before interpreting missing rows as an empty inventory.
2. Review each discrepant Order by classification and currency. Preserve frozen
   financial facts and keep shortfalls separate from surpluses; do not net Orders
   or currencies. Terminal and already-recognized records need separate accounting
   review without reopening them.
3. For affected records, obtain an explicit authorized decision covering the
   funding source, exact amount/currency and accounting treatment. The current
   workflow has no historical funding approval operation; implement any approved
   adjustment separately with an audit trail and verification before retrying.
4. Retain the funding guard until an approved resolution is verified. Route
   reconciliation, invoice backfill, snapshot rewrites and fresh retry keys cannot
   substitute for historical funding approval. Retain rejection/no-effect and
   funded completion/replay coverage when implementing remediation.

**B06 status:** local inventory verified with no affected records; source
mitigation verified by regressions; staging/production inventory and any required
financial remediation remain open. No funding source or adjustment was approved
or inferred, and the external audit report was not modified.
