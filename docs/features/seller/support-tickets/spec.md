---
feature: seller-support-tickets
version: 1.1
status: Seller web UI/API and in-app support-ticket notifications implemented; production interaction checks pending
role: Seller
---

# Seller Support Tickets

An active, Admin-approved Seller uses the Seller dashboard's `/support-tickets` page for private Admin support. Tickets do not give Admin access to Shop, Customer–Seller, Courier, or Logistics conversations. The shared lifecycle and privacy rules are in `docs/features/admin/support-ticket-system/spec.md`.

- The first-release form contains subject (1–150 characters), category (`general`, `account`, `order`, `delivery`), and plain-text description (1–2,000 characters). Shop, Order, and pickup links are not accepted until a role-specific authorization matrix is approved.
- The API derives the Seller User identity, enforces active Seller and policy-consent gates, and scopes list/detail/reply/read to that User. A foreign UUID returns `404`, including when an account in another role shares the same email.
- `/api/v1/seller/support-tickets` provides cursor-paginated list/create/detail/reply/read routes. Create/reply require UUID idempotency keys; replies include `expected_revision`. Requester replies reopen waiting/resolved tickets.
- Ticket creation and requester replies notify eligible Admins; Admin replies and explicit public status changes notify the active requester. These database inbox alerts use the `Support tickets` category and safe ticket-only copy; ticket and notification read states remain separate.
- The Seller page has its own navigation entry and keeps support separate from Shop and Logistics message inboxes. It polls/refetches visible history, keeps uncertain drafts and keys for safe retry, and renders public text without HTML interpretation.
- Ineligible-account appeals, attachments, linked records, and proactive Admin outreach are deferred.

## Web conversation presentation — 2026-10-31

- Match the existing messaging hierarchy: ticket inbox, subject/status header, scrollable public history, and visible reply composer. At narrow widths, show one pane with All tickets navigation and restore focus on return.
- Present replies as incoming/outgoing bubbles with sender labels, Manila date separators and timestamps. Keep public status/assignment events visually distinct, including their reasons and actor/time history. Older history preserves reading position; new activity offers a Latest action when reading earlier entries.
- New ticket opens the existing form on demand. Keep drafts in memory, protect unsent/uncertain submissions, and retain exact idempotent retries. Ticket selection, unread state, privacy, and lifecycle remain separate from ordinary chat.
- Follow `docs/design.md` and the consuming role's theme; reuse ticket history/viewport presentation through `@aisley/ui/chat`. No attachment or API contract changes. Controlled presentation checks: `packages/support-tickets/tests/README.md`; live integration and external client status remain separate.
