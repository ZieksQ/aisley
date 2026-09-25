---
feature: seller-support-tickets
version: 1.0
status: Seller web UI and API implemented; production interaction checks pending
role: Seller
---

# Seller Support Tickets

An active, Admin-approved Seller uses the Seller dashboard's `/support-tickets` page for private Admin support. Tickets do not give Admin access to Shop, Customer–Seller, Courier, or Logistics conversations. The shared lifecycle and privacy rules are in `docs/features/admin/chat-messaging/spec.md`.

- The first-release form contains subject (1–150 characters), category (`general`, `account`, `order`, `delivery`), and plain-text description (1–2,000 characters). Shop, Order, and pickup links are not accepted until a role-specific authorization matrix is approved.
- The API derives the Seller User identity, enforces active Seller and policy-consent gates, and scopes list/detail/reply/read to that User. A foreign UUID returns `404`, including when an account in another role shares the same email.
- `/api/v1/seller/support-tickets` provides cursor-paginated list/create/detail/reply/read routes. Create/reply require UUID idempotency keys; replies include `expected_revision`. Requester replies reopen waiting/resolved tickets.
- The Seller page has its own navigation entry and keeps support separate from Shop and Logistics message inboxes. It polls/refetches visible history, keeps uncertain drafts and keys for safe retry, and renders public text without HTML interpretation.
- Ineligible-account appeals, attachments, linked records, and proactive Admin outreach are deferred.
