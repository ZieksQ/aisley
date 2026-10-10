# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:

`

## YYYY-MM-DD

- Feature/change short summary
  `

---

## 2026-10-09

- Archived the complete 179-line merged history at [PROGRESS-2026-10-09.md](logs/PROGRESS-2026-10-09.md) after completing the rebase onto `origin/main` (`ed2b482`). Logistics retains Settings appearance controls and top chat notifications; both histories, contract-gap reconciliation, verification and limits are preserved in the archive. Continue app-wide entries here.

## 2026-10-10

- Fixed audit B01: storefront Checkout freezes the original placement payload/quote/key, blocks shipping/provider/voucher edits and concurrent placement while unresolved, and retries the same request after lost responses, 409 key collisions, 429/5xx or malformed confirmations. Same-tab session storage restores recovery after navigation/reload; auth changes clear private recovery and late responses cannot affect another checkout session. Recognized quote rejections permit refreshed review. Updated Checkout/Voucher specs and added `test:checkout`; no API or Flutter contract changed.
- Verification: 23 checkout regression/render tests and 11 existing session tests passed; storefront TypeScript, scoped ESLint and diff checks passed. Production `next build --webpack` passed (31 static pages); default Turbopack was blocked first by Google Fonts connectivity, then worker port-binding restrictions. Used installed tool binaries because the pnpm launcher could not open its database. Native button/error rendering is covered; real browser responsive, keyboard/focus and live API checks were not run. Recovery remains same-tab/session scoped and does not survive logout or browser storage deletion.

- Fixed audit B02: Laravel now permits recipient/contact corrections only at the same complete trimmed location and seven-decimal map pin. Corrections preserve existing location bytes, frozen pricing/provider/route and immutable history; edited original Address Book rows are allowed, while destination/pin changes return `422 ADDRESS_LOCATION_CHANGE_NOT_ALLOWED`. Order detail adds nullable destination coordinates. Storefront filters saved corrections, explains the restriction and empty state, contains/restores dialog focus, and freezes address/key/revision for uncertain retries. Updated canonical Order/Address specs and affected Buyer contract bundle; external Flutter adoption/status remains unchanged.
- Verification: 27 Customer mutation/status API tests passed (317 assertions, isolated SQLite), 9 new correction tests plus 23 checkout and 11 session tests passed. Chromium exercised actual correction components/shared Button with synthetic transport and built CSS at 390/768/1280px and a short viewport: no horizontal overflow, keyboard focus/Escape/restoration, loading/empty/error/validation, pending, uncertain exact retry and success passed; screenshots were inspected. Scoped Pint/ESLint, storefront TypeScript, production webpack build (31 static pages), Buyer contract checks and diff checks passed. Browser needed sandbox socket access; no live API, PostgreSQL concurrency, production rollout or external Flutter/device checks ran.
