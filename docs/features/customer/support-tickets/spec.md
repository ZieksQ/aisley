---
feature: customer-support-tickets
version: 1.1
status: Customer web UI/API and in-app support-ticket notifications implemented; production interaction checks pending
role: Customer
---

# Customer Support Tickets

The authenticated, active Customer uses `/account/support-tickets` to create and follow a private Admin support ticket. This is separate from Shop chat and delivery conversations. The shared lifecycle, privacy, idempotency, and Admin authority contract is `docs/features/admin/support-ticket-system/spec.md`.

- The first-release form has subject (1–150 characters), category (`general`, `account`, `order`, `delivery`), and plain-text description (1–2,000 characters). There is no Order selector or linked-record field. The API rejects undeclared context fields.
- The Customer may list, view, reply to, and mark read only tickets whose `requester_user_id` is their authenticated User ID and whose role is `customer`. A reply to a waiting or resolved ticket reopens it.
- `/api/v1/customer/support-tickets` provides cursor-paginated list/create/detail/reply/read routes. Create and reply require a UUID `Idempotency-Key`; replies include the current `expected_revision`.
- The UI preserves the draft and key after an uncertain write, retries the same mutation, polls visible history, and refetches on focus/reconnect. Text renders as text. Unread tickets remain separate from chat and notification read state.
- Admin replies and explicit public status changes create an in-app `support` notification with a safe ticket reference and authorized `/account/support-tickets?ticket=UUID` destination; ticket content is never copied into notification text. Notification state does not change the ticket read marker.
- Pending, rejected, suspended, and deactivated Customer accounts have no in-app support exception in this release. Attachments, linked Orders, and exceptional appeal access are deferred.

## Web conversation presentation — 2026-10-31

- Match the existing messaging hierarchy: ticket inbox, subject/status header, scrollable public history, and visible reply composer. At narrow widths, show one pane with All tickets navigation and restore focus on return.
- Present replies as incoming/outgoing bubbles with sender labels, Manila date separators and timestamps. Keep public status/assignment events visually distinct, including their reasons and actor/time history. Older history preserves reading position; new activity offers a Latest action when reading earlier entries.
- New ticket opens the existing form on demand. Keep drafts in memory, protect unsent/uncertain submissions, and retain exact idempotent retries. Ticket selection, unread state, privacy, and lifecycle remain separate from ordinary chat.
- Follow `docs/design.md` and the consuming role's theme; reuse ticket history/viewport presentation through `@aisley/ui/chat`. No attachment or API contract changes. Controlled presentation checks: `packages/support-tickets/tests/README.md`; live integration and external client status remain separate.

## Web UI refinement — 2026-11-06

- Stitch-guided inbox rows share subject, category, reference, Manila date, readable status and unread labels through `@aisley/ui/chat`. The conversation uses clearer message spacing, distinct lifecycle events, and an anchored labeled reply composer with an associated character count.
- Preserve the single-pane mobile flow, existing draft guards and exact retries. Resolved tickets explicitly explain that a requester reply reopens the ticket. Logistics resolves the complete workspace to blue/slate role tokens; Customer remains light-only.
- Existing endpoints, permissions, lifecycle and external mobile contracts are unchanged. See [verification](../../admin/support-ticket-system/chat-ui-verification-2026-11-06.md).
