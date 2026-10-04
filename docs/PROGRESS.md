# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:

`
## YYYY-MM-DD
- Feature/change short summary
`

---

## 2026-10-03

- Archived the complete 159-line merged progress log at `docs/logs/PROGRESS-2026-10-03.md` after completing the documentation rebase. Both histories and the conflict-resolution verification are preserved there. Continue app-wide entries here.

## 2026-10-05

- Implemented COD automation: confirmed final-mile delivery issues an immutable collector-scoped invoice, private PDF, and deduplicated notification. Defaults are a 72-hour COD deadline, 14-day Seller wait, and 24-hour Logistics wait, with separate configurable daily collection/payout schedules in Asia/Manila.
- Added Logistics full-balance Pay now, automatic collection, verified gateway clearing, Admin manual receipt rejection and historical collector review, protected payout reservations, manual early Logistics payouts, failed-payment release/reversing entries, and successful payment/payout PDFs. Failed attempts and payout items retain their history; holds cannot race pending payout reservations.
- Added a provider-neutral local HTTP gateway simulator with account balances, API-key authentication, signed asynchronous callbacks, durable idempotency, status recovery, and success/failure/insufficient-funds/delay/duplicate/lost-response scenarios. The simulator moves no real money and defaults off outside local/testing.
- Added isolated Finance remittance/invoice/payment, payout, and settings pages for Admin/Logistics, Admin automation/sandbox controls, and Seller payout history/read-only policy. Shared presentation follows the existing dashboard themes and contained table overflow; role permissions and tenant scoping remain enforced by the API.
- Added the canonical shared COD automation specification and updated affected settlement, dashboard, reporting, schema, workflow, and operating documentation. Applied only the new additive migration to the local PostgreSQL database; historical backfill completed with 0 invoices created.
- Verification: 54 scoped Finance/final-mile/Logistics notification tests passed (777 assertions), PHP Pint passed, and Admin/Logistics/Seller type/build/lint checks passed. Vite reports existing large-chunk warnings.
- Real Chromium checks passed on all 6 Admin, 5 Logistics, and 2 Seller Finance routes at 390/768/1440 pixels in light/dark themes, including keyboard focus, Admin payout/read-only permissions, Logistics Pay now/schedule updates, Seller read-only settings, and applicable unknown-payment/empty/error states. The reusable browser harness uses mocked APIs and unchanged compiled assets; it does not certify live HTTP end-to-end integration.
- Limits: backend regression tests use SQLite; PostgreSQL migration application was checked, but concurrent PostgreSQL/load behavior and a live payment provider were not exercised. Run the existing queue worker and scheduler with the gateway URL/key and webhook URL/secret configured together.
