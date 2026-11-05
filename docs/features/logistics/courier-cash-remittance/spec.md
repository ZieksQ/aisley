# Courier Cash Remittance

## WHAT
- Logistics receives COD cash from Couriers, separately from paying platform COD invoices.
- Only new authoritative COD delivery confirmations create cash obligations; no historical backfill.
- Logistics Finance owns `/finance/courier-cash` with outstanding balances and receipt history.

## MUST
- Snapshot the final-mile Courier, collector organization, Order reference, currency and exact centavos at delivery approval.
- Pending or rejected delivery proof does not create a collectible cash balance.
- Select full outstanding balances for one Courier and currency; arbitrary and partial amounts are not accepted.
- Require explicit cash-received confirmation. Persist immutable receipts and one allocation per obligation.
- Enforce active Logistics, Sanctum session/CSRF, policy consent and organization ownership server-side.
- Idempotent identical retries return the original receipt. Changed selections or duplicate allocation return conflict.
- Credit the simulated Logistics account exactly once per receipt; retain pending credits while simulation is disabled.
- Do not clear platform invoices, change Order payment status, or create Seller payouts when receiving Courier cash.
- Preserve collector/Courier attribution even if affiliations later change.

## HOW
- GET `/api/v1/logistics/finance/courier-cash` paginates outstanding obligations and returns grouped Courier/currency balances.
- GET `/api/v1/logistics/finance/courier-cash/receipts` returns receipt history with Order allocations.
- POST the receipts path with `obligation_ids`, `confirmed: true`, and UUID `idempotency_key`.
- Serialize organization retry keys, lock selected obligations in stable ID order, then receipt/credit and simulator account; database uniqueness prevents double collection.
- Return private no-store Resources; use integer centavos throughout.
- Follow docs/design.md, existing Finance navigation and @aisley/ui. Verify mobile, keyboard, light/dark, and error states.
- Test tenant isolation, mixed selections, retries, concurrent receipts, balance conservation, and pending-credit recovery.

## Finance date filters and presentation (2026-11-05)

- Apply the shared Finance portal design and `@aisley/ui/date-range` control in both themes, preserving Logistics blue and the existing cash-received workflow.
- Index and receipt reads accept paired inclusive Manila `date_from`/`date_to`, or `all_time=1`, with the [shared validation rules](../../shared/commission-settlement/spec.md#finance-period-reporting-and-portal-refresh-2026-11-05). Filter outstanding obligations by `delivered_at` and receipts by `received_at` before pagination.
- Grouped balances stay current across all dates and are labeled accordingly. Changing the range clears ordinary selection and resets pagination. Busy or uncertain receipts lock filters and retain the original selection/idempotency key for retry.
- No Courier API or external mobile contract changes. New regression coverage exercises filtered obligation/receipt reads alongside existing approval, receipt, funding and ownership tests.
