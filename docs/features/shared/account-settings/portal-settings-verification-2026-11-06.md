# Portal Settings verification — 2026-11-06

## Change and design

Admin and Seller now follow the existing Logistics Settings workspace: Back to workspace, Account, Terms and conditions, Billing and Appearance, with permission-aware Notifications and persistent Sign out. Customer remains unchanged. Shared Settings navigation and Appearance presentation live in `@aisley/ui/portal`; role screens and clients retain ownership. Admin/Seller Billing links to existing Finance payment settings rather than introducing financial behavior.

Applied the design-taste-frontend app-screen guidance under `docs/design.md`. The existing Logistics pattern fixes the direction; no randomized draw, new font, dependency, imagery or promotional motion was introduced. Purple remains the Admin/Seller accent; Logistics retains blue/slate. The live interaction is the immediately applied System/Light/Dark dropdown, backed by role-specific browser preferences.

Before captures at 390/768/1440px show the old account sidebar and top-bar theme controls. Their account body is an error state because the initial synthetic fixture did not supply an account response; these captures establish shell/navigation changes only, not a before/after form-quality comparison. Final fixtures supply account data and exercise real role components and routes.

## Checks

- Customer TypeScript also passed, checking compatibility of the shared Account heading change.
- Admin, Seller and Logistics TypeScript checks and Vite production builds passed. Existing bundle-size warnings remain.
- Admin/Seller lint and scoped shared-source/test lint passed. Logistics lint retains an unrelated pre-existing unused helper warning in `tests/fleet-monitoring-browser.smoke.mjs`.
- `node packages/ui/tests/portal-settings-browser.mjs` passed 48 Admin/Seller role/theme/viewport/section combinations. It covers legacy query/hash redirects, Settings default routing, account section selection/drafts, required-consent reading and acceptance return navigation, Billing destinations, Admin permission loss/setup gating, device theme changes, explicit overrides/reload, storage-event synchronization, failed persistence, and mobile Escape/focus restoration. No runtime exceptions or console errors.
- `node packages/ui/tests/account-settings-browser.mjs` passed the existing 88 account combinations, including Customer, role forms, draft/secret lifetime, account switches, image controls and recovery states.
- Taste source lint passed with zero failures/warnings for the three new shared modules. App-screen section separators explicitly follow the Logistics reference and design contract.
- Taste inspection of Admin/Seller Appearance in light/dark at 1440/768/390px passed with zero failures. Each inspection retains one desktop `hero-void` warning: the single theme preference deliberately occupies a compact form, leaving the rest of the persistent workspace available. Filling it with unrelated content would alter the requested workflow. Purple palette allowance follows the design contract.
- Opened final inspector screenshots and contact sheets covering all 48 Settings captures. Fixed a dark Theme-label contrast failure found during inspection.
- `git diff --check` passed.

The original Logistics Settings/Support suite stops on an existing synthetic chat-notification response lacking `meta.unread_count`. The application contract was preserved; the original harness was not edited. A local Settings-focused copy corrects that response, matches policy document IDs to current-version IDs, and updates the old policy-screen readiness selector. It passed all 24 Logistics Settings route/theme/viewport combinations plus keyboard focus, legacy redirects, required-consent access, device theme changes, explicit persistence, default System, storage-event synchronization and sidebar links. The original harness was not edited.

These checks use synthetic APIs. They do not certify deployed sessions, live Laravel/PostgreSQL, real payments, private storage or external Flutter clients. No API/schema changes or mobile contract updates are required.

## Visual critique

ROUND 1
Seen in one second: Settings owns account, policies, Billing and Appearance.
Idea (one sentence): The familiar Logistics Settings workspace becomes the shared navigation pattern across the three portals.
Live thing: Theme preference applies immediately and follows device changes when System is selected.
Layout words by section: navigation=dedicated sidebar / account=existing identity and forms / terms=reading and confirmation / billing=Finance entry / appearance=labeled form row.
Scores: design 7.5 · usability 8.0 · creativity 7.0 · content 8.5 → overall 7.8.
Caps applied: App-screen rules; promotional imagery, hero and motion requirements are inapplicable.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Dark Appearance label lost contrast in `inspect-admin-dark`: give the form label an explicit light foreground.
2. A persistence-success message would be misleading if storage fails: confirm that the theme was applied, without claiming it was saved.
3. Desktop Appearance leaves a large unused region: retain the reference's compact task form rather than add unrelated settings.

ROUND 2
Seen in one second: The selected Settings destination and the next action are clear.
Idea (one sentence): One consistent navigation pattern connects role-specific account workflows.
Live thing: Accessible theme dropdown with persistent role preferences and session fallback.
Layout words by section: navigation=stable rail/drawer / account=sectioned forms / terms=reading panel / billing=entry link / appearance=responsive label/control pair.
Scores: design 8.0 · usability 8.5 · creativity 7.0 · content 8.5 → overall 8.1.
Caps applied: App-screen rules and project design contract; no promotional caps.
Top three problems: No blocking defects found in the reviewed task screens. Appearance's desktop empty-space warning is accepted for a single-control task; long Account/Terms screens retain normal vertical scrolling. Existing policy headings, disabled states and account identity styling are preserved.

## Reproduction

From the repository root, start the actual portals with installed dependencies:

```sh
pnpm --filter admin exec vite --host 127.0.0.1 --port 15351 --strictPort
pnpm --filter seller exec vite --host 127.0.0.1 --port 15352 --strictPort
node packages/ui/tests/portal-settings-browser.mjs
node packages/ui/tests/account-settings-browser.mjs
```

`ADMIN_SETTINGS_PORT` and `SELLER_SETTINGS_PORT` override the first suite's ports; `CHROME_PATH` selects installed Chromium. Screenshots, captured HTML and Taste reports are local ignored artifacts under `node_modules/.cache/portal-settings/`. Fixture names/content exist only in tests and require no production replacement or attribution.
