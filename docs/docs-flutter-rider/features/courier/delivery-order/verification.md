# G29 verification and release boundaries

The Courier failed-attempt client was implemented against Laravel `4d8bfefa2a95007256e6616df415fa186d1b18eb` from Flutter baseline `de1b77f16f7954ac02095c49746bee1bc1699816`. The G29 source and documentation changes are staged for review without commits. API behavior, schema, dependencies and production configuration were not changed.

## Coverage

- Repository/DTO checks cover bearer headers, JSON/body/header names, all four reasons, nullable notes, 201-only acknowledgment, malformed replies, private attempt history, bounded rows, unknown read-only reasons and missing/invalid counts.
- Controller coverage exercises frozen keys/payloads/revisions, lost or malformed replies, duplicate taps and competing actions, validation correction, note length limits, preflight/state/completion/key conflicts, throttling, consent recovery, 401/403/404 cleanup, logout/disposal/read invalidation, failed post-write refresh and cross-restart stale-photo protection.
- Form tests use production themes at 320/390px with 1×/2× text. They cover keyboard/focus, missing reason, Other/note validation, Cancel/discard protection, locked uncertain payloads, Back/reopen/exact retry, pending completion, in-flight logout and attempt history. Frozen reason/note controls remain disabled and note guidance wraps.
- Chromium passed 13 synthetic journeys across 320/390/768/1440px and both themes, including large text at 320px. Scenarios cover normal reporting, lost committed responses with Back/reopen/exact retry, key conflicts, server cooldowns, pending review and stale-photo blocking. No browser request reached the synthetic API origin and no browser network request carried authorization. Screenshots were reviewed.
- Laravel's existing failed-attempt, final-mile and delivery-approval tests passed: 27 tests, 570 assertions, isolated in-memory SQLite. PostgreSQL concurrency was not rerun because server behavior did not change.

Final full-suite, analyzer and release-build results are recorded in the dated progress entry. The final focused failed-attempt controller suite passed all 31 tests. Browser artifacts are generated under the external app's ignored `build/g29-evidence/`, separate from tracked source.

## Reproduce in the external Flutter repository

```sh
flutter analyze --no-pub
flutter test --no-pub test/features/delivery --reporter expanded
flutter test --no-pub --reporter expanded
flutter build web --release --no-pub
flutter build apk --release --no-pub
```

The test doubles and browser fixture use synthetic data and in-memory transport; they do not authenticate real Couriers or access secure storage.

For browser verification, build the checked-in fixture, serve it on localhost 8875, and launch isolated Chromium debugging on localhost 9335:

```sh
flutter build web --release --no-pub --target test/manual/failed_attempt_browser_fixture.dart --output build/g29-browser
python3 -m http.server 8875 --bind 127.0.0.1 --directory build/g29-browser
```

In separate terminals start an isolated Chromium profile (never a signed-in user browser), then run `node test/manual/check_failed_attempt_browser.mjs`. The script accepts `G29_CDP_ORIGIN`, `G29_FIXTURE_ORIGIN` and `G29_ARTIFACTS` overrides. Stop only the fixture server and isolated browser you created afterward.

## Remaining release gates

No live API/account visit, application database migration, provider operation, deployment or installed Android/TalkBack acceptance ran. Verify deployed revision and the actual private attempt/freshness fields before releasing the client. Verify approved-Courier/task isolation, consent recovery, exact-key replay, final-mile custody and subsequent fresh-photo/Logistics completion in an authorized environment; local synthetic checks do not establish those deployed gates.

Uncertain keys are kept only in authenticated app memory. Restart loses the key, so refresh and inspect server history before reporting the same visit again. Cross-restart retry persistence is outside G29's agreed scope.

See the [failed-attempt contract](failed-attempts.md).
