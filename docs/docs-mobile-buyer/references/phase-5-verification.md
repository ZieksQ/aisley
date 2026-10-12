# Phase 5 integration and local release readiness

Date: 2026-10-04. Branch: `feature/buyer-phase-5-integration-release`, created
from `feature/buyer-phase-4-communication`. Adopted local Laravel contract baseline:
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`. Running backend revision remains
unidentified. Flutter 3.47.2 / Dart 3.13.2 and locked packages are unchanged.

Phase 5 delivers local verification tooling, composed recovery/accessibility tests,
an extended browser smoke and an acceptance runbook. Production distribution and
controlled authenticated/device acceptance remain open. No production feature,
API/DTO, dependency, backend, database or server configuration changed.

## Repeatable local verification

Run from the Buyer repository using the existing SDK and Python 3:

```sh
python3 tool/verify_release.py
python3 tool/verify_release.py --live --browser --report-name with-targets
python3 tool/verify_release.py --checks format tooling bundle --report-name focused
```

The default suite resolves the committed lockfile, checks Dart formatting without
rewriting, analyzes, runs unit/widget and Chromium tests, verifies the Python tools
and documentation/assets/Android boundaries, then compiles web and release APK.
Builds use public `https://api.example.invalid` and `https://shop.example.invalid`
placeholders with maps disabled. They establish compilation only. APK signing still
uses the existing debug configuration; application ID remains
`com.example.aisley_mobile_buyer`. Neither is approved for distribution.

Reports go to ignored `build/verification/<report-name>.json`. Each records commands,
passed/failed/blocked results, durations, app revision/dirty flag, filtered SDK
identifiers, lockfile SHA-256, public configuration, baseline and external gates. Raw child output,
environment values, credentials, screenshots and private response bodies are not
recorded. Rerun a failed recorded command locally for diagnostics, respecting privacy.
Exit 0 means every requested check passed; 1 means failure; 2 means a requested check
was blocked. Focused runs are marked partial. External gates remain even after exit 0.
Requested checks run in dependency order; failed dependency resolution blocks the
dependent tests/builds while independent formatting/tooling/bundle checks continue.

`--live` opts into the existing public/denial/preflight suite. It uses no approved
account and performs no authenticated writes. `--browser` requires Chromium,
chromedriver and an already running Buyer at exactly `http://localhost:8766` plus
the authorized API on port 8000. The runner never starts or modifies Laravel.
In another terminal, once the backend owner has started the API:

```sh
flutter run -d web-server --web-port 8766 --dart-define=API_BASE_URL=http://127.0.0.1:8000
```

The browser smoke uses an isolated temporary profile. It now checks reload,
browser Back and narrow/wide/landscape Home in addition to prior public navigation,
protected guards and actual cookie/redirect/preflight/denial checks. A running browser
without a live API does not pass that acceptance check.

## Executed checks and gate matrix

Prior phase live results remain historical evidence; they are not relabeled as new
Phase 5 results. The final local runner report records the Phase 4 parent revision
`52fabad9cc0f28c38938263b24ffbaa3df6703a2` plus a dirty-tree flag because these Phase 5
changes were verified before commit. Ignored reports can be regenerated at any commit.

