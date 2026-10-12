# Responsive Android layouts and required sign-in

Date: 2026-10-04. Branch: `feature/buyer-responsive-signin`, created from
`docs/buyer-readme-setup-guide`. Adopted Laravel contract baseline remains
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; the running localhost revision is
unidentified. No dependencies, backend contracts or server configuration changed.
The pre-existing `pubspec.lock` modification is preserved outside this change.

## Implemented behavior

Every shopping route requires an active Customer verified through `/me` and required
consent. Login, registration, approval information, recovery and Terms/Privacy remain
reachable before verification. Restoration and recoverable failures show checking or
retry screens; the shopping shell stays hidden. Normal sign-in opens Home; validated
read destinations survive login/consent, while composer/checkout mutation destinations
cannot resume automatically. Root login has no shopping cancel path; consent offers
explicit sign-out. Existing secure storage and server authorization remain authoritative.

Recently Viewed uses account history only. App composition no longer contains a guest
store or merge coordinator. Best-effort startup cleanup removes only
`buyer.public_recent_ids_v1`, without reading hints, touching unrelated preferences
or delaying authentication. The unused backend merge/resolver contracts are preserved.

Shared page layouts use available width, 16px phone/24px tablet padding at 600px,
560px form and 1120px shopping bounds. Shell pages own their scaffold/safe area and
keyboard sizing. Natural-height cards use 1–4 columns with a minimum width of
160px times text scale clamped to 1–2. Product detail uses two columns only at
840px available content width and text scale at most 1.5. Stable gallery/content
keys retain state and avoid repeated media requests when crossing that breakpoint.
Forms, discovery filters, dialogs, message/support composers and populated lists
scroll within their available height; crowded controls wrap.

## Executed verification

`test/features/responsive_layout_test.dart` covers 32 mounted authentication, policy,
discovery, account, address, commerce, review, notification, message and support
screens. Each traverses 320×640, 360×800, 390×844, 412×915, 600×960 and 800×1280
plus landscape counterparts, text scales 1/1.5/2 and keyboard insets. Repeated
599/600/839/840/900/400px resizing preserves safe drafts/focus without new requests.
Fixtures include long names/messages, large prices and populated collections. All
32 cases pass without layout exceptions. Existing accessibility and failure/lifecycle
coverage remains part of the full suite; these synthetic checks do not certify TalkBack
or native keyboard behavior.

A short-height/doubled-text regression also verifies invalid Shop filters have one
scrollable scaffold and a reachable 48px action. Required-sign-in tests cover shopping deep links before `/me`/consent, explicit
consent return, recoverable consent retry, sign-out, session phases, rejected composer
returns and absence of guest writes/merges. Existing restoration, revocation,
account-switching and storage-error tests remain in the full suite.

The isolated Chromium smoke at `http://localhost:8766` checks signed-out shopping
guards without catalog requests, reload/Back, phone/tablet portrait/landscape sign-in,
authentication/policy navigation, real public policies/CORS and invalid-bearer denial.
`python3 tool/browser_smoke.py --synthetic-shopping` additionally intercepts every
API request before introducing a synthetic identity; shopping, account, Q&A/reviews,
message/support and logout checks never send authenticated traffic to Laravel.

The final runner command is:

```sh
python3 tool/verify_release.py --report-name responsive-signin --live
```

It runs locked dependency resolution, formatter, analyzer, full tests, ten Chromium
Fetch/WebCrypto tests, ten Python tooling tests, documentation/PSGC/security checks,
web and release APK builds, and the 42 public/denial/preflight API checks. The ignored
report is `build/verification/responsive-signin.json`; exact build defines are recorded
there. All ten requested checks passed (exit 0), including the full suite and 42
public API checks. The synthetic browser command passed independently. ADB discovery
succeeded with zero attached authorized devices. Web/APK compilation uses public HTTPS placeholders with maps disabled and
existing debug signing, rather than distribution configuration.

## Remaining acceptance gates

Controlled real-account login/approval/consent/restoration/revocation/switching and
live authenticated shopping remain open. Installed Android phone/tablet, split-screen,
keyboard, TalkBack/focus/contrast, native picker/permissions and real device Back need
acceptance using the [Phase 5 runbook](phase-5-verification.md). No attached device or
real account was used for this change. Production origins/application ID/signing,
deployed backend revision, G04 Retry-After exposure and prior integration-owner gates
remain open. Browser resizing tests Android-sized viewports; desktop product layouts
are outside scope. Broad Customer acceptance criteria stay unchecked.
