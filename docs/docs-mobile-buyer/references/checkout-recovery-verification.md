# Checkout recovery — 2026-10-09

The Buyer checkout recovery audit addresses client behavior on
`fix/buyer-checkout-recovery`. The general adopted API baseline remains
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; shipping remains
`22b0a48f9575ead182d03c35ab87345711c23b90`. The deployed revision is unidentified.

## Recovery behavior

- Placement uncertainty survives subsequent failed exact retries, including generic
  conflicts, validation, resource denial and throttling. The original UUID key,
  quote ID and complete immutable payload remain bound to the verified identity.
- Retry-After blocks exact retry during cooldown. Cooldown expiry never sends a
  request. Refresh, competing checkout intents and fresh-key placement remain blocked
  while the original outcome is unresolved.
- Documented QUOTE_EXPIRED, QUOTE_INPUT_CHANGED and QUOTE_STALE responses clear
  placement validity and require fresh review and deliberate placement. Safe choices
  remain available where still authorized. Resource denial clears affected projections.
- QUOTE_ALREADY_PLACED and IDEMPOTENCY_KEY_REUSED preserve the blocked record and
  direct the Buyer to Orders. Visiting Orders does not itself resolve the record.
- Confirmation uses the exact quote snapshot displayed in its dialog. Expiry or a
  replacement quote prevents placement and requires review again, including when a
  synthetic replacement reuses the same quote ID. Duplicate confirmation is guarded.
- Same-identity consent interruption preserves only the frozen unresolved placement.
  A temporary consent check also retains uncertainty when it hides a success or error
  response without resetting checkout. Identity loss clears private state, and obsolete
  responses cannot report success.

## Executed regression evidence

The existing checkout/shipping/controller recovery baseline passed 41 tests.
Before the fix, seven new regression cases failed because rejected retries discarded
the unresolved placement, including throttling after a consent interruption.
Two further regression cases reproduced response loss during temporary consent checks;
the final guard marks the exchange unresolved before sending and classifies only a
current response.

Focused checkout, shipping, navigation, recovery and accessibility checks passed
118 tests. The new files add 21 controller and eight widget cases. Coverage includes
timeout followed by 403/404/409/422/429/503, repeated transport/decode failures,
cooldown expiry without automatic writes, documented quote conflicts, key collisions,
safe validation input, voucher/provider retention and overlapping submits.

Widgets verify current/expired/replaced confirmation at 320×720 with doubled text
and 1440×900 with normal text. Throttled recovery retains its frozen record across
Orders navigation, keeps retry disabled and exposes labeled 48-pixel Orders controls.
Existing broader checkout keyboard, focus, landscape and address checks also pass.

| Check | Result |
| --- | --- |
| `dart format --output=none --set-exit-if-changed lib test` | Pass |
| `flutter analyze --no-pub` | Pass |
| `flutter test --no-pub` | Pass: full Flutter suite; live checks remain opt-in |
| `flutter test --no-pub --platform chrome test/web` | Pass |
| `python3 tool/verify_bundle.py` | Pass: links, all 22 Customer spec lengths, PSGC and Android boundaries |
| `flutter build web --no-pub` with public HTTPS placeholders | Pass: release compilation |
| `flutter build apk --release --no-pub` with public HTTPS placeholders | Pass: release compilation |
| `python3 tool/browser_smoke.py --synthetic-shipping` | Pass: final release at localhost:8766, mobile/desktop provider choice and reviewed checkout |

The configured release runner executes these checks with
`python3 tool/verify_release.py --checks format analyze unit chrome bundle web-build apk-build --report-name checkout-recovery`.
Its local machine report is under ignored `build/verification/checkout-recovery.json`.
Both builds use public `https://api.example.invalid` and `https://shop.example.invalid`
configuration. Browser verification intercepts every API request before startup and
cancels placement confirmation. Exact placement replay is covered by fake transport
tests; no real account, commerce or provider exchange ran.

## Remaining acceptance

Synthetic responses establish client guards and exact request reuse. They do not prove
deployed atomic transactions, reservations or voucher redemptions. Controlled live COD
placement/replay, actual CORS/Retry-After exposure and installed Android/TalkBack remain
open under the existing verification gates.
Android device enumeration found zero ready connected targets. Release compilation
does not close installed-device, production signing or distribution acceptance.

Pending state remains session memory only; process-death recovery remains G12. There
is no new GET-by-key endpoint or durable storage. Backend, dependencies, private
credentials and provider configuration are outside this change.
