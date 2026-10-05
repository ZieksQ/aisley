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

## 2026-10-05

- Revised all newly added COD Finance pages with the uncodixfy skill and researched NN/g consistency/error-prevention heuristics, GOV.UK button/table guidance, and W3C table accessibility. Recorded the applied guidance and source links in `docs/design.md` and the canonical COD automation spec.
- Unified role-owned Finance navigation, page gutters, typography, headers, theme-aware shared buttons/fields, underline view selectors, compact financial summaries, and loading/empty/error feedback. Tables now have captions/scoped headers, tabular aligned amounts, readable references, and contained overflow; selection totals and payment consequences sit beside their action.
- Grouped settings into COD/Seller/Logistics sections and detail pages into references, dates, allocations, and attempts. Sandbox accounts use an on-demand editor with PHP balance input converted to centavos; payments and webhook diagnostics use separate view selectors/disclosures. Preserved role permissions, confirmation, idempotency, and payment API contracts.
- Verification: Admin, Logistics, and Seller type/build/lint checks passed; Vite retains its large-chunk warnings. Chromium checks passed across all 6 Admin, 5 Logistics, and 2 Seller routes at 390/768/1440 pixels in light/dark, including aligned gutters, table semantics, dark controls, keyboard access, loading/empty/error states, Admin payout/read-only access, Logistics Pay now/schedule updates, Seller read-only settings, and sandbox editing/balance conversion.
- Visually inspected captured mobile and desktop screenshots, including Admin dark settings/payouts and Logistics dark payment settings. Browser verification used mocked APIs with unchanged production bundle bytes and isolated Chromium sessions; interrupted preview/browser processes were restarted before completing checks. This frontend revision did not change backend or external Flutter contracts.

## 2026-10-04

- Selectively synchronized Buyer/Courier Flutter documentation with imported client evidence and current Laravel 22b0a48. Buyer reports Phase 1–4, Phase 5 tooling and responsive required-sign-in/account-only recency; external Flutter checks are attributed, not rerun. Added current per-Shop provider/options/DTO fixtures and G25 adoption gap while preserving the 57e9eb2 client baseline and remaining acceptance gates. Refreshed only Courier shared shipping context and stale canonical Buyer references; storefront guest behavior, app code/config/dependencies, root instructions, original snapshots, PSGC assets, progress histories and archives remain preserved. Standalone document/contract/provenance validation is recorded in both bundles; no application/backend/Flutter tests or live/device checks ran.

## 2026-10-05

- Refreshed local seeders for current checkout and inventory behavior. Split demo catalog definitions from persistence; preserve account, Shop, Product, SKU, balance, address-pin, provider, sorting-plan, and Courier review state on reruns; add missing local tariff, rate card, acceptance, commission, provider, postal coverage, and sorting plan only when histories/configuration allow. Skip generic role fixtures and the demo catalog/checkout settings in production. Updated the stale checkout pricing test fixture to use Shop Category rate rules and documented local setup. Focused SQLite seeder/checkout/courier tests pass (53 tests/579 assertions); focused PostgreSQL seeder tests pass (16 tests/190 assertions) on a temporary database that was dropped after verification. PHP Pint and diff checks pass.
