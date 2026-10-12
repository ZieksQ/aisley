# List recovery and pagination — 2026-10-10

Implemented on `fix/buyer-list-recovery`. General API baseline remains
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; Order shipping projections retain
`22b0a48f9575ead182d03c35ab87345711c23b90`. Deployed revision is unidentified.

## Behavior

- Home recommendations, Product/Shop Search, directory/Shop browsing, Wishlist,
  Recently Viewed, Orders and Shop/Logistics/Courier/notification/support inboxes
  retain permitted snapshots while refreshing. Recoverable failures label stale
  rows and never present a failed exchange as an empty successful list.
- Numbered discovery navigation retains the previous successful page until the
  requested page succeeds. The displayed page label belongs to its actual rows;
  separate feedback identifies the requested page. URLs retain the requested
  page, and Retry fetches it explicitly. Query/mode/category/limit/Shop/account
  changes discard incompatible state. Detail Back restores the list.
- Page Retry preserves the failed page/cursor and existing rows. Refresh
  supersedes outstanding append requests; stale refreshes block further append.
  Current server numbered-page metadata remains authoritative. Cursor traversal
  stops on cycles/no progress; Home retains its existing 200-item cap.
- Initial pages and appends deduplicate resource IDs in returned order; later
  accepted overlaps update existing records. Refresh replaces rows and metadata
  together. Explicit discovery Retry/refresh bypasses the short-lived public
  cache; obsolete public reads cannot overwrite newer cached results. Scoped
  denial invalidates affected cached reads and displayed projections.
- Session/request guards reject late successes, errors and completion handlers.
  Account switching and required consent clear list state. Successful inbox page
  retry after offline failure resumes eligibility for foreground polling.
  Automatic inbox polling/focus/resume reads respect active list/page actions;
  deferred focus refresh cannot cancel the action that acquired focus. Explicit
  Refresh retains its ability to supersede pagination.
- Shared list feedback/actions preserve the current light Material theme,
  accessibility announcements and 48px targets. No dependencies, wire contracts,
  backend behavior, persistence or thread-history/mutation flows changed.

## Verification

- New controller tests cover every private collection: initial/refresh failure,
  formerly empty refresh, atomic successful replacement, exact page Retry,
  refresh versus delayed append success/error, resource denial, offline/timeout,
  readable Retry-After, consent races, deduplication and A→B→A switching.
- Discovery tests cover both search modes, directory and Shop pages: retained
  numbered pages, explicit cache bypass, malformed replacement, duplicate rows,
  denial and late public responses after sign-out. Home refresh/page races and
  obsolete public cache writes have separate regressions.
- Widget tests exercise retained-row feedback, failed-refresh empty suppression,
  disabled stale pagination, narrow doubled text, 48px controls and actual router
  page retention/Retry/detail Back for all three numbered discovery screens.
  An inbox focus regression verifies that a deliberate page request and its error
  survive automatic focus refresh without an extra first-page read.
- `flutter test --no-pub --reporter expanded`: 494 passed, 42 opt-in live checks
  skipped. The final focus guard is included in this run.
- `python3 tool/verify_release.py --checks format analyze chrome bundle web-build apk-build --report-name list-recovery-final`:
  all six selected checks passed after the final focus guard. Local report:
  `build/verification/list-recovery-final.json`. SDK remains Flutter 3.47.2 /
  Dart 3.13.2; dependencies and lockfile are unchanged.
  Release builds use public HTTPS placeholder origins; production signing is not
  certified. Chrome transport checks use synthetic responses.
- `python3 tool/browser_smoke.py --synthetic-list-recovery`: passed against the
  final release web build at localhost:8766, at 390×844 and 1440×900. Failed Search
  page navigation preserves page-one rows and the page-two URL; Retry displays
  page two. All eight private collections pass failed append/exact target Retry,
  failed refresh/stale rows and successful explicit refresh. The harness waits
  for each target request and completion; no overflow appeared at either width.
- `python3 -m unittest discover -s tool -p '*_test.py'`: 10 passed, one existing
  failure in `test_verbatim_progress_archive_checks_original_links_and_missing_targets`.
  The unchanged negative-link fixture is already documented in the shipping
  Progress entry; an existing archive forwarder makes its target valid. Actual
  bundle validation passes. Browser-tool Python syntax checks pass.

## Repeatable browser check and remaining gates

Serve `build/web` at `http://localhost:8766`, then run
`python3 tool/browser_smoke.py --synthetic-list-recovery`. The harness intercepts
all API traffic before introducing a synthetic identity. It exercises failed
numbered-page retention, exact target Retry, and page/refresh recovery for all
eight private collections at phone and desktop widths. It sends no real
credentials or commerce/communication writes to Laravel.

Live-account pagination/ownership, exact-origin CORS/Retry-After, installed
Android/TalkBack and production release signing remain external acceptance gates.
Builds and synthetic checks do not close them. G25/G26 and historical verification
records remain unchanged. No actual backend contract conflict was discovered.