| Command/check | Actual result |
| --- | --- |
| `python3 tool/verify_release.py --report-name final-local` | All nine default local checks passed; exit 0. |
| `flutter pub get --enforce-lockfile` | Passed; SDK and locked dependencies unchanged. |
| `dart format --output=none --set-exit-if-changed lib test` | Passed after formatting the new tests. |
| `flutter analyze --no-pub` | Passed. |
| `flutter test --no-pub` | Full unit/widget suite passed, including two composed recovery and sixteen accessibility cases; opt-in live tests skipped. |
| Chromium `flutter test --no-pub --platform chrome test/web` | Existing ten Fetch/WebCrypto/multipart tests passed, with discovered Chromium supplied as CHROME_EXECUTABLE. |
| `python3 -m unittest discover -s tool -p '*_test.py'` | Ten tests passed: status/exit codes, privacy, missing tools/API, timeout cleanup, dependency ordering and negative link/Android checks. |
| `python3 tool/verify_bundle.py` | Local links, all 22 Customer spec lengths, all 19 source/runtime PSGC hashes/registrations and Android security boundaries passed. |
| `flutter build web --no-pub` / `flutter build apk --release --no-pub` | Passed with the runner's explicit HTTPS placeholder defines; existing debug signing. |
| `python3 tool/verify_release.py --checks tooling bundle --live --browser --report-name target-readiness` | Tooling/bundle and all 42 public/denial/preflight tests passed after API recovery; browser initially blocked because Buyer was not running; exit 2. |
| `flutter run --no-pub -d web-server --web-port 8766 --dart-define=API_BASE_URL=http://127.0.0.1:8000` plus `python3 tool/verify_release.py --checks tooling bundle --browser --report-name final-browser` | Buyer served at localhost:8766; extended isolated Chromium smoke and tooling/bundle passed; exit 0. |
| Public policy status/CORS header visibility | HTTP 200, exact `Access-Control-Allow-Origin: http://localhost:8766`; `Access-Control-Expose-Headers` absent, so G04 remains open. |
| `adb devices -l` | ADB succeeded with no attached devices. |
| Python syntax / `git diff --check` | Passed. |

The initial `--live --browser` run passed tests/builds but reported one formatting
failure and both target checks blocked. The new test formatting was corrected and
the complete final local run passed. The API subsequently became reachable without
Buyer starting/modifying Laravel. A focused target-readiness run passed live checks
but correctly blocked the absent Buyer server; after starting Buyer, the final browser
run passed. Unavailable requested checks exit 2, never success. Tooling and bundle
checks were rerun after final documentation/security-validator changes.

| Gate | Evidence / result | Remaining boundary |
| --- | --- | --- |
| Formatting, analyzer, locked dependencies | Final runner results recorded below | Local tools only |
| Synthetic recovery/security | Photo/Cart/Checkout/Shop state shares one SessionController; consent retains uncertain intents without replay; A→B→A and revocation clear state; late photo/chat successes cannot restore A | Controlled auth, server revocation and concurrency |
| Synthetic accessibility | Sixteen Home/Account/Checkout/Shop-composer cases at 320×640, 1024×768 and 640×320, including doubled text; Android tap-target, label and contrast guidelines; quote review and keyboard/Tab; no placement/send | TalkBack, native keyboard/Back and permissions |
| WebCrypto/Fetch/multipart | Existing Chromium suite runs separately | Fixed-origin real browser/account behavior |
| Browser/live API | Public/denial/preflight suite and extended actual localhost:8766 browser smoke passed after API recovery | Authenticated cookie isolation/private media and browser-visible Retry-After remain open |
| Installed Android | `adb devices -l` succeeded and listed no devices | Install and exercise approved target; no installation/runtime claim |
| Web/release APK | Public HTTPS placeholder builds; final results below | Release origins, owner application ID/version/signing and installed acceptance |
| Backend identification | Adopted baseline known; running revision unknown | Owner supplies deployed commit and nonsecret config/version evidence |

Broad mixed live/device criteria in [verification](../verification.md) remain
unchecked unless their complete criterion is evidenced. Passing widgets/builds do
not establish live flows.

## Controlled authenticated and installed-device runbook

This runbook prepares future acceptance; its authenticated writes are neither
authorized nor executed by this Phase 5 public-check scope. Before that separate run,
the owner supplies approved development accounts/data and explicitly scopes writes.
Enter credentials interactively; never put them in commands, fixtures, reports,
ordinary preferences, screenshots or commits. Record scenario ID, app/backend revision,
target/OS/browser version, result and sanitized blocker; omit device serials/private data.

1. **Environment and transport.** Record deployed commit separately from the contract
   baseline, approved API/storefront origins, SDK/lockfile and build type. At
   localhost:8766 verify exact Authorization/Content-Type/Idempotency-Key CORS
   preflights, cookie omission, redirect rejection and browser-visible `Retry-After`
   (G04). Keep Buyer outside Sanctum stateful-cookie domains. Server changes belong
   to the backend owner.
2. **Android installation.** Select an attached approved device without recording its
   serial. Build/install the debug APK for emulator testing; use the documented
   `10.0.2.2:8000` API and port-3000 storefront defaults. A physical device requires
   reachable approved HTTPS origins; its localhost is not the workstation. Verify
   installed public launch before authentication. Placeholder release hosts cannot
   establish connectivity.
