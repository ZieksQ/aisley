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

- Grouped the Logistics sidebar into Hub operations, Transport & delivery, Organization, and Communication while keeping Dashboard direct and the account menu separate. Preserved every operational link and Beta label, with active-route expansion including vehicle detail, keyboard controls, and mobile close behavior. Updated the Logistics Dashboard spec and domain context. Logistics TypeScript, changed-file oxlint, and Vite production build pass; the existing large-chunk warning remains.

- Reconciled the web design guide, root/frontend instructions, architecture, and project README for Customer, Admin, Seller, and Logistics: mandatory design-guide compliance, mobile-first layouts, light-only storefront, light/dark dashboards, actual shared UI exports, and scoped frontend verification. Courier mockup, Courier/Flutter contracts, and frontend runtime code were not changed; this documentation update does not certify existing screens.

- Reconciled canonical Courier and portable Flutter documentation against checkout `ca1487c`: replaced stale deferred-schema wording, documented the exact state-idempotent final-mile batch acceptance contract, synchronized dashboard/chat/COD client-adoption boundaries, expanded the implemented Courier support-ticket API into a Flutter-ready specification, and added its schema/index coverage to the copied bundle. No backend or Flutter runtime behavior changed; support-ticket and batch-acceptance Flutter screens remain unimplemented.

## 2026-09-27

- Synchronized canonical and portable Courier documentation with the imported Flutter implementation record: atomic final-mile batch acceptance, Courier support tickets, Android/file photo POD, private proof rereads, delivered-history preview, and Logistics/Seller task chat are now marked locally implemented without claiming live authenticated or physical-device acceptance. Corrected stale photo-POD deferrals and Admin support-ticket references, refreshed the planning snapshots, and advanced the portable backend baseline to `02aae38`; no backend, web, database, or Flutter runtime code changed.

## 2026-10-02

- Corrected remaining pickup/evidence contradictions in requirements, workspace, schema, Buyer/Courier/Logistics context, shared shipment guidance, and owning Courier/Logistics/Waybill/dispatch specs. First-mile identifier verification and explicit confirmation retain their compatibility writer; final-mile hub handoff submits only task revision with a UUID idempotency header and awaits Logistics validation; destination delivery requires private photo POD plus matching completion intent. Mirrored applicable corrections into the ignored Flutter documentation bundle without changing client implementation claims or runtime code. Documentation diff/contract checks only; no migrations, seeds, or application tests were run.

- Implemented the Seller counterpart of accepted-first-mile Courier chat: separate Communication sidebar inbox, eligible owned-Order contact, plain-text history/replies, persisted read markers, cursor paging, foreground polling, deadline/duplicate-safe retries, and read-only history after handoff. Added a private read-only Seller Order-context endpoint reusing existing task eligibility; no migrations, new dependencies, Courier web UI, or Flutter changes. Updated Seller chat/dashboard/Order/domain and Courier spec/handoff docs. Focused SQLite messaging regressions pass (17 tests/283 assertions); disposable PostgreSQL regressions pass (16 passed/1 SQLite-only skipped; 281 assertions), and the temporary database was removed without touching the application database. Seller TypeScript/changed-file oxlint/PHP Pint and Vite build pass; mocked-HTTP Chromium checks pass at 390/768/1280px with both themes, focus, offline, validation/throttle/retry, incoming/read state, older-history gap recovery, and denied-history clearing. Courier–Seller PostgreSQL concurrency/live external Flutter exchange remain release gates; the existing large-chunk build warning remains. The Uncodixfy skill guided restrained styling within the existing Seller design contract.
