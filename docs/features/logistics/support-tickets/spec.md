---
feature: logistics-support-tickets
version: 1.1
status: Logistics web UI/API and in-app support-ticket notifications implemented; production interaction checks pending
role: Logistics
---

# Logistics Support Tickets

An active, Admin-approved Logistics account uses its own dashboard's `/support-tickets` page for private Admin support. This is separate from Courier operations and operational chat. The shared lifecycle and privacy rules are in `docs/features/admin/support-ticket-system/spec.md`.

- The first-release form contains subject (1–150 characters), category (`general`, `account`, `order`, `delivery`), and plain-text description (1–2,000 characters). No parcel, pickup, Courier task, or organization-record link is accepted yet.
- `/api/v1/logistics/support-tickets` provides cursor-paginated list/create/detail/reply/read routes under active Logistics, Sanctum, and policy-consent gates. The API derives and scopes ownership to the authenticated Logistics User.
- Create/reply require UUID idempotency keys; replies include the current `expected_revision`. A requester reply reopens a waiting or resolved ticket.
- Ticket creation and requester replies notify eligible Admins; Admin replies and explicit public status changes notify the active requester. These database inbox alerts use the `Support tickets` category and safe ticket-only copy; ticket and notification read states remain separate.
- The Logistics page has a distinct navigation entry, polls/refetches visible history, preserves uncertain drafts/keys for safe retry, and renders plain text safely.
- Operational decisions remain in their owning Logistics workflows. Linked records, attachments, ineligible-account appeals, and proactive Admin outreach are deferred.

## Logistics web presentation — 2026-10-08

- Use a compact request list beside the selected conversation at wide widths. Narrow/intermediate layouts show either list or content, with All tickets back navigation and focus restoration. New ticket opens a labeled form on demand.
- Show subject, reference, readable status, Manila update date and unread count. Keep error/retry feedback separate from a successful empty result; preserve loaded list/history pages when refreshing.
- Protect unsent drafts when switching tickets, cancelling, following another in-app link or using browser Back. Use the installed React Router data router/blocker for SPA navigation and before-unload confirmation for reload. Busy/uncertain submissions prevent switching until confirmed or explicitly discarded; authorization/consent loss can exit and clear private state. Private drafts stay in memory and clear when the screen unmounts or access is lost.
- Ignore obsolete detail responses after selection changes. Poll visible views, refetch on focus/reconnect, and keep the original UUID key and reply body/revision after timeout or server failure, even if background refresh updates the ticket.
- Reuse shared ticket forms/timeline and `@aisley/ui`; Logistics owns its responsive layout and scoped theme styles. No attachments, new statuses, search API or Admin actions are added.
- Repeatable controlled browser checks are documented in `src/logistics/tests/README-settings-support.md`; live API integration and external client status remain separate.

## Web conversation presentation — 2026-10-31

- Match the existing messaging hierarchy: ticket inbox, subject/status header, scrollable public history, and visible reply composer. At narrow widths, show one pane with All tickets navigation and restore focus on return.
- Present replies as incoming/outgoing bubbles with sender labels, Manila date separators and timestamps. Keep public status/assignment events visually distinct, including their reasons and actor/time history. Older history preserves reading position; new activity offers a Latest action when reading earlier entries.
- New ticket opens the existing form on demand. Keep drafts in memory, protect unsent/uncertain submissions, and retain exact idempotent retries. Ticket selection, unread state, privacy, and lifecycle remain separate from ordinary chat.
- Follow `docs/design.md` and the consuming role's theme; reuse ticket history/viewport presentation through `@aisley/ui/chat`. No attachment or API contract changes. Controlled presentation checks: `packages/support-tickets/tests/README.md`; live integration and external client status remain separate.

## Web UI refinement — 2026-11-06

- Stitch-guided inbox rows share subject, category, reference, Manila date, readable status and unread labels through `@aisley/ui/chat`. The conversation uses clearer message spacing, distinct lifecycle events, and an anchored labeled reply composer with an associated character count.
- Preserve the single-pane mobile flow, existing draft guards and exact retries. Resolved tickets explicitly explain that a requester reply reopens the ticket. Logistics resolves the complete workspace to blue/slate role tokens; Customer remains light-only.
- Existing endpoints, permissions, lifecycle and external mobile contracts are unchanged. See [verification](../../admin/support-ticket-system/chat-ui-verification-2026-11-06.md).

## Aqours-style chat workspace and requester status — 2026-11-12

- Use the Aqours-inspired Google Stitch layout: inbox, central public chat with anchored reply composer, and a separate ticket details/status inspector at wide desktop sizes. At smaller widths, Details / status switches the conversation to the inspector; All tickets preserves the existing mobile inbox flow. Keep Logistics blue/slate themes and the actual portal navigation.
- Details show only the ticket reference, status, category, support agent display name (or Awaiting assignment), and Manila created/updated times. No linked waybill, attachment, priority, presence, or encryption claim is introduced.
- Logistics alone adds `POST /api/v1/logistics/support-tickets/{ticket}/status`, with UUID `Idempotency-Key` and body `{status, reason, expected_revision}`. The current active, approved, consented Logistics requester may resolve their own nonresolved ticket or reopen their own resolved ticket to `open`. Require a trimmed public reason of 1–2,000 characters and current revision. Return the existing `{data, event}` mutation shape with private/no-store caching.
- Admin retains assignment, In progress and Waiting controls. Other requester roles gain no status route. Preserve scoped 404 ownership, RBAC/account/consent gates, row locking, immutable status history, resolved timestamps and exact retry identity. Explicit Logistics status changes notify the eligible assigned Admin/team using the existing safe status-update category and count toward Admin unread; automatic reply reopening remains unchanged.
- Status and reply drafts remain memory-only and protect navigation. A pending/uncertain status submission retries its original reason, target, revision and UUID even after refresh. A reply draft disables status editing; a status draft disables replying with guidance to finish/clear it. Conflicts refresh current data and preserve the reason for review.
- Stitch reference: [Logistics ticket conversations](https://stitch.withgoogle.com/projects/15627639405182971749). Preserve functional/design contracts where generated content adds unsupported data or behavior.
