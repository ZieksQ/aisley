---
feature: courier-support-tickets
version: 1.0
status: Courier API implemented; external Flutter UI not implemented in this repository
role: Courier
---

# Courier Support Tickets

The approved Courier may create private Admin support tickets through the Laravel API. The production Courier UI is external Flutter; no Courier web screen is authorized in this repository. The shared lifecycle and privacy rules are in `docs/features/admin/chat-messaging/spec.md`.

- First-release creation accepts only `subject` (1–150 characters), `category` (`general`, `account`, `order`, `delivery`), and plain-text `body` (1–2,000 characters). Delivery Task, parcel, and Logistics-affiliation links are not accepted yet.
- All routes under `/api/v1/courier/support-tickets` require Sanctum, active approved Courier affiliation with an active Logistics organization, and policy consent. Ownership is the authenticated Courier User, not the selected Logistics account.
- `GET /` lists the Courier's tickets with `items` and `next_cursor`; `POST /` creates one ticket with a UUID `Idempotency-Key`; `GET /{ticket}` returns safe summary, ordered `events`, and `next_cursor`; `POST /{ticket}/replies` accepts `{body, expected_revision}` and the same header; `POST /{ticket}/read` accepts `{last_read_sequence}`. Foreign ticket IDs return scoped `404`.
- Exact write retries return the original result; changed-payload key or stale revision returns `409`. Replies to waiting or resolved tickets reopen them. Read markers never move backward.
- Flutter should implement its own create/list/detail/reply screen, render text as text, poll/refetch on focus/reconnect, and preserve draft plus key after timeout. Flutter integration and mobile interaction verification are still pending.
