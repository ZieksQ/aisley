# Unified web chat inbox verification — 2026-11-03

Customer, Seller, and Logistics expose one Messages workspace with counterpart role labels. Support tickets, Admin permissions, Courier mobile contracts, and existing channel histories remain separate. The shared messaging specification owns the additive inbox contract.

## Verified locally

- Isolated SQLite `ChatInboxTest`, `ChatNotificationTest`, `CustomerChatMessagingTest`, `CustomerCourierMessagingTest`, and `OperationalMessagingTest`: **32 tests, 577 assertions passed**. Covers mixed channels, counterpart filters, read/unread summaries, stable cursor pagination, tenant/obsolete participant isolation, account/role gates, existing send/read workflows, and notification compatibility.
- `packages/ui/tests/unified-inbox-browser.mjs`: **93 checks passed** against the actual three role apps using injected synthetic auth/chat transport. Covers role labels, All/role filters, legacy URLs, 320/390/768/1440px layouts and supported themes, selected mobile composer visibility, draft restoration, exact response-loss retries, older-page selection, scroll restoration, truthful empty/error states, access-loss clearing, offline recovery, and superseded-filter responses. Browsing the inbox does not mark messages read.
- Existing `packages/ui/tests/chat-app-browser.mjs`: **56 layout/theme checks passed**, plus five Customer first-message viewport states (including a short 390×500 viewport), exact uncertain first-send retry, committed-thread navigation, and unified Back navigation.
- Customer, Seller, and Logistics TypeScript checks and production builds passed. Scoped storefront ESLint, Seller/Logistics/shared-chat Oxlint, scoped Pint, and diff whitespace checks passed. Seller and Logistics retain their existing large-chunk build warnings.
- The initial sandboxed storefront build stalled and was interrupted. The bounded retry with access for existing font fetches completed successfully; no font source or build configuration changed.

Commands run from the repository root include `DB_URL= DB_CONNECTION=sqlite DB_DATABASE=:memory: php src/api/vendor/bin/phpunit --configuration src/api/phpunit.xml` with the five suites above, direct installed TypeScript/Vite/Next executables, and `CHROMIUM_BINARY=/usr/bin/chromium node packages/ui/tests/unified-inbox-browser.mjs` / `chat-app-browser.mjs`. Direct executables avoid this environment's read-only pnpm engine-store lock.

## Design review

This extends the existing chat workspace, so the component-level Taste workflow preserves its established composition without a new direction draw or seed. Uncodixfy and Taste app-screen guidance apply beneath `docs/design.md`; no new imagery, fonts, libraries, or production sample data were added.

- Question: which authorized conversation should I read or reply to? The mixed list, role filter, previews, context and unread counts answer it before the detail pane.
- All list rows share the same alignment. Mobile shows one pane; Back restores the role filter and list position. Phone title padding was corrected after inspection.
- Role labels use text rather than a separate hue for every role. Customer/Seller retain purple; Logistics inbox selection, unread marks and identity accents use blue. Empty detail panes remain explicit rather than displaying invented content.
- Synthetic unread totals are computed from the displayed fixture rows. Actual totals come from authorized incoming messages across the selected role filter, independently of pagination.
- No charts or metrics are introduced. Read-only, empty, loading and failure states remain distinct, and operational context remains visible when opening a thread.
- All final role/theme/viewport screenshots and the inspector output sheets were reviewed. Artifacts are local under `node_modules/.cache/messages-ui/unified/`, including per-role review contact sheets.

Taste `inspect.mjs --app` ran on rendered, script-free authenticated DOM captures at 1440/768/390px: **0 FAIL, 2 WARN per role**. These captures complement the interactive live-app browser tests; they do not establish authenticated live API exchange.

- Customer/Seller used `--allow palette-purple` because purple is required by the design contract. Logistics used `--allow tiny-text` for its pre-existing 9px navigation Beta badges, outside this chat change.
- Each role retained a panel-space warning: a viewport-height inbox intentionally reserves space for longer lists while aligning with history/composer. Seller/Logistics also retained an empty-detail-area warning before selection; the explicit selection prompt is intentional.
- Customer's static capture reported a Geist font-loading warning. This is a capture limitation; the actual app and its successful production build retain the existing Next font integration. No font-delivery certification is claimed from the static capture.
- Source-only Taste lint reported the required purple selection and functional pane borders under its generic page rules. The design contract and app-screen border rules take priority; no controls were hidden to bypass inspection.

Synthetic identities (Maya Shop, Fixture Buyer, North Hub, Courier), ORDER-1042/task references, and message text exist only in browser fixtures. No launch content needs replacement. No found pictures, external credits, or generated assets are used.

## Remaining acceptance

Live authenticated cross-role API exchange, deployed PostgreSQL acceptance, real virtual keyboards, assistive technology, and external Flutter/device acceptance remain unclaimed. This web change adds no migration and changes no existing mobile-consumed payload.
