# Customer saved-address changes — verification 2026-11-04

Implemented on `feature/order-delivery-address-change`. This records local verification, not deployed API, live-account or external Flutter acceptance.

## Changes and release boundary

Customer Order detail offers saved shipping-address selection followed by server delivery review and explicit confirmation before Seller approval. Current provider, merchandise and voucher redemption facts stay fixed; shipping savings are capped at the revised fee. New address/pricing revisions, current totals and one history event commit atomically. Customer/Seller reference-only alerts are queued after commit and deduplicated per event/recipient. Legacy contact-only PATCH remains compatible.

Deploy `2026_11_04_000001_version_order_address_pricing` before API/frontend rollout. Original pricing history is retained; rollback refuses to collapse committed revisions and requires a forward migration after use. No existing migration or stored Order was repriced by this work. Buyer API handoff is updated; no external Flutter implementation/status is claimed.

## Executed checks

- Focused SQLite API regression: **118 tests, 2,066 assertions**, passed. Command: `php src/api/vendor/bin/phpunit --configuration src/api/phpunit.xml --filter 'CustomerOrderAddressChangeTest|CustomerOrderMutationTest|CustomerOrderStatusTest|CustomerCheckoutTest|CheckoutAddressFingerprintTest|ShippingServiceQuotationTest|OrderPricingFundingTest|OrderFundingAuditTest|OrderLifecycleTest|SellerOrderApprovalTest|NotificationCategoryTest'`.
- Includes saved-address ownership/type/completeness, private failures, expiry/same-second source changes, rate changes, frozen catalog inputs, repeated revisions, App/Shop shipping caps, original commission policies, immutable redemptions, rollback, same-key replay after source deletion/expiry/approval, current snapshot audit selection, owner-only alert visibility and notification deduplication.
- Four connected lifecycle cases pass: original and reviewed local/company-truck Orders progress through Seller approval, pickup, sorting/dispatch, Courier proof, Logistics confirmation, current COD invoices/cash obligations and verified-purchase review. Revised cases retain their confirmed destination and COD through delivery.
- Disposable PostgreSQL concurrency runner: **6 tests, 97 assertions**, passed. From `src/api`: `php tests/Support/run-delivery-postgres.php OrderLifecycleConcurrencyTest`. Independent workers cover checkout retry/stock races, approval/cancellation and address confirmation versus approval, cancellation or another address confirmation. A change committed before approval/cancellation may validly precede that next action; a late change conflicts.
- Storefront TypeScript, targeted ESLint and Webpack production build passed. `node --test src/webapp/tests/order-contact.test.mjs src/webapp/tests/checkout-*.test.mjs` passed all five test files. Scoped Pint, portable contract JSON parsing and `git diff --check` passed.
- Synthetic Chromium smoke uses the actual correction/dialog components, shared Button and built CSS: `node tests/order-contact-browser.mjs` from `src/webapp`. Passed selection/review without writes, confirmation, validation, loading/empty/read failure, quote failure with retained selection, focus containment/restoration, safe Escape, blocked pending edits, exact uncertain retry and success.
- No page/dialog horizontal overflow at **320×740, 390×844, 768×1024, 1440×900 and 390×400**. Long recipient names wrap; dialogs scroll vertically within the viewport. All five final captures reviewed. Fixture text assertions target rendered `#root`, excluding inline script source.

## Component visual review

Used existing storefront composition; no random direction or new assets/dependencies were needed. Purple/light palette and form boundaries follow `docs/design.md`; hero/AIDA and cinematic motion are inapplicable.

Taste inspection on the captured review component at 1440/768/390 returned **0 failures, 2 warnings**. Explicit allowances: purple branding, form/modal borders and no standalone page H1. Warnings (`hero-void`, `unused-canvas`) describe the centered modal's dimmed backdrop and isolated trigger, not missing Order content. All six inspector captures reviewed. Artifacts are local under `src/webapp/node_modules/.cache/order-contact-browser/`; the static inspection capture does not preserve live radio checked properties, so interaction assertions come from Chromium's live React fixture. The fixture uses the system font fallback and does not certify the authenticated shell's Geist delivery.

ROUND 1

Seen in one second: change an Order's delivery address, then review the new delivery total.
Idea (one sentence): keep saved destination choices and their financial consequence together before explicit confirmation.
Live thing: selection requests a server quote; confirmation alone commits the revision.
Layout words by section: dialog=context / saved addresses=selection / review=destination plus fee comparison / footer=keep or confirm.
Scores: design 7.5 · usability 8 · creativity 5 · content 8 → overall 7.1 (subjective task-component assessment).
Caps applied: creative novelty is deliberately low for a familiar commerce task; promotional imagery/motion criteria do not apply.
Top three limitations, with capture and disposition:
1. Long synthetic recipient names increase scrolling on phone/short captures; wrapping and keyboard access pass. Do not truncate recipient information.
2. Desktop inspector captures contain an intentionally dimmed backdrop; preserve modal focus instead of filling that space.
3. This is a component fixture, not an authenticated shell/device capture; live role-shell, deployed, assistive-technology and external Flutter acceptance remain open.
