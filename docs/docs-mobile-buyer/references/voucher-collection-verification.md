# Buyer voucher collection verification — 2026-10-11

G28 Buyer source adoption implements discovery/detail, Shop and platform collection,
My Vouchers and deliberate Checkout requote against inspected Laravel
`7e89b3912c040bc6fb7e5cebd8f9db65424b9800`. It consumes the existing additive
collection migration/API. General historical `57e9eb2` and shipping `22b0a48`
adoption records remain separate. Deployed backend revision/schema is unidentified.

## Implementation and recovery

- `/vouchers`, `/vouchers/:id`, `/account/vouchers`, Home discovery, Account wallet and independently paginated Shop vouchers use existing Flutter/Dio/ChangeNotifier/GoRouter and light theme; no dependencies were added.
- Public definitions/cache never contain account status. Bounded private status reads, wallet and collection use verified leases; logout/account/consent loss clears private state and rejects obsolete responses.
- Detail uses private statuses first for targeted/retained history. Shop collection derives its exact issuing slug/UUID from typed server metadata. Collection URLs are never executed as mutations.
- Collection is explicit, suppresses duplicate taps, respects cooldown and retries the same naturally idempotent endpoint after an uncertain response. Resource denial blocks repeat collection until fresh status succeeds.
- Checkout collection invalidates the editable quote and preserves intent/address/provider/applied choices. Back requires explicit Review order, eligible selection and another reviewed quote. Unresolved placement retains its original frozen key/payload; collection never automatically selects, redeems or places.

## Checks actually run

- Full Flutter suite: **591 passed / 42 live opt-in skipped**, including the first 50 voucher contract/state/widget checks and existing Checkout recovery suites.
- Final focused voucher suite: **53 passed**, adding explicit 401/role-denial/renewed-consent cleanup to the initial coverage.
- Flutter analyzer passed with no issues after restoring ignored SDK package mappings from the existing lockfile. `flutter pub get --offline --enforce-lockfile` succeeded; no package/lock change.
- Android release APK passed (92.7 MB); existing SDK XML/Java/plugin deprecation warnings were nonfatal. Web release build passed using public HTTPS placeholder origins and local web resources. Browser API exchanges were intercepted; no placeholder or synthetic credential reached Laravel.
- Chromium passed **28 layouts**: discovery/detail/wallet/Shop at 320/390/600/800/1024/1440 widths and 640×320 landscape. Synthetic journeys verify login-return without automatic collection, lost-response exact Shop collection retry, wallet/history/empty states, collect→Back→explicit requote→select→review without placement, refresh/throttling recovery, keyboard focus and public credential separation (**8 journeys**).
- Widget checks include doubled text, pending/disabled/error states, 48px collection controls, Shop endpoint isolation and actual Checkout handlers. Controller checks cover malformed responses, schedule/capacity conflicts, 422/429, late status versus collection, retained targeted/history access, account switching, and frozen Buy Now/Cart placement recovery.
- Phone Shop and short-landscape Checkout screenshots were inspected. Synthetic screenshot data is not production content or installed-device evidence.

Ignored local reports live under `build/voucher-*.log` and
`build/verification/vouchers/report.json`. The reproducible browser command is
`python3 tool/browser_vouchers.py` against the built app served at localhost:8766.
The browser harness intercepts every API path before startup and uses invented data.

## Remaining acceptance gates

Controlled real-account collection/quote/placement, deployed revision/schema/provider
configuration, installed Android/system Back/TalkBack, exact-origin deployed CORS and
production signing remain open. No API source, migration, seeding, database, live
account, provider configuration or deployment change was performed. Builds and
synthetic tests do not establish production behavior. Both repositories remain
uncommitted under the user's instruction; relevant changes are staged for review.

Documentation checks passed: Buyer bundle validated 862 local links, all 22 Customer spec lengths, 19 PSGC checksums/registrations and Android boundaries before the progress append. Changed portable links, JSON, preserved historical operation records plus seven additive operations, configured formatting and Git whitespace checks also passed.
