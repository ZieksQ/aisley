# Support ticket chat UI verification — 2026-11-06

Scope: Customer, Seller, Logistics requester web screens and Admin ticket queue/detail. Courier remains external mobile-only. No API, authorization, lifecycle, notification or external mobile contract changes.

## Design context

- Used Google Stitch MCP before UI implementation and supplied the existing requester/Admin endpoint paths plus visual requirements. Project: [AISLEY support ticket UX](https://stitch.withgoogle.com/projects/13843117589710674814), Seller screen `47c8a445db664e85827634922499b648`, Admin screen `090ac00ebe9642068699fe919ee40fc6`.
- Automatic approval review rejected the initial broader prompt containing authentication/authorization details. The subsequent endpoint-only request succeeded. No additional approval or broader export was needed.
- Reviewed both Stitch screenshots. Adopted inbox selection, message spacing, chronological event treatment and anchored composer. Excluded generated search, fictional categories/statuses, team tools, internal notes, attachments and other unsupported controls.
- Applied design-taste-frontend and uncodixfy under `docs/design.md`. App draw: **Framed sheet**, seed **579616629**, selected for the inbox/conversation working layout; no redraw. Existing shells, Geist, purple/blue role palettes and slate themes take precedence over skill prescriptions. Promotional hero/AIDA checks are inapplicable.
- Screen question: “Which ticket needs my attention, and what should I reply?” Subject/status, public history and composer establish the hierarchy. Shared rows/status presentation lives in `packages/ui/src/chat`; role workflows and clients retain their owners. Admin management begins collapsed and preserves its drafts when hidden.

## Checks

- Customer, Seller, Admin and Logistics TypeScript checks passed. Production builds passed for all four apps. Sandboxed Customer Turbopack compilation stalled; stopped that task-owned process and reran successfully with local process permissions. Portal builds retain existing bundle-size warnings.
- Scoped Oxlint and `git diff --check` passed. Existing Admin support-ticket URL-filter test passed.
- Controlled Chromium suite: 35 role/theme/viewport combinations (320/390/768/1440/1800px; Customer light only, other roles light/dark), plus new-ticket focus/cancel, mobile Back, category labels, empty/error views, resolved requester/Admin guidance, view-only controls, Admin management disclosure, role accent inheritance, plain text, draft cancellation, exact uncertain retry, older-history anchoring and new-activity navigation. Expanded-management Send-button visibility also passed at all five widths in both Admin themes.
- Taste source lint: no failures. Warnings are the required Logistics blue tokens, explicit `box-shadow: none` resets, and the actual floating Latest control's small overlay shadow.
- Taste browser inspection at 1440/768/390px: selected Seller light conversation has no findings. Selected Logistics dark conversation has no failures and a stronger-border warning; retained role-compatible slate borders for readable pane/message separation. Unselected Seller inspection warns about naturally sparse inbox/empty-detail space; no fabricated content fills it.
- Reviewed desktop/tablet/phone light and dark captures. Corrected the Logistics H1 and reduced the expanded management panel height so it preserves room for the public composer. Programmatic requester heading focus remains available without an ornamental outline; interactive controls retain visible keyboard focus.

## Reproduction and evidence

From the repository root, follow `packages/support-tickets/tests/README.md`. The actual shared requester workspace, Logistics workspace, Admin queue and Admin detail render with synthetic ticket data. Query parameters `selected`, `dark`, `resolved`, `empty`, `error` and Admin `queue` support focused inspection.

Ignored local artifacts are under `node_modules/.cache/support-tickets/`: role/theme/width PNGs, expanded management PNGs, `before/`, `taste-light-selected/`, `taste-dark/`, and `direction/`. Synthetic subjects, names, dates and replies are confined to the fixture; production renders API data.

These component checks do not certify authenticated role shells, live Admin mutation integration, PostgreSQL concurrency, deployed acceptance, real mobile keyboards or external Flutter clients. Their previous status remains unchanged. No new dependencies were added.
