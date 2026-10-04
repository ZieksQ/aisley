# Automatic COD invoicing, remittance, and payouts

## WHAT

- Issue COD remittance invoices after Logistics confirms final-mile delivery.
- Bill the final-mile organization that collected the cash, not the pickup provider.
- Collect outstanding invoices in organization/currency batches through a local gateway simulator.
- Pay Seller proceeds and committed Logistics service allocations on independent schedules.
- Admin controls deadlines, payout delays, outgoing run times, and automation switches.
- Logistics chooses its daily COD collection time and can pay outstanding invoices manually.
- Admin and Logistics have dedicated Finance remittance, history, and settings screens.
- Seller has its own payout history, receipts, and read-only applicable payment rules.
- Existing commission, recognition, allocation, financial hold, and ledger rules remain authoritative.
- Live gateway integration, real money, tax invoices, refunds, and Courier earnings are outside this feature.

## MUST

### Invoice issuance and ownership

- Create one invoice per COD Order in the authoritative confirmed-delivery transaction.
- Snapshot collector organization/name, Order reference, currency, and integer centavo amount.
- Capture collector ownership from final-mile Shipment custody at delivery finalization.
- Include the collector snapshot in the authoritative delivery event.
- Keep customer collection, platform remittance, and beneficiary payout states separate.
- The customer-facing Order remains delivered/paid while its COD invoice may remain outstanding.
- Default COD deadline is 72 elapsed hours after confirmed delivery.
- Default Seller eligibility is 336 elapsed hours after confirmed delivery.
- Default Logistics eligibility is 24 elapsed hours after confirmed delivery.
- Persist deadlines and eligibility timestamps; later delay edits affect future deliveries only.
- Generate a private invoice PDF and issue a deduplicated in-app notification after commit.
- Scheduler recovery retries missed document/notification dispatch.
- Existing cleared allocations reduce the invoice's remaining balance.
- Pending manual allocations reserve invoices until cleared or rejected.
- Historical collector evidence without an immutable organization snapshot enters Admin review.
- Admin may resolve missing historical ownership using an organization and reviewed-evidence reason.
- Do not silently attribute historical multi-carrier Orders to their original pickup provider.

### Incoming collections

- Default daily Logistics collection time is 09:00 Asia/Manila.
- Logistics may customize its own time; platform deadline and payout policy remain Admin-controlled.
- Collect outstanding invoices issued before the scheduled run cutoff, including overdue invoices.
- Invoice issuance does not immediately debit the organization.
- Do not wait until the payment deadline to perform scheduled collection.
- Pay the full remaining balance of each selected invoice; group only one currency per payment.
- Both manual and scheduled collections reserve invoices atomically.
- Reusing a payment key with another selection returns a conflict.
- Already reserved invoices cannot enter another collection or manual receipt.
- Only a verified terminal gateway success automatically clears a gateway remittance.
- Clearing posts existing balanced COD cash/receivable entries exactly once.
- A failed collection releases reservations while retaining batch, allocation, and attempt history.
- Failed collections retry at the next daily run or through Logistics Pay now.
- Unknown or delayed payments stay reserved while querying/retrying the same transaction identity.
- Never create a replacement payment merely because the original response was lost.
- Overdue invoices remain collectible and visible; notify Logistics and authorized Admins once.
- Overdue status does not automatically suspend the organization.
- Admin reviews legacy manual receipts; rejection requires a reason and releases pending allocations.
- Admin cannot directly clear or reject a processing gateway payment.

### Outgoing payouts

- Default Seller and Logistics outgoing runs are daily at 09:00 Asia/Manila.
- Admin can customize these times independently and pause each automation direction.
- Eligibility countdown begins at delivery, not at remittance clearance.
- Require full COD remittance, no active financial hold, and positive recorded liability. Holds cannot be placed while funds are already reserved for a pending payout.
- Respect committed actual Logistics provider allocations; do not invent new commission shares.
- Admin can manually send payouts for selected obligations belonging to one beneficiary/currency.
- Admin may bypass the Logistics waiting period with explicit confirmation and no written reason.
- Early manual payment still requires cleared COD, no holds, and an unreserved obligation.
- Seller manual payouts cannot bypass the configured Seller waiting period.
- Automatic and manual payout reservations cannot consume the same obligation twice.
- Failed payouts append reversing ledger entries and release items without deleting history.
- Successful payouts append cash/payment entries once and expose payment receipts.
- Keep pre-existing sandbox payout history and protect gateway-backed payouts from legacy callbacks.

### Gateway simulator contract

