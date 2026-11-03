# Combined consent verification — 2026-11-03

Contract: `policy-consent-batch-v1`, shared policy specification v1.5. Implementation covers Customer/Seller/Admin/Logistics web consent, Laravel, Courier Flutter (`../aisley_app`) and Buyer Flutter (`../aisley_mobile_buyer`). Deploy the additive API before updated clients. No migration, legal-text change or enforcement-toggle change is required; the original single-policy API remains supported.

## Behavior and checks

- Both complete documents share one reading panel, with two version-bound checkboxes and one Accept button. Covered policies stay satisfied; only pending policies are submitted. Existing public/history routes, authentication and actor eligibility stay authoritative.
- SQLite policy API suites passed: **14 tests, 180 assertions**. Coverage includes all five roles, Courier bearer access/affiliation denial, validation, immutable retries, pending-only saves, stale/successor publication, omitted new requirements and rollback after an injected database failure. Row locking matches publication's identity lock; these SQLite checks do not certify parallel Postgres execution.
- All four web TypeScript checks and production builds passed. Scoped storefront ESLint, shared/portal Oxlint and PHP Pint passed. Existing dashboard bundle-size warnings remain. The first sandboxed Next build stalled; the normal production build passed after rerunning with required local worker access.
- `CHROMIUM_BINARY=/usr/bin/chromium node packages/ui/tests/policy-consent-browser.mjs` passed **28 viewport/theme combinations** at 320/390/768/1440px, plus combined/pending-only/covered saves, literal text rendering, publication/reconfirmation, committed/unsaved uncertain responses, throttling, duplicate submission, account-switch cancellation, read recovery and keyboard access. This uses the real shared panel/hook with synthetic transport, rather than authenticated role shells.
- Courier: `flutter test --no-pub test/features/policy` passed **46 tests**, including exact wire payload/bearer checks, rejected mismatched responses, state transitions, eight responsive/theme/text-scale combinations, accessibility guidelines and confirmed sign-out. The focused dashboard policy-gate integration test also passed.
- Buyer: consent state, repository, screen and session suites passed **46 tests**, including twelve 320/390/768px theme/text-scale combinations. Both Flutter projects passed `flutter analyze --no-pub`; only affected Dart files were formatted.
- Readable Flutter captures use the installed SDK Material font via `CONSENT_REVIEW_FONT`; normal test runs do not need that optional variable. Capture output stays in each app's ignored `build/consent-review/`. Web screenshots, fixture and inspector reports stay in `node_modules/.cache/policy-consent-browser/`.
- A broader Courier widget run retains two unrelated registration failures expecting the old “Send verification code” step. Registration implementation and the user's pre-existing Courier pubspec/assets changes are outside this feature.

## Design review

Used design-taste-frontend and uncodixfy for this existing task component. The web design contract and each app's Material guide retain authority over purple/blue/pink branding, typography, borders, themes and spacing. A new randomized page direction, hero, imagery and decorative motion are inapplicable. No dependencies, stock pictures or substitute legal copy were added. Synthetic policy text appears only in tests.

Taste source lint: **0 FAIL, 0 WARN**. Final app inspector: **0 FAIL, 2 WARN** at 1440/768/390px. Both desktop warnings (`hero-void`, `unused-canvas`) arise from the capped legal reading column and a sidebar heuristic in the isolated component fixture; the column is centered with equal margins and deliberately preserves readable line lengths. Do not fill legal screens with unrelated imagery or stretch paragraphs to remove these warnings.

ROUND 2
Seen in one second: two policy documents followed by one confirmation form.
Idea (one sentence): AISLEY's two separately versioned policies become one deliberate consent decision.
Live thing: independently confirm pending versions and save the complete selection atomically.
Layout words by section: title=context / documents=reading column / confirmations=two labelled rows / action=Accept.
Scores: design 7 · usability 8 · creativity 5 · content 8 → overall 7.0.
Caps applied: judged as an existing task component; promotional imagery and motion floors are inapplicable.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Courier `dark-reading.png`: duplicate screen heading; removed the repeated body title.
2. Courier `dark-confirmation.png`: covered-policy copy was dimmed with its disabled checkbox; retained normal readable foregrounds in both Flutter apps.
3. Buyer `light-reading.png`: synthetic document titles obscured policy identity; combined sections now identify Terms/Privacy explicitly while preserving the published title.

Reviewed web mobile/desktop role/theme captures, all inspector viewport captures, and both mobile apps' light/dark reading/confirmation captures. No before/after screenshot certification or pixel-parity claim is made.

## Remaining acceptance

Live/deployed API exchange, installed Android/TalkBack, release APK acceptance and parallel Postgres race testing remain unverified. Synthetic fixtures, builds and analyzer results do not establish those outcomes. Public policy text and version streams remain owned by Admin authoring.
