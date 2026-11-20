# Rate-rule modal layout verification — 2026-11-12

The Add/Edit rate-rule dialog now has a fixed header and action footer around independently scrolling fields. Main Shop Category and Service leg align; label/help rows use consistent heights. Cancel and Save use shared portal button styling with 44px minimum height and blue hover/pressed states. The shorter dialog title avoids unnecessary wrapping on phones, and native selects/scrollbars follow the current theme. Field definitions, validation, conversions, API requests and authorization are unchanged.

## Static and browser checks

- Logistics TypeScript and production Vite build passed using the installed package binaries. The existing large-chunk warning remains. The pnpm launcher could not open its external engine-store lock in the sandbox; no packages or lockfiles changed.
- Scoped Oxlint, Taste source lint and whitespace checks passed. Source allowances explain the real floating-tooltip shadow and portal dialog separators required by the existing design contract.
- The rates/fleet synthetic Chromium suite covers 60 existing route/theme/viewport combinations plus 12 focused modal states: 320×700, 390×844, 768×1024, 1440×900, 390×500 and 720×450 at 2× device scale, each light/dark. The last emulates the CSS space of a 1440×900 desktop at 200% zoom; physical browser-chrome zoom remains manual acceptance.
- Modal assertions check viewport containment, no horizontal overflow, aligned first-row inputs, minimum action targets, stationary footer during field scrolling, keyboard help at the first/last fields, blue hover/pressed colors, add/edit saves, required positive-weight and duplicate validation draft preservation, focus return, keyboard cycling and Close/Cancel/Escape. Rule saves remain local to the rate-card draft and perform no API writes.
- The original rates/fleet checks cover failed refresh draft preservation, date/calendar, navigation, fleet/vehicle workflows and failure recovery. All API responses are synthetic; no real account or rate card was modified.

## Taste review

Used `/home/cred/.agents/skills/design-taste-frontend/SKILL.md` and its app-screen/component guidance. No direction draw or seed: this is one existing component with a declared blue/slate palette, Geist type and established portal controls. No imagery, sample copy, dependencies or animation system was added.

Before/after inspector runs used the actual built application through a local fixture proxy that opens the rate composer and modal. Final light/dark `inspect.mjs --app` checks at 1440/768/390px report **0 FAIL, 0 WARN** with two explicit allowances: `tiny-text` for existing 9px sidebar Beta labels, and `covered-text` for the underlying page heading intentionally covered by the modal. Neither allowance excuses dialog content. Reviewed every final fold and page-sheet capture, and the before captures.

| Observed behavior | Before | After |
| --- | --- | --- |
| Category/service controls | First-row top edges differ by 24px | Top edges align |
| Cancel/Save | Invalid height utilities; visually about 22px tall | Shared controls, at least 44px tall |
| Phone actions | Below the long form | Remain visible while fields scroll |
| Primary hover | Hard-coded purple | Logistics blue hover/active tokens |
| Phone title | Two or three lines | Concise Add/Edit rate rule |
| Dark native controls | Light scrollbar | Dark native color scheme |

### ROUND 1 — before

Seen in one second: Rate-rule inputs with uneven first-row alignment and small actions.
Idea (one sentence): Make category/service weight and size settings readable as a practical Logistics form.
Live thing: Configure a local rule before creating the rate-card draft.
Layout words by section: header=title/help / fields=two-column or stacked / actions=trailing buttons.
Scores: design 6.5 · usability 6 · creativity 7 · content 8 → overall 6.6.
Caps applied: None from promotional-page rules; reviewed as an operational form.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Before mobile fold: Save/Cancel are below the visible form; keep them outside the scrolling field area.
2. Before desktop/tablet folds: Category/service inputs start at different heights; give both labels equal-height rows.
3. Before desktop fold: Cancel/Save are undersized; reuse portal action styles and Logistics tokens.

### ROUND 2 — final

Seen in one second: Clear Add rate rule title, aligned form and persistent Save/Cancel.
Idea (one sentence): A stable dialog frame keeps the current rate-rule task and actions in view.
Live thing: Add/edit the rule, inspect help and recover from invalid or duplicate values.
Layout words by section: header=fixed title/help / fields=scrolling grid / actions=fixed footer.
Scores: design 8 · usability 8.5 · creativity 7 · content 8 → overall 8.0.
Caps applied: None; no modal overflow or missing controls in the reviewed captures.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Final mobile folds: Nine required fields still require scrolling; retain field content and the visible action footer.
2. Final desktop fold: The final dimension occupies one column; retain the established field order rather than invent another input.
3. Final page sheets: Existing tiny Beta labels remain in the dimmed sidebar; leave this unrelated shell issue outside the modal fix.

Scores are a subjective visual review, not an independent usability study. Raw screenshots/reports are ignored local artifacts under `src/logistics/node_modules/.cache/rate-rule-review/{before,after-light,after-dark}` and `src/logistics/node_modules/.cache/rates-fleet-browser/`.

## Remaining acceptance

Deployed/authenticated usage, physical mobile keyboards, assistive technology and browser-chrome zoom were not tested. No API or external Flutter contract changed. This verification establishes the synthetic web layout and interactions only.