- Use a provider-neutral REST API implemented in the existing Laravel application.
- Require a server API key for simulator create/status requests.
- Accept direction, amount_cents, currency, account_reference, metadata.attempt_id, and Idempotency-Key.
- Return an opaque transaction UUID, pending/terminal status, and livemode=false.
- Same idempotency key and payload identifies the same transaction; mismatched payload returns 409.
- Store simulator transactions separately from platform payment reservations and ledger entries.
- Process gateway balance movement asynchronously and atomically.
- Sign webhook raw bytes with timestamped HMAC-SHA256 using a separate webhook secret.
- Reject invalid signatures, timestamps outside five minutes, and live-mode results.
- Persist accepted events before queuing processing; deduplicate by event ID.
- Match attempt, provider reference, direction, account, currency, and amount before resolution.
- Terminal platform outcomes cannot regress when callbacks arrive late or repeatedly.
- HTTP status queries can recover a missing webhook through the same result verifier.
- Support success, failure, insufficient funds, delay, duplicate callback, and lost-response scenarios.
- Admin can resolve delayed transactions and replay signed events.
- Do not expose gateway credentials or private Customer data in sandbox traces.
- Disable the gateway by default outside local/testing unless explicitly enabled.
- Queue workers must execute outbound HTTP; browser requests must not synchronously call themselves.

### Authorization and web behavior

- Browser endpoints retain Sanctum, active-role checks, consent gates, and server-derived tenant scope.
- Admin reads require finance.view; mutations additionally require finance.manage.
- Seller reads are scoped to its Shop; Logistics reads/payments to its organization.
- Invoice and payment PDFs require the same authorization as their owning records.
- Financial responses and downloads use private no-store caching.
- Follow docs/design.md for mobile-first layout, supported themes, focus, forms, and feedback.
- Follow the Finance workflow page guidance in docs/design.md: aligned headers/navigation, underline view selectors, grouped settings, scoped table headers, and explicit selection totals.
- Contain table overflow; keep payment actions reachable at narrow widths. Sandbox account editing and diagnostics use disclosure rather than overwhelming the initial view.
- Preserve the idempotency key after a recoverable uncertain mutation in the mounted workflow.
- Server reservations remain authoritative after reload, permission loss, or navigation.
- Use confirmation before sending money or changing payment policy.
- Never show a failed read as a verified empty result.

## HOW

### Pages and APIs

- Admin: /finance/remittances, /finance/remittances/invoices/:invoiceId, /finance/remittances/:batchId.
- Admin: /finance/payouts, /finance/automation, /finance/sandbox.
- Logistics: the same remittance/detail routes, /finance/payouts, /finance/payment-settings.
- Seller: /finance/payouts and read-only /finance/payment-settings.
- Existing /finance overview remains available through role-owned Finance navigation.
- Role Finance APIs add GET /automation, /payout-history, /payout-obligations, /payout-history/{id}/receipt.
- Admin/Logistics add GET /invoices, /invoices/{id}, /invoices/{id}/pdf, /remittances, /remittances/{id}, /remittances/{id}/receipt.
- Admin/Logistics PATCH /automation uses role-specific allowed fields.
- Logistics POST /invoice-payments accepts invoice_ids and UUID idempotency_key; returns 202 attempt.
- Admin POST /payout-send accepts beneficiary type/id, order_ids, early, and UUID idempotency_key.
- Admin POST /invoices/{id}/collector and /remittances/{id}/reject own historical review.
- Admin GET /sandbox, PUT /sandbox/accounts, POST /sandbox/payments/{id}/resolve, /sandbox/events/{id}/replay.
- Machine POST /api/v1/sandbox-gateway/payments and GET /payments/{id} use gateway credentials.
- Machine POST /api/v1/finance/gateway/webhook uses the signature, not browser permissions.
- Preserve existing /payouts reporting envelope and legacy manual submission/clear APIs.

### Persistence, operation, and verification

- Use additive migration 2026_10_05_000001_add_cod_automation; never edit previously executed migrations.
- New UUID records store invoices, settings, automation runs, payment attempts, gateway accounts/transactions/events, and webhook receipts.
- Store new enum-like values as strings with PHP enum casts.
- Preserve failed payout items using released_at; beneficiary locks serialize active reservations.
- finance:automate runs every minute and executes each due daily scope once using a persisted cutoff/run record.
- A missed daily tick catches up on the next tick; after-day backlog enters the next daily run.
- Reconcile unresolved attempts and unprocessed webhook receipts every five minutes.
- Apply the migration, then run finance:backfill-invoices for historical delivered COD Orders.
- Run the existing queue worker and scheduler; configure gateway URL/key and webhook URL/secret together.
- Reuse the installed PDF renderer and private local storage for invoice documents.
- Test ownership, deadlines, schedules, full balances, duplicate callbacks, unknown recovery, failures, holds, retries, permissions, and PDFs.
- Test gateway API authentication, idempotency, status retrieval, signed delivery, and simulated balance conservation.
- Run scoped backend regressions plus three dashboard builds/lints and responsive/theme/browser checks.
- Record actual verification and any remaining limitations in docs/PROGRESS.md.
