# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:

`
## YYYY-MM-DD
- Feature/change short summary
`

---

## 2026-09-24

- Archived the complete merged progress log at `docs/logs/PROGRESS-2026-09-24-2.md`. The earlier `docs/logs/PROGRESS-2026-09-24.md` is the preserved pre-rebase branch log; its operational Generate Report implementation was omitted in favor of `origin/main` Finance. Continue app-wide entries here.

- Post-rebase verification: focused Finance, Admin campaign, Seller review/dashboard, and Customer chat API tests pass together (26 tests/316 assertions), the storefront Webpack production build and changed-file ESLint pass, and Admin/Seller oxlint pass. The full API run still stops at the Logistics profile-photo process-exit test, which passes alone (1 test/8 assertions). Admin/Seller builds remain unverified because local `pnpm` cannot open its database and the installed workspace lacks `@aisley/finance-ui` links; PostgreSQL at port 5436 is unavailable.

- Revised the Logistics operational chat specification: Seller contact follows the selected pickup request, Courier contact requires an active task, and Buyer contact requires an active owned Order handled by the organization. Separated these threads from existing Customer–Seller chat and marked all Logistics chat routes/UI as proposed, pending an additive shared messaging extension and verification.

- Replaced the Admin live-chat draft with a proposed support-ticket contract for eligible requesters, Admin triage/assignment, persistent replies, status transitions, authorization, and notification boundaries. Updated the Admin domain and affected shared/complaint documentation; ticket schema, APIs, and UI remain unimplemented.

- Revised the Courier operational messaging specification for external Flutter: active task/leg-scoped Seller, Buyer, and Logistics contact; private idempotent text threads; role-safe history/read state; and explicit proposed `/api/v1/courier/operational-conversations` routes. No Courier chat API or Flutter UI availability is claimed.

- Implemented Logistics–Courier task messaging with additive shared-conversation context, scoped Laravel inbox/start/detail/history/send/read routes for both roles, idempotent ordered text, read markers, task/affiliation gating, and a Logistics inbox with task entry links. Existing Customer–Shop chat remains isolated; Seller/Buyer operational chat and Courier Flutter UI remain deferred. Focused SQLite messaging tests pass (10 tests/125 assertions); the full API run still exits at the existing Logistics profile-photo test, and PostgreSQL race verification remains pending. Logistics changed-file oxlint passes; full TypeScript build is blocked by the existing missing `@aisley/finance-ui` workspace module.

- Added separate Customer–Logistics delivery conversations for owned active Orders and their current handling organization, with participant-scoped history, idempotent ordered messages, read markers, custody/terminal read-only gating, and Customer/Logistics inbox and Order/parcel entry points. Kept Customer–Shop and Courier task channels isolated. Fixed the Shop-chat kind filter, bounded Customer/Seller send waits to 15 seconds with safe draft/key retry, and added a reusable local Chromium chat smoke check. Focused SQLite messaging tests pass (13 passed, 1 PostgreSQL-only skipped; 171 assertions); disposable PostgreSQL focused tests pass (12 passed, 1 SQLite-only skipped; 169 assertions), two-worker Customer–Shop race passes (1 test/14 assertions), and both chat migrations roll back/reapply. Chromium passed Customer/Seller 390px, plain-text, reconnect, offline/timeout retry, and Customer–Logistics exchange. Private-message retention/abuse policy and Order-chat two-worker races remain open.

- Added separate Seller–Logistics pickup-request conversations with server-resolved participants, tenant-scoped routes, idempotent text, read markers, and read-only history when the pickup relationship ends. Seller Pickup Requests and Logistics Pickup Detail now link to their own role inboxes; Customer–Shop and Courier/Customer operational threads remain isolated. Focused SQLite operational and Customer chat regressions pass (14 tests/209 assertions), Seller/Logistics TypeScript, lint, and Vite builds pass; Seller/Logistics browser exchange and two-worker PostgreSQL races remain release checks because local PostgreSQL port 5436 was unavailable. The full API run still stops at the known Logistics profile-photo premature PHP process exit. Private-message retention/abuse policy remains open.

- Added separate accepted-task Courier–Seller first-mile and Courier–Buyer final-mile API channels, with Seller/Customer counterpart route families, server-resolved participants, scoped history, idempotent text, read markers, and read-only history after handoff/delivery or reassignment. Added a portable Courier API handoff document; per request, no Flutter or Seller/Customer UI was changed. Focused SQLite operational and Customer chat regressions pass (17 tests/265 assertions); PostgreSQL port 5436 was unavailable, so two-worker races and external client verification remain open.

- Synchronized the copied Courier Flutter documentation bundle against the current Laravel contracts, including all three task-chat counterparts, COD completion, recent schema/workflow changes, and the Flutter client's partial photo-POD adoption. Brought the clearer Flutter dashboard scaffold/aggregate boundary and localhost secure-storage/upload guidance back into affected canonical Courier docs. No application code or live client integration changed.

- Implemented separate UUID-backed Admin support tickets with role-owned Customer/Seller/Logistics web forms, Courier API routes for external Flutter, an Admin triage/assignment/reply/status queue, append-only events, actor-scoped idempotency, and independent per-Admin read markers. Ticket creation accepts only subject/category/description; linked business records and notification fanout remain deferred. Focused SQLite ticket and chat regressions pass (25 tests/329 assertions), four web projects type-check, and Admin/Seller/Logistics Vite plus Customer Next builds pass. PostgreSQL migration/concurrency and browser/mobile interaction checks remain pending because the configured local PostgreSQL connection is unavailable.

## 2026-09-25

- Grouped the Admin sidebar into Accounts, Communication, Platform, and My account while keeping Dashboard direct, feature-permission filtering, active-route expansion, keyboard controls, and mobile close behavior. Updated the Dashboard navigation contract and Admin domain route list. Admin TypeScript, changed-file oxlint, and Vite production build pass; the existing large-chunk build warning remains.

- Grouped the Seller sidebar into Shop, Orders, Communication, and My account while keeping Dashboard direct and Monitoring/Approval/Pickup separate. The current group's navigation opens automatically for detail and preparation routes, with keyboard-operable controls and mobile close behavior. Updated the Seller Dashboard, Order Approval, and domain docs. Seller TypeScript, changed-file oxlint, and Vite production build pass; the existing large-chunk warning remains.
