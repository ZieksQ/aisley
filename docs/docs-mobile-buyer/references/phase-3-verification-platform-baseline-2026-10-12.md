> Imported report from the external Buyer Flutter project, synchronized 2026-10-04.
> Commands/results below were reported there and were not rerun here. Referenced
> `lib/`, `test/`, `tool/`, lockfiles and ignored `build/` reports belong to that project.
> Its adopted backend baseline remains `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`;
> the current platform inspection and adoption gap are recorded in [provenance](source-provenance.md).

# Phase 3 implementation and verification

Date: 2026-10-04. Branch: `feature/buyer-phase-3-commerce`, created from
`feature/buyer-phase-2-discovery-account`. Adopted local Laravel contract baseline:
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`. Running localhost backend revision
is unidentified. No backend, database, server configuration, new dependency or
other checkout changed.

## Implemented scope

- Typed Cart, quote/voucher, Batch, immutable Order and tracking projections;
  required casing/nullability and malformed responses fail closed. Authoritative
  decimal money parses to exact integer minor units within the browser safe range.
- Session-owned Cart replaces full returned snapshots, reconciles selected IDs,
  serializes writes by blocking competing taps and uses the authoritative quantity
  badge. Add/absolute quantity/variant merge/removal use no replay header; an
  uncertain write rereads Cart and asks for review without repeating the write.
- Product Add to Cart and Buy Now require deliberate intent after verified access.
  Checkout uses exactly Buy Now or selected Cart IDs, owned shipping/both address,
  COD and explicit server voucher UUID/target-Shop selections. Address Book return
  refreshes saved choices. Input changes, Cart refresh and expiry invalidate review.
- Quote review shows each Shop's lines, immutable address, shipping/rate version,
  item/shipping discounts and server payable totals. Unknown voucher types cannot
  be selected; zero savings disclose redemption limits. No local discount engine.
- Placement freezes the reviewed payload, quote UUID and secure v4 key. Competing
  placement and Cart writes are blocked while unresolved. Exact-key retry is
  deliberate and survives navigation. Only a valid complete Batch confirms success;
  Cart placement refreshes Cart, while Buy Now leaves Cart untouched.
- Server-filtered Orders and deduplicated tracking pagination refresh on entry,
  foreground return and explicit retry. Failed refresh keeps visibly stale reads
  with mutations disabled; scoped denial clears affected facts.
- Confirmed cancellation carries an optional reason and frozen key. Correction
  sends the known address revision and an owned saved shipping/both row. G21
  restricts correction to changed recipient/contact at the same trimmed street
  lines, barangay, city, province, region, postal code and country. Empty optional
  line two normalizes to null; differing/unverifiable location stays unavailable.
- One session composition owns Cart, checkout and unresolved Order mutations.
  Logout/account loss clears all commerce. Late results are discarded. Consent
  clears private projections/drafts; only minimal unresolved same-identity keys
  and frozen requests survive for deliberate reconciliation after consent resolves.
  Authentication/consent never automatically repeats a commerce write.
- `/cart`, `/checkout`, `/checkout/result/:batch`, `/orders`, `/orders/:order`
  validate protected identifiers. Checkout intent/payloads stay out of URLs and
  ordinary storage. Direct entry offers Cart; sign-in resumes safe reads.

## Executed checks

| Command/check | Result and scope |
| --- | --- |
| `dart format --output=none --set-exit-if-changed lib test` | Passed; 137 files checked, zero changes. |
| `flutter analyze --no-pub` | Passed; no issues. |
| `flutter test --no-pub` | 139 unit/widget tests passed; 20 opt-in live tests skipped. |
| `CHROME_EXECUTABLE=/usr/bin/chromium flutter test --no-pub --platform chrome test/web` | Nine passed; UUID header survives Fetch, cookie/redirect isolation and no automatic mutation retry. |
| `BUYER_LIVE_API=1 flutter test --no-pub test/live` | Twenty public/denial/preflight tests passed against localhost:8000; no authenticated writes. |
| `flutter build web --no-pub` with public HTTPS placeholder defines | Passed; Wasm dry run also compiled. |
| `flutter build apk --release --no-pub` with public HTTPS placeholder defines | Passed; final release APK is 59.7 MB. |
| Port-8766 Chromium navigation and actual idempotency-header preflight | Passed in isolated Chromium; protected commerce guards and POST/PATCH invalid-bearer denial through real preflight. |
| Spec lengths, links, whitespace and privacy review | Passed; 22 Customer specs within 200–230 lines, 605 relative links valid, Progress 65 lines, Python syntax and diff whitespace clean; no secrets/dependencies/backend changes. |

Release defines are public, nonfunctional `https://api.example.invalid` and
`https://shop.example.invalid`. Existing debug signing remains; compilation does
not establish distribution signing or live commerce acceptance.

Synthetic coverage includes exact request bodies/headers, null snapshot IDs,
PHP empty-array tracking locations, monetary precision, unavailable lines, changed
Cart IDs, competing writes, failed reconciliation, quote expiry, late quote replies,
explicit voucher targeting/zero savings, multi-Shop Batch results, Buy Now preservation,
Cart cleanup, lost placement responses/unchanged-key replay, malformed success,
key/quote conflicts, navigation during uncertainty, cancellation races, correction
revision and each G21 location field, consent interruption and account switching.
Widgets cover 320px doubled text, quote/cancel confirmation, 48px primary targets,
short keyboard layouts, direct checkout without intent, Back, guest guards and
unresolved navigation. Dialog text controllers remain alive through exit animation.

## Remaining acceptance gates

- Controlled authenticated Android/browser exchanges for Cart merges/stock,
  serviceability/rates, voucher limits/stacking/capacity, one/multiple Shops,
  reservations/redemptions/atomic rollback and cancellation stock release.
  Synthetic tests cannot certify server locking or transactional behavior.
- Installed Android/TalkBack, native secure storage, foreground/back/keyboard and
  actual permission/network behavior; prior Phase 1/2 live/device gates remain.
- G04 browser Retry-After exposure; G11 live voucher concurrency; G12 process-death
  recovery (keys are memory-only and no GET placement-by-key exists); G21 backend
  rate/coverage revalidation for location-changing corrections. No new CORS or
  backend configuration was applied.
- Existing map credentials/NCR coverage/upload hardening and distribution signing
  gates remain. Phase 4 messaging, Q&A/reviews/support, native push, live Courier
  maps, online payments and returns/refunds remain unavailable.
