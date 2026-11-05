# Campaigns UI/UX verification — 2026-11-05

## Design and implementation

Used the installed `design-taste-frontend` skill at `/home/cred/.agents/skills/design-taste-frontend/SKILL.md`, following its app-screen run. The draw selected **Accent ladder**, seed **20261105**, with palette and type retained. No redraws. `docs/design.md` takes precedence: retained Admin purple, Geist, slate dark surfaces, shared navigation/utility bar, 12px panels and 44px controls. The drawn shell, unrelated sell-out signature, example analytics charts and unsupported search/tabs are inapplicable to this existing campaign workflow.

Screen question: **Which campaigns need review, and what happened after sending?** Idea: AISLEY's saved campaign revision and opted-in Customer inbox message become the composer’s live preview and explicit send review. The live element is a plain-text preview of the actual form state; it does not claim to calculate eligibility. Campaigns, statuses, revisions, created/confirmed/completed times, fixed audience, optional Product/Shop destination, persisted/frozen/skipped/failed counts and permission boundaries supply the screen's substance. No invented summary metrics or trends.

The new route is `/notification-campaigns/new`. Existing list/detail and draft/preview/send APIs retain their payloads and semantics; list requests additionally accept an optional client AbortSignal. The UI keeps campaign-specific composition and state in Admin, and reuses shared portal primitives. History pagination is in the URL. Unsaved input is memory-only. Revision conflicts retain local text; new edits invalidate previews; uncertain sends reconcile server status and preserve the same send key/revision. Delivery outcomes lead the reading order on desktop and phones.

## Checks and evidence

- Admin TypeScript build, production Vite build, scoped Oxlint and `git diff --check` passed. Vite retains its bundle-size advisory; this task adds no dependencies or app-wide code splitting.
- `php artisan test --filter=NotificationCampaignTest`: **4 tests, 67 assertions passed**. These existing API tests do not establish PostgreSQL concurrency or deployed queue acceptance.
- `src/admin/tests/campaigns-browser.mjs` runs the actual Admin routes and shell with synthetic aggregate APIs. It covers five workflow screens × two themes × three widths (1440/768/390), history refresh/error recovery, URL pagination/back/out-of-order responses, create/save validation, safe text rendering, destination reset, unsaved navigation, edit-preview invalidation, zero/oversized audience, preview failure/retry, confirmation focus/Tab/Escape, uncertain-send locks/status retries/stable keys, committed-timeout reconciliation, polling completion, stale revisions, view-only/access loss, account disposal, late create results, empty history, long unbroken content, 200% text sizing and reduced motion. **91 checks passed**; the assertion summary is retained in the local `browser-result.json`. No runtime exceptions.
- Taste source lint: **0 FAIL, 0 WARN**. Final rendered-DOM inspections cover history, composer and delivery in both themes at 1440/768/390: **0 FAIL**. History has no warnings. Composer and delivery each retain one desktop `ragged-row` warning per theme: independent editing/preview or results/message columns retain natural height because message length varies; stretching the short column would manufacture empty panel space. They stack below 1101px.
- The meter reads frozen rendered DOM, including the real Vite CSS/fonts, from the authenticated synthetic browser run. It measures presentation; the browser suite verifies behavior. Purple allowance follows the canonical design contract. It does not hide contrast or overflow failures.
- Before captures show the new-draft form dominating the first desktop/phone screen, with history below. After captures show history immediately, a separate composer, explicit review and delivery outcomes first. Reviewed final browser captures and all inspector folds/page sheets across widths and themes.

Local evidence lives under `node_modules/.cache/campaigns/`: `before-*.png`, workflow `*.png`/`*.html`, `inspect-*/report.json`, contact sheets and `browser-result.json`. These ignored artifacts are reproducible, not committed production assets. No photographs, clips, generated images or replacement artwork were used; no credits or production sample content need to be added. Example campaign content exists only in the synthetic test fixture.

## Visual critique

```text
ROUND 1
Seen in one second: a large empty draft form, then campaign history.
Idea (one sentence): saved campaign revisions become previews and send reviews.
Live thing: composer preview and server audience calculation.
Layout words by section: history=list / composer=form+preview / delivery=message+results.
Scores: design 7.0 · usability 7.2 · creativity 6.0 · content 7.5 → overall 6.9
Caps applied: app-screen rules; no promotional imagery/motion caps.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. before-light-1440.png: history begins near the bottom; move creation to its own route.
2. initial history meter: most metadata was 12px; increase history labels/status/date/audience to 13px.
3. initial delivery phone capture: results follow the saved message; put delivery results first.

ROUND 2
Seen in one second: campaign history and New campaign; on delivery, the actual outcomes.
Idea (one sentence): AISLEY's saved revision and Customer inbox message become the preview and send review.
Live thing: the same plain-text form data powers the preview; eligibility stays server-owned.
Layout words by section: history=aligned-list / composer=form+preview / delivery=results+message.
Scores: design 7.8 · usability 8.2 · creativity 6.5 · content 8.0 → overall 7.7
Caps applied: app-screen rules; retained canonical Admin design and shared shell.
Top three remaining limitations (most visible first), each with the screenshot and disposition:
1. inspect-composer-light/desktop-fold.jpg: preview column is shorter than the form; retain natural height rather than pad an empty panel (documented meter warning).
2. inspect-delivery-light/desktop-fold.jpg: a short saved message is shorter than the results panel; outcomes deliberately lead, with independently sized content (documented meter warning).
3. composer-light-390.png: the full form and preview require scrolling; retain readable controls and complete content rather than reduce touch targets or text size.
```

Scores are an internal visual assessment, not an independent jury rating. Live Laravel/session integration, PostgreSQL, production-volume queue behavior and deployed acceptance remain open. No Customer or external Flutter implementation status is changed.

## Reproduction

From the repository root, start the existing Admin development server in one terminal:

```sh
node src/admin/node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --config src/admin/vite.config.ts src/admin
```

Then run:

```sh
CHROMIUM_BINARY=/usr/bin/chromium node src/admin/tests/campaigns-browser.mjs
node src/admin/node_modules/typescript/bin/tsc -b src/admin
node src/admin/node_modules/oxlint/bin/oxlint src/admin/src/components/campaigns src/admin/src/pages/NotificationCampaignsPage.tsx src/admin/src/pages/NotificationCampaignDetailPage.tsx
```

`CAMPAIGNS_ORIGIN` overrides the running Admin origin. Run the installed skill's `inspect.mjs --app` against the generated HTML snapshots, keeping the Admin purple palette allowance. Inspect at the generated snapshot's intended theme; responsive CSS remains live at all widths. Browser/server execution requires local process/socket permissions in restricted environments.
