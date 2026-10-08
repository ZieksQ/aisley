# Logistics Settings and Support tickets browser checks

Run from the repository root. Use installed workspace dependencies and a Chromium-compatible browser; no additional package is required.

```sh
pnpm --filter logistics build
pnpm --filter logistics lint
pnpm --filter logistics exec vite preview --host 127.0.0.1 --port 15187 --strictPort
```

Start a separate headless Chromium process with CDP port `19348` and a profile inside `src/logistics/node_modules/.cache/settings-browser`. Keep it separate from other running sessions. For example, use the installed browser binary with:

```sh
chromium --headless --no-sandbox --disable-dev-shm-usage --no-first-run \
  --user-data-dir=src/logistics/node_modules/.cache/settings-browser \
  --remote-debugging-port=19348 about:blank
node src/logistics/tests/settings-support-browser.smoke.mjs
```

Override the preview/CDP addresses through `LOGISTICS_UI_ORIGIN` and `LOGISTICS_UI_CDP` when those ports are occupied. The runner creates and closes only its own browser target. Stop only the preview/browser processes started for this check.

The runner injects controlled API fixtures before rendering. It checks 390/768/1440px light/dark layouts, focus, mobile ticket list/content navigation, production input borders, Settings/legacy navigation, required-consent reachability, system/explicit/stored themes, account-menu keyboard controls, mobile sidebar focus/closure, unsent-draft cancellation and browser Back, exact create/reply retries after server failure, revision retention during background refresh, history/list pagination, obsolete responses, plain-text rendering, denied access and loading/empty/error states.

It also checks the Finance collection time-only picker and published sort-version scheduling payload. Sorting fixtures are reused from `sorting-browser.smoke.mjs`; existing unrelated Sorting actions are not rerun. Screenshots are written under ignored `src/logistics/node_modules/.cache/ui-shots/` for visual inspection.

These checks establish frontend behavior against mocked APIs and the production build. They do not certify live Laravel/PostgreSQL, real financial operations, physical devices, or external Flutter implementations.