3. **Session and approval.** Verify approved A signs in with `device_name`, then cold
   start resolves `/me` and consent without private flashes. Exercise absent/revoked
   token, owner-prepared pending/rejected/suspended/inactive/wrong-role cases, offline
   startup, timeout and storage failure. Verify logout/offline notice/deletion retry
   and A→B→A cleanup across photos/history/drafts/quotes/read markers. Delay responses
   during switching and ensure obsolete successes/errors cannot restore private data.
4. **Policies and recovery.** With owner-prepared enforcement/publication states,
   verify both policies, explicit unchecked acceptance, stale version conflict,
   partial success and consent during commerce/chat requests. Recovery resumes safe
   reads without replaying blocked writes. Separately authorize registration and
   mail/reset verification: pending/no token, generic recovery, trusted storefront,
   expired/reused reset rejection and actual bearer invalidation.
5. **Account, uploads and addresses.** Verify profile allow-list/read-only email,
   password change preserving current bearer/revoking others, default-off promotion
   preference and authenticated avatar bytes. Use approved nonprivate test images
   for native picker/browser bytes, cancel/permission denial, format/size limits,
   partial failure and uncertain-upload reread. Verify no public avatar/token leak,
   and interrupted picker/account switching. Verify offline PSGC/manual save, NCR
   Province text against deployed coverage, foreground GPS denial/permanent denial.
   Maps stay disabled without approved public configuration; pin/provider failure
   preserves manual text saving.
6. **Discovery and saved state.** Verify server visibility/vacation/stock, variants,
   search pagination/error/end, 12-hint guest recency, Wishlist ownership and
   acknowledged-only guest merge. Logout never copies private history into guest
   storage; matching Product IDs across accounts cannot reuse private data.
7. **Commerce and uncertainty.** With explicitly approved disposable development
   Orders, verify uncertain additive Cart canonical reread, Buy Now leaving Cart
   unchanged, selected-Cart atomic multi-Shop COD, authoritative shipping/stock/voucher
   totals and expiry. Inject response loss only through approved test transport;
   deliberately reconcile exact frozen key/payload. Backend owner confirms one
   batch/reservation/redemption. Verify stale quote review and key/payload conflicts.
   Process-death recovery stays G12; restart cannot imply failed placement or authorize
   a replacement write.
8. **Orders.** Verify owned/foreign detail and tracking, Seller transition races,
   cancellation/release and revisions. Only same-location recipient/contact correction
   is enabled under G21; Address Book edits never rewrite placed Orders. No provider
   assignment, live Courier GPS or refund capability is inferred.
9. **Communication and contributions.** Use independently authorized Seller,
   Logistics and accepted final-mile Courier counterparts in their existing apps;
   Buyer calls Customer routes only. Verify first-send/reply/read, separate cursors,
   older pages, foreground/background/offline recovery, exact-key reconciliation,
   custody/reassignment/read-only history and participant isolation. Verify public
   Q&A, delivered-item Review eligibility/identical replay/partial photos, notification
   destinations/post-display reads and support revision/reopening/older cursors.
10. **Accessibility and teardown.** On Android use TalkBack, large text, 48px targets,
    focus order, keyboard insets, portrait/landscape, native Back and dialogs. In the
    fixed-origin browser verify Tab/focus/Back/reload/errors. Exercise foreground
    read recovery without duplicate writes. Sign out and clean test records/profiles
    only through approved owning flows; preserve unrelated user/device data.

## Open release decisions

Retain G04/G07/G11/G12/G15/G16/G18/G20/G21/G22/G23/G24 and other unresolved
[integration gaps](integration-gaps.md). Owners must provide header/cookie isolation,
map suitability, voucher concurrency, restart-recovery design, upload hardening,
retention/abuse/concurrency, support traversal, shipping coverage and registration-path
privacy evidence. Deferred APIs remain unavailable; mocks never unlock live features.

Distribution needs reachable HTTPS origins, owner application ID/build version,
production signing/keystore handling and installed acceptance. Never commit signing
credentials/keystores or private configuration. No publishing, new production signing
identity or backend changes are included in this local-readiness task.
