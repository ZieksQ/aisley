# G25 shipping selection — 2026-10-09

Buyer now adopts the shipping contract inspected at Laravel
`22b0a48f9575ead182d03c35ab87345711c23b90`. The general historical API baseline
remains `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; the supplied webapp review
`0a6aaa8096196e2c26822ac0281d5d30675511a8` and deployed revision are separate.
Implementation uses the existing Flutter 3.47.2 / Dart 3.13.2 stack and dependencies.

## Implemented behavior

- Authenticated logistics-options POST uses bounded read retries and omits selections/key.
  Initial address loading and address/item-intent/voucher changes discover options automatically.
  Session/query generations reject obsolete successes and errors.
- Every Shop shows returned provider names and fees. Empty success blocks review;
  multiple options require explicit radio selection. One option preserves server fallback.
  Removed explicit choices require confirmation even when only one replacement remains.
- Quote/place carry immutable, Shop-sorted `logistics_selections`. Address, items,
  vouchers and providers invalidate review. Explicit quote providers must match selections.
  Placement remains dependent on an unexpired valid COD quote and deliberate confirmation.
- Quote/Batch parsers consume current provider/route/final-fee projections. Batch snapshots
  and provider fields support documented legacy nulls; Order list/detail/mutations require
  nullable `shippingProvider`. Provider/fee facts appear in review, results and Orders.
- `unplanned` remains commercially serviceable with an explicit unconfirmed-route/no-time
  explanation. Unknown route values disable unsupported checkout actions.
- Provider/configuration/parcel failures use safe messages. Failed reads remain errors;
  Retry-After gates repeat requests. No raw server messages or database traces are displayed.
- Uncertain placement retains original key, quote ID and deeply frozen provider payload.
  Exact retry performs no discovery, substitution, requote or new-key placement. Same-identity
  consent recovery retains only unresolved requests; logout/account loss clears private state.
- Order provider changes remain unavailable. G21 contact-only correction restrictions remain.

## Executed checks

| Check | Result |
| --- | --- |
| `dart format --output=none --set-exit-if-changed lib test` | Pass: 218 files, zero changes |
| `flutter analyze --no-pub` | Pass: no issues |
| `flutter test --no-pub --reporter expanded` | Pass: 341 passed, 42 opt-in tests skipped |
| Shipping contract/controller/widget tests | 33 tests included in the passing suite |
| `flutter build web --release --no-pub` | Pass: 87.6 seconds |
| `flutter build apk --release --no-pub` | Pass: 87.9 seconds, APK 91.5 MB |
| `python3 tool/browser_smoke.py --synthetic-shipping` | Pass: explicit choice/change/review at 390×844 and 1440×900 |
| `python3 tool/browser_smoke.py --synthetic-journey-only` | Pass: implicit single-provider Buy Now/selected Cart journeys |
| `python3 tool/verify_bundle.py` | Pass: links, all 22 spec lengths, PSGC registration/checksums and Android boundaries |
| Python browser-harness compilation; `git diff --check` | Pass |

Both builds use public HTTPS placeholders `https://api.example.invalid/api/v1`
and `https://shop.example.invalid`. Browser verification serves the release at
`http://localhost:8766` and intercepts all API requests before startup. Synthetic
sign-in, Cart actions and quotes contact no Laravel/provider service. Placement
confirmation is cancelled; exact placement replay is verified with fake transport.

Coverage includes documented shipping scenarios, multi-Shop choices/shared providers,
implicit-to-explicit input change, removed choices, shipping-voucher updated savings,
legacy null/required fields, unknown routes, stale/changed input and key collisions,
response loss/expiry, delayed discovery, logout, consent recovery, throttling and read retry.
Provider radio labels, 48-pixel controls, text contrast, native keyboard focus/arrow
selection and quote invalidation pass at 320×640 and 640×320 with doubled text,
390×844 and 1440×900. Existing checkout address accessibility checks also pass.

The broader Python tooling suite reports 10 passes and one pre-existing negative-fixture
failure in `verify_bundle_test`: its ordinary-document link now resolves through the
existing `docs/logs/references/phase-1-verification.md` forwarder. The verifier and that
test are unchanged; the actual bundle passes. This feature does not alter archival tooling.

## Remaining acceptance

No Android device was available. Installed Android/TalkBack, real accounts, controlled
multi-Shop COD placement/replay, operational shipping, exact CORS/Retry-After visibility
and deployment-owner schema/provider configuration checks remain open under G25.
Production signing/distribution and memory-only process-death recovery remain existing gates.

Historical provider failures do not establish a current outage or a Flutter cause.
No backend files, schema, migrations, seeds, provider configuration, dependencies or
secret-bearing environment files were changed. Builds and synthetic checks establish
client behavior and compilation, not deployed quote eligibility or fulfillment readiness.
