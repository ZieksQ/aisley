---
feature: logistics-support-tickets
version: 1.0
status: Logistics web UI and API implemented; production interaction checks pending
role: Logistics
---

# Logistics Support Tickets

An active, Admin-approved Logistics account uses its own dashboard's `/support-tickets` page for private Admin support. This is separate from Courier operations and operational chat. The shared lifecycle and privacy rules are in `docs/features/admin/support-ticket-system/spec.md`.

- The first-release form contains subject (1–150 characters), category (`general`, `account`, `order`, `delivery`), and plain-text description (1–2,000 characters). No parcel, pickup, Courier task, or organization-record link is accepted yet.
- `/api/v1/logistics/support-tickets` provides cursor-paginated list/create/detail/reply/read routes under active Logistics, Sanctum, and policy-consent gates. The API derives and scopes ownership to the authenticated Logistics User.
- Create/reply require UUID idempotency keys; replies include the current `expected_revision`. A requester reply reopens a waiting or resolved ticket.
- The Logistics page has a distinct navigation entry, polls/refetches visible history, preserves uncertain drafts/keys for safe retry, and renders plain text safely.
- Operational decisions remain in their owning Logistics workflows. Linked records, attachments, ineligible-account appeals, and proactive Admin outreach are deferred.

## Logistics web presentation — 2026-10-08

- Use a compact request list beside the selected conversation at wide widths. Narrow/intermediate layouts show either list or content, with All tickets back navigation and focus restoration. New ticket opens a labeled form on demand.
- Show subject, reference, readable status, Manila update date and unread count. Keep error/retry feedback separate from a successful empty result; preserve loaded list/history pages when refreshing.
- Protect unsent drafts when switching tickets, cancelling, following another in-app link or using browser Back. Use the installed React Router data router/blocker for SPA navigation and before-unload confirmation for reload. Busy/uncertain submissions prevent switching until confirmed or explicitly discarded; authorization/consent loss can exit and clear private state. Private drafts stay in memory and clear when the screen unmounts or access is lost.
- Ignore obsolete detail responses after selection changes. Poll visible views, refetch on focus/reconnect, and keep the original UUID key and reply body/revision after timeout or server failure, even if background refresh updates the ticket.
- Reuse shared ticket forms/timeline and `@aisley/ui`; Logistics owns its responsive layout and scoped theme styles. No attachments, new statuses, search API or Admin actions are added.
- Repeatable controlled browser checks are documented in `src/logistics/tests/README-settings-support.md`; live API integration and external client status remain separate.
