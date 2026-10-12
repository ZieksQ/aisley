# Phase 1 implementation and verification

Date: 2026-10-04. Branch: `feature/buyer-phase-1-auth`.
Contract baseline: `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50` from the local handoff.
The running localhost backend's source revision was not independently identified.
Flutter 3.47.2 stable / Dart 3.13.2; Android minimum SDK 24.

## Implemented scope

- Light Material app composition and Home/Shops/Cart/Account navigation shells.
  Shopping/account workflows from later phases display an unavailable state.
- Typed Customer authentication and policy repositories, strict DTO parsing,
  safe validation/errors, throttling and bounded public policy caches.
- Profile/credential registration, pending approval information, scoped bearer
  login with `device_name`, generic recovery acknowledgement and a reviewed
  storefront recovery handoff. Registration does not create a local session.
- Secure token storage bound to the configured API origin; no plaintext fallback.
  Serialized storage changes and generation checks prevent obsolete responses
  or delayed credential writes from restoring a logged-out/switched account.
  Existing unreadable credentials fail closed even when the platform plugin
  returns null; private storage diagnostics are suppressed.
- One session controller checks `/me` and consent before opening private routes.
  Explicit account/role denial clears identity; policy gating preserves identity.
  Cleanup hooks, request cancellation and local logout apply before remote results.
- Current/history policy reading and explicit version-specific consent. New/stale
  versions clear confirmation; partial acceptance rechecks status before unlocking.
- Native HTTP redirects disabled. The browser JSON adapter uses Fetch with
  `credentials: omit`, `redirect: error`, `cache: no-store`, no referrer and abort
  support. Pinned Dio's XHR adapter cannot reject redirects, so it is not used
  for Phase 1 browser requests. Multipart adapters belong to later phases.
- Overall 15-second request deadline, at most one transient GET retry, no automatic
  mutation replay, integer/HTTP-date `Retry-After` handling and safe field messages.
- Dirty-form cancellation, first-invalid-field focus, text scaling, keyboard
  insets, visible focus and 48-pixel action targets.
- Android Internet permission, disabled backup, release cleartext disabled and
  debug-only localhost/emulator cleartext exceptions.

## Executed checks

| Command / check | Result and scope |
| --- | --- |
| `flutter pub get --offline --enforce-lockfile` | Passed; five approved Phase 1 package pins and existing scaffold dependency preserved. |
| `dart format --output=none --set-exit-if-changed lib test` | Passed. |
| `flutter analyze --no-pub` | Passed; no issues. |
| `flutter test --no-pub` | 55 unit/widget tests passed; five opt-in live tests skipped by default. Browser-only tests use the separate command below. |
| `CHROME_EXECUTABLE=/usr/bin/chromium flutter test --no-pub --platform chrome test/web` | Five tests passed: public/private Fetch settings, rejected redirect/no mutation retry, browser abort, real WebCrypto write/read/delete and API-origin separation, corrupted ciphertext failure. |
| `BUYER_LIVE_API=1 flutter test --no-pub test/live/public_api_test.dart` | Five tests passed against localhost:8000: current/history/version policy contracts, unauthenticated `/me` and consent-status denials, exact-origin CORS preflight. |
| `python3 tool/browser_smoke.py` | Passed in an isolated Chromium profile at localhost:8766: public/auth routes, Cart guard, rendered live policies, app Fetch cookie/redirect settings and real Authorization preflight with an invalid synthetic bearer. |
| `flutter build apk --debug --no-pub` | Passed; local emulator configuration. |
| `flutter build apk --release --no-pub` with HTTPS placeholder defines | Passed; compilation only. |
| `flutter build web --no-pub` with HTTPS placeholder defines | Passed; compilation only. |
| Documentation links, all Customer spec lengths, Android XML and `git diff --check` | Passed; revised Customer specs remain 215 physical lines. |

Release compilation uses public, nonfunctional `https://api.example.invalid/api/v1`
and `https://shop.example.invalid` defines. These builds do not test a deployed API.
The existing application ID and debug signing configuration are preserved; the
release APK is not a signed distribution deliverable.

Unit/widget checks cover exact fixture envelopes/casing/nullability, malformed
responses, active/denied/restored identity, storage failures, account switching,
late responses/writes, cancellation, `401/403/409/422/429`, timeout/offline,
mutation uncertainty, consent races, explicit confirmation and route guards.
Accessibility guideline tests pass for labels, tap targets and contrast; login
also passes keyboard focus and a narrow viewport with doubled text scale.

The live scope is read-only public and denial verification. No real credentials,
account creation, recovery mail, live consent acceptance or logout were exercised.
Screenshots, temporary browser profiles and build outputs are excluded from Git.
No backend, database, CORS configuration or other checkout was changed.

## Local origins and remaining acceptance gates

- API: `http://localhost:8000/api/v1`; Buyer: `http://localhost:8766`.
  Android debug defaults to `http://10.0.2.2:8000/api/v1` for the emulator host.
  Recovery storefront defaults to documented `http://localhost:3000` (emulator
  alias on Android); its recovery page/mail destination was not live-verified.
- Local CORS permits Buyer, Authorization and Content-Type. Browser requests omit
  cookies even though the API allows credentials. `Access-Control-Expose-Headers`
  is absent; the backend owner must expose `Retry-After` for browser cooldowns.
- Controlled real-account login/secure restoration, pending/rejected/suspended/
  inactive outcomes, consent publication/acceptance, revocation and A-B-A switching
  still require live verification. Mocked coverage does not certify those gates.
- No Android device/emulator was available. Installed Android, platform keystore,
  TalkBack, device back behavior, interruptions and actual connectivity remain open.
- Chromium WebCrypto encryption, restoration through a new storage instance,
  API-origin separation, deletion and corruption checks pass with synthetic data.
  Real-account process restart, cookie-session coexistence and all browser/storage
  denial modes remain target gates.
- Native reset deep links, applicant polling/evidence uploads and additional
  account/session controls remain unavailable as specified; later phases are pending.

The broad feature acceptance checkboxes stay open until their complete target
requirements are demonstrated. This record establishes implemented code and the
executed checks above, separately from release acceptance.
