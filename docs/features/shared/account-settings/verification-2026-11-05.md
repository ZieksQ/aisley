# Account settings refresh — 2026-11-05

## Result and ownership

Customer, Seller, Admin and Logistics now share account settings presentation through `@aisley/ui/account-settings`. Each app owns its routes, API clients, authorization, forms and workflows. No backend endpoint, DTO, database, mobile contract or application dependency changed.

- Customer: Profile, ID image, Preferences, Security.
- Seller: Profile, Storefront, Pickup addresses, Security.
- Admin: Profile, Security, preserving existing email verification through `/setup`.
- Logistics: Profile, Organization & hub, Security, retaining the sole-hub correction boundary.

The `section` query selects one area, preserves other query parameters, supports reload and browser Back/Forward, and defaults missing/unknown values to Profile. Sections first mount when visited, then retain ordinary drafts/uploads. Security screens dispose secrets when left; existing session-owned password cooldown/pending/reconciliation state survives. Identity changes dispose the editor, and late mutation results cannot update the next identity. Logistics writes reset only their own form draft.

The existing production portal shell retains its H1; portal content starts at H2. The Customer account page owns its H1. Shared UI includes identity summary, section navigation, feedback, loading/error panels, local image previews and native removal dialogs. Existing compatible field and dialog primitives are reused. Customer remains light-only; portal themes and Logistics blue stay intact.

## Design direction and review

Applied `design-taste-frontend` app-screen workflow and compatible gpt-taste guidance. The draw offered Framed sheet and Achromatic ledger; selected **Framed sheet**, seed **1910451501**, with palette/type kept. No redraw. `docs/design.md` takes priority over the skill's purple/slate bans, shell geometry and promotional requirements. Keep Geist, AISLEY's actual brand assets, the existing shell and role-colored primary actions.

Question: How can this person update the correct account detail without losing their place or confusing personal, store and organization data?

Inventory: private Customer ID image; independent profile photo; default-off Customer promotions; one Seller Shop; Shop cover and vacation message; Seller pickup addresses; one Logistics organization/hub; same-premises hub correction; Admin changed-email setup verification; session-owned password recovery state.

Idea: AISLEY's role-owned identity becomes a persistent summary above focused working sections. The live interactions are the existing forms, private previews and role-specific controls. No decorative imagery, invented statistics, campaign sections or scroll storytelling. All fixture identities are synthetic; no sample content is inserted into production.

Before review: the Seller account showed photo, cover, profile/storefront and security together; the baseline fixture measured about 2.4 screens of content, low-contrast empty-cover copy and a stretched profile panel. The initial simplified fixture omitted the production shell H1, so its `no-title` finding is not evidence of a missing production heading. Final portal verification uses the real `PortalShell` and `PortalNavigation`.

ROUND 1

Seen in one second: Account identity, selected section, then the form.
Idea (one sentence): Role-specific account work stays behind one clear section navigation.
Live thing: Existing profile/image/security forms and retained ordinary drafts.
Layout words by section: identity=compact row / navigation=underlined controls / content=label lane and working panel.
Scores: design 7.5 · usability 8.0 · creativity 7.0 · content 9.0 → overall 7.8.
Caps applied: App-screen rules; promotional image/motion caps inapplicable.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Mobile Profile places too much height in photo controls: reduce avatar size and arrange controls beside it.
2. Mobile identity status takes a second tall row: keep labels and values on one compact line.
3. Disabled Upload labels lose contrast through opacity: use readable neutral foreground/surface tokens instead.

ROUND 2

Seen in one second: Whose account this is, which section is selected, and where to act.
Idea (one sentence): One identity frame connects four role-specific settings experiences.
Live thing: Functional settings, previews, section history and recoverable form feedback.
Layout words by section: identity=compact row / navigation=underlined controls / content=aligned fields / actions=form footer.
Scores: design 8.0 · usability 8.5 · creativity 7.5 · content 9.0 → overall 8.2.
Caps applied: App-screen rules; no promotional caps.
Top three problems: No remaining blocking visual defects found in the reviewed fixture screens. Long forms still require normal vertical scrolling; real account/media and deployed verification remain separate acceptance.

## Verification

- Admin/Seller/Logistics TypeScript and Vite production builds passed. Existing bundle-size warnings remain.
- Customer strict TypeScript and Webpack production build passed. Initial restricted build attempts hid compilation details; the resolved build verifies the explicit client boundary on the shared export.
- Scoped Oxlint and Customer ESLint passed. Root-invoked Next ESLint emits its existing pages-directory configuration notice.
- Skill source lint: zero failures. Warnings are explicit `box-shadow: none` resets, the actual floating dialog shadow, and em dashes representing unavailable address values. Required purple focus tokens are locally annotated with their design-contract justification.
- Skill browser inspection at 1440/768/390px: zero failures and zero warnings for the four light screens and three portal dark screens. Purple palette allowance follows the design contract. Reviewed captures and page sheets; artifacts are local, not production certification.
- `node packages/ui/tests/account-settings-browser.mjs`: passed 88 role/theme/viewport/section combinations at 320/390/768/1440px. Uses real role components and the production portal shell, synthetic auth/API data and a simplified Customer frame. Covers section/history/reload/fallback, query preservation, drafts, secret disposal, save/validation/retry, preview/removal dialogs and Escape/focus restoration, Seller storefront/vacation and pickup-form access, Logistics organization/hub conflict, Customer promotional preference, each role's existing password contract, password reconciliation after section switches, keyboard activation, load-error retry, reduced motion and obsolete account responses. Browser exceptions/console errors must remain empty.
- `node src/webapp/tests/account-id-image-browser.mjs`: passed existing selection/preview/progress, success/error focus, failed-upload preservation, replacement, confirmed removal and overflow checks. Adapted this harness to the actual shared confirmation dialog.
- `git diff --check` passed. No API tests or migrations are required for these frontend-only changes.

Fixtures do not establish live Laravel integration, private storage ACLs, actual SMTP delivery, deployed approval/consent behavior or external Flutter completion. Existing role gates and contracts remain authoritative. No external photographs, clips or generated images were used; there are no image credits or production sample data to replace.

## Reproduction

Run all commands from the repository root with existing workspace dependencies and installed Chromium:

```sh
node packages/ui/tests/account-settings-browser.mjs
node packages/ui/tests/account-settings/server.mjs
```

`CHROME_PATH` selects Chromium; `ACCOUNT_SETTINGS_PORT` overrides the fixture port. Browser artifacts are written under `node_modules/.cache/account-settings-browser/`. Design inspection records and before/after captures are retained locally under `node_modules/.cache/account-settings-design/` after this task; regenerate them with the skill inspector against the fixture server. The Customer frame intentionally excludes marketplace header/session integration; portal route lists and fixture auth are synthetic.
