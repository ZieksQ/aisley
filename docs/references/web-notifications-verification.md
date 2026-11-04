# Shared web notifications verification — 2026-11-04

Customer, Seller, Admin, and Logistics inboxes and header-bell previews now use `@aisley/ui/notifications`. Detail screens, notification producers, API contracts, database state, and external Flutter interfaces are unchanged.

## Executed checks

- Seller, Admin, and Logistics TypeScript project builds and Vite production builds passed. The Customer Webpack production build, including its TypeScript stage, passed. Existing portal bundle-size warnings remain.
- Scoped Oxlint and storefront ESLint passed. `git diff --check` and workspace manifest/lockfile consistency passed. The shared package explicitly declares the already-installed React DOM development types used by its portal-based panel; no runtime dependency was added.
- `node packages/ui/tests/notifications-browser.mjs` passed **150 checks** against the actual four production applications, with synthetic authentication and notification API responses. Installed Chromium exercises 320/390/768/1440px widths across Customer light and all three portal light/dark themes, plus short phone viewports.
- The suite covers page and panel containment, five-item previews, one page H1, explicit read state, literal plain text, long titles, missing dates, unknown-category fallback, keyboard opening/Tab/Escape, close focus restoration, outside-pointer/focus dismissal, View all destinations, reduced motion, combined filters, pagination reset, browser Back/Forward, unchanged global counts, error/retry and filtered-empty recovery, stale responses, retained previews after failed refresh, support-ticket links/read calls, Admin read failure/global bulk-read behavior, and logout during an outstanding refresh.
- The out-of-order response scenario exposed and verified a fix for an Admin loading race: an aborted earlier response can no longer overwrite the current filter result's identity.
- The Logistics smoke entry point now delegates to this suite with the Logistics role selected; it no longer duplicates measured CSS classes or the shared controls.

## Visual review

The implementation follows `docs/design.md`: compact divided lists, Geist, role-specific purple/blue accents, Customer light-only surfaces, and portal themes. Real application captures live under `node_modules/.cache/notifications-browser/`; they contain synthetic data only. Phone and desktop page/panel captures were reviewed. Taste reports are generated from standalone copies of the authenticated DOM, with compiled styles/fonts embedded; these are snapshots, while the browser suite separately exercises live client behavior.

Taste's static app lint flags the contract-mandated purple focus token and warns about the contract's Logistics blue and the floating panel's shadow. These are explicit design-contract choices: purple/blue identify roles, and the shadow belongs only to the overlay. Existing shell Beta labels below 11px are outside this notification change and are the inspector's `tiny-text` allowance. Sparse filtered results may legitimately leave workspace below the list; no filler metrics or notifications are introduced.

Final Taste DOM inspections passed at 1440/768/390px: Customer 0 failures/2 warnings, Seller 0/2, Admin 0/0, and Logistics 0/2, using the existing-shell `tiny-text` allowance. Remaining warnings concern sparse filtered workspaces, the existing brand-colored shell, and Seller utility icons. Every final inspector viewport sheet was opened and reviewed. The portal page heading remains H2 under its existing shell H1; Customer owns its page H1.

### Final visual critique

- Seen in one second: Notifications, its status controls, and the first relevant update.
- Idea: AISLEY's role-specific alerts share one predictable inbox and bell-panel presentation.
- Live thing: status/category filtering and opening an authorized notification destination.
- Layout words: title/actions → toolbar → divided list → pagination; bell → floating preview.
- Scores: design 7 · usability 8 · creativity 6 · content 8 → overall 7.2. This is an internal task-screen assessment; promotional photography, hero, and cinematic-motion requirements are inapplicable under `docs/design.md`.
- Most visible remaining limits: one-result filters leave truthful workspace below the list (Customer/Seller/Logistics desktop inspector sheets); existing role-shell Beta labels are small (Logistics desktop); existing utility icons retain shell chrome (Seller desktop). Preserve these scope/contract choices instead of introducing filler or restyling unrelated navigation.

## Reproduction and limits

Build all four web apps, then run `node packages/ui/tests/notifications-browser.mjs` from the repository root. The runner starts local preview servers, installs its fixture before application scripts, and stops its processes on completion. Set `CHROMIUM_BINARY` when Chromium is not installed at `/usr/bin/chromium` or the shared driver's default location. `NOTIFICATION_BROWSER_ROLES=logistics` selects one app.

The local API was unavailable during preview checks. Customer server-side public-homepage requests logged connection failures; client authentication and notification responses were fully synthetic. These checks establish frontend behavior, not deployed API/storage, real-account access, notification delivery, assistive-technology certification, or external mobile acceptance.
