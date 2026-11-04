# Automatic registration verification — 2026-11-04

## Delivered behavior

Customer, Seller and Logistics web and the external Buyer/Courier Flutter clients collect existing details before a dedicated email OTP screen. Verifying dispatches one initial registration request automatically. A confirmed successful registration shows account-ready or approval guidance; OTP verification alone never claims registration success. Admin has no public registration. Seller/Logistics/pending Customer approval remains Admin-owned; Courier approval remains Logistics-owned.

Web uses `/register`, `/register/verify-email` and `/register/success`, with a persistent Next layout or React Router registration owner. Drafts/evidence stay in memory through Back and tab events; refresh/direct entry without required state returns to details. Flutter retains its existing Navigator/wizard ownership. Native password clearing after server attempts/cancellation is preserved. Success clears secret form state. The existing OTP switch remains supported, including failed-settings retry and server re-enforcement. Buyer accepts both pending and active registration results. No endpoint, dependency, migration, credential issuance or approval authorization changed.

## Verification

Commands run from the owning repository; web binaries below were invoked from the monorepo root because pnpm's global engine-store lock was read-only in the sandbox.

- Customer `next build src/webapp --webpack`, three-app TypeScript, scoped storefront ESLint and shared/portal Oxlint.
- Seller and Logistics `vite build src/<role>`; existing large-bundle warnings remain.
- `CHROMIUM_BINARY=/usr/bin/chromium node packages/ui/tests/registration-email-browser.mjs`: actual shared hook/gate, role handlers and OTP clients, with synthetic transport/presentation/navigation fixtures. Covers details-first flow, invalid/leading-zero codes, automatic dispatch, active/pending success, configuration failure/bypass/re-enforcement, retained passwords/files, explicit corrected retry, pending expiry, browser Back, uncertain failures, stale success, CSRF disposal and direct entry. `--before` captured committed source before implementation was committed.
- `CHROMIUM_BINARY=/usr/bin/chromium node packages/ui/tests/registration-routes-browser.mjs`: actual production layouts/routes with synthetic API responses. Checks Back, retained drafts/files, two synchronous Verify submissions producing one registration request, confirmed approval success, reload recovery and 40 viewport/theme captures at 320/390/768/1440px across supported themes.
- Registration-email Laravel regression: 16 tests, 182 assertions, isolated SQLite/array mail. Backend source was unchanged.
- Buyer Flutter: 18 focused registration/controller/widget checks, including active/pending success, bypass, failed settings, late enforcement, backgrounding, explicit recovery and unconfirmed outcomes.
- Courier Flutter: all 197 authentication tests passed, including registration/address/evidence, duplicate/offline/timeout/throttle recovery, cancellation and accessibility. The final configuration guard additionally passed all 11 registration-email checks.
- Both full Flutter analyzers passed. Both Flutter web builds and both final Android release APK builds passed (Buyer 96.7 MB; Courier 109.7 MB). Existing Android SDK XML-version warnings remain; installed-device and signing/release acceptance are separate.
- Dart formatting, Git whitespace, portable JSON parsing and revised mobile/Courier spec-length checks.

These are local builds, source checks and controlled browser/widget/API tests. No real inbox delivery, deployed API/storage, production credentials, installed-device, TalkBack/VoiceOver or signing/release acceptance is claimed.

## Design review

Applied Uncodixfy and Design Taste to task screens under `docs/design.md`; Flutter follows its own Buyer/Courier guides. The draw selected **Framed sheet**, seed **587207386**, retaining brand palette/type. The existing auth shells remain their owners: no new sidebar, marketing section, photograph, dependency or scroll animation was appropriate. Compatible choices are flat form surfaces, practical spacing, one task title, one primary action and restrained feedback.

Idea: AISLEY's verified email and server-confirmed approval outcome become the two distinct registration tasks. The live interaction is entering the actual OTP, then observing registration persistence and its role-specific outcome. No invented proof or sample business statistics were introduced; screenshots use synthetic `.invalid` identities and synthetic evidence.

Design Taste app lint: **0 failures**, two warnings for Logistics `#2563EB`, explicitly required by the web design contract. Final component inspection at 1440/768/390: **0 failures** for OTP and success. Each retains one `hero-void` warning: these are bounded task/confirmation screens, so unused viewport space remains rather than adding unrelated content. Geist loads from the existing local asset. Actual auth shells retain pre-existing visual devices outside this registration change; the component inspector does not certify a complete auth-shell redesign.

Before/current captures and hydrated DOM are under ignored `node_modules/.cache/registration-email-browser`; actual-route captures are under `node_modules/.cache/registration-routes`; draw/inspector data are under `node_modules/.cache/registration-taste`. Screenshots were reviewed across all captured widths/themes, including inspector fold/page images.

ROUND 1
Seen in one second: registration verification, with duplicated shell/task headings.
Idea (one sentence): email confirmation leads directly to the server-confirmed account outcome.
Live thing: OTP verification and automatic account creation.
Layout words by section: navigation=existing auth shell / task=OTP form / outcome=approval or sign-in.
Scores: design 7 · usability 8 · creativity 6 · content 8 → overall 7.2 (self-review).
Caps applied: task-screen conventions; promotional imagery/motion are inapplicable.
Top three problems, each with the screenshot and fix:
1. Customer OTP repeated “Create your account” over “Verify your email”; make the role heading reflect the current step.
2. Seller/Logistics OTP repeated inbox/spam guidance; keep it once beside the destination email.
3. Success repeated the sign-in footer after the main sign-in action; show the account-switch footer only while editing details.

ROUND 2
Seen in one second: one task heading and one next action.
Idea (one sentence): verified email advances once to a confirmed, role-appropriate registration result.
Live thing: the OTP form dispatches exactly one registration request and shows the committed outcome.
Layout words by section: navigation=retained brand shell / task=single OTP form / outcome=short confirmation with next action.
Scores: design 8 · usability 9 · creativity 6 · content 9 → overall 8.0 (self-review).
Caps applied: inherited shell styling is preserved; no promotional layout or image floor applies.
Top three remaining limits:
1. Existing Customer desktop auth artwork is outside this focused change; it remains visible in actual-route captures.
2. Existing Logistics auth-shell brand badge remains inherited; the new verification and confirmation actions use the required blue.
3. Installed-device and screen-reader acceptance remain separate from the reviewed browser/widget evidence.
