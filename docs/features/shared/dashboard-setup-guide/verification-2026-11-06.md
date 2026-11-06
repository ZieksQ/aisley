# Dashboard setup guides verification — 2026-11-06

## Delivered behavior

Seller and Logistics dashboards share the `@aisley/ui/portal` setup-guide presentation, while each app owns its task copy, destinations, client, and authorization handling. Each guide has six items, an honest completion count/percentage, direct workspace links, reversible navigation lessons, browser-local preferences, and independent read/retry states. Automatic predicates are current Shop/organization-scoped existence checks, not claims of operational readiness. No migration or business mutation was introduced.

The matching Seller and Logistics dashboard specifications are canonical. New endpoints are private read-only web-portal endpoints; external Flutter contracts are unchanged.

## Rollout

Set `DASHBOARD_GUIDE_LAUNCH_AT` once to the actual rollout instant in ISO 8601 UTC, for example `2026-11-06T12:00:00Z`. Retain that value on subsequent deployments and refresh Laravel's configuration cache through the normal deployment procedure. Accounts created at/after that instant auto-open the guide on their first visit in a browser. Existing accounts receive an optional Show setup guide control. Unset, malformed, non-UTC, or impossible calendar dates make every account opt-in. Never use a dynamically advancing cutoff.

Only lesson IDs, visibility, and completion preference enter local storage under `aisley:setup-guide:<role>:<account>:<tenant>:v1`. Automatic task results are not persisted. Clearing browser storage resets manual progress; progress does not follow the account across devices. Hidden/finished guides remain reopenable. Blocked storage retains state only for the current mounted visit.

## Automated verification

- Both portal TypeScript checks and Vite production builds pass using their installed local tools. The existing large-chunk advisories remain.
- Scoped Oxlint and Taste source lint pass. Scoped PHP Pint passes for the added controller/service/config/test files; unrelated existing route formatting is preserved.
- Isolated SQLite PHPUnit: setup-guide suite passes 5 tests / 103 assertions; existing Seller dashboard suite passes 8 tests / 123 assertions. Coverage includes guest/wrong-role/inactive/consent rejection, tenant isolation, read-only behavior, missing Shop, fixed cutoff boundaries, invalid date configuration, draft/archive product states, provider active/enabled eligibility, published/future/draft/archived rates, and a failed automatic source.
- Controlled Chromium runs actual production bundles with intercepted synthetic API responses. The browser suite checks 72 task/theme/viewport combinations (2 roles × 2 themes × 3 widths × 6 tasks), progress arithmetic, selection without completion, manual reversal, reload persistence, hide/reopen focus, completed-guide collapse, existing-account opt-in, account isolation, corrupt/blocked storage, automatic refetch, stale and initial read failure/retry, and reduced-motion keyboard interaction. All guide targets are checked against their owning application's route declarations. No business mutation requests are made.
- Reproduce from the repository root: `node packages/ui/tests/setup-guide-browser.mjs`. Add `GUIDE_INSPECT=1` to run all four Taste inspections while its local asset servers are alive. Artifacts are under ignored `node_modules/.cache/setup-guide/`.

## Design review

This is an addition to existing app screens, so the skill's component rule applies: match the surrounding design without a new style draw or random seed. Geist and purple Seller / blue-slate Logistics tokens come from `docs/design.md`. The signature interaction pairs a role-owned task list with contextual navigation guidance; on phones the selected guidance expands directly under its task. Images, promotional motion, and invented sample business statistics are unnecessary.

Initial review replaced absolute-positioned detail content with a grid so longer guidance cannot overlap the footer, used the existing icon set rather than a decorative checkmark glyph, and verified the independent Logistics theme key before accepting dark screenshots. Browser assertions verify details do not overlap the footer at any tested width. Reload checks wait for a new document before checking persistence.

Final Taste inspections pass with 0 FAIL and 3 defended WARN categories for each role/theme at 1440/768/390px. All final fold screenshots and full-page contact sheets were opened and reviewed.

Full-page Taste inspection includes the unchanged surrounding dashboards. Explicit allowances:

- `icon-chips`: existing KPI icons are prescribed by `docs/design.md`; guide status icons are plain.
- `tiny-text` for Logistics only: the existing sidebar's four 9px Beta labels are outside this feature. New guide text is 12px or larger. This allowance records the existing issue rather than certifying the sidebar typography.

Remaining warnings are defended by scope/data: `below-fold` reflects the open guide preceding operational summaries, with Hide always available; `panel-void` identifies existing empty chart/order frames; `no-data-hue` comes from zero-valued synthetic charts. No charts, data, or surrounding dashboard layout were changed to silence these warnings.

### Final critique (guide component)

ROUND 2

Seen in one second: a six-item setup checklist with its current completion count and a direct place to start.

Idea (one sentence): each role's existing sidebar workflows become a practical learning checklist beside the dashboard's real business data.

Live thing: selecting a task exposes its directions and real destinations; manual understanding and saved setup checks update one progress value.

Layout words by section: context=existing dashboard heading / guide=task list plus contextual detail / phone=inline disclosure / operations=existing dashboard summaries.

Scores (self-assessment): design 8 · usability 8 · creativity 7 · content 8 → overall 7.8.

Caps applied: app-screen rules; promotional imagery, motion, and page-specific caps do not apply.

Remaining three limitations, most visible first:

1. The expanded guide moves operational metrics below the desktop fold (`seller-light-1440.png`, `logistics-light-1440.png`); preserve its task-first placement for new users and the persistent Hide control.
2. The phone guide requires scrolling through six items (`seller-light-390.png`, `logistics-dark-390.png`); use one inline selected detail and maintain full labels rather than compressing type.
3. Surrounding empty dashboard charts remain spacious (`inspect-*/desktop-page-01.jpg`); leave their existing composition and authoritative zero semantics intact in this feature.

Browser identity, zero-valued operational data, and timestamps are test fixtures only. Production uses authenticated API responses. Live PostgreSQL/deployed accounts and operational browser storage policies remain deployment acceptance checks; these tests do not claim they were exercised.
