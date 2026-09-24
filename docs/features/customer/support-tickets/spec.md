---
feature: customer-support-tickets
version: 1.0
status: Customer web UI and API implemented; production interaction checks pending
role: Customer
---

# Customer Support Tickets

The authenticated, active Customer uses `/account/support-tickets` to create and follow a private Admin support ticket. This is separate from Shop chat and delivery conversations. The shared lifecycle, privacy, idempotency, and Admin authority contract is `docs/features/admin/chat-messaging/spec.md`.

- The first-release form has subject (1–150 characters), category (`general`, `account`, `order`, `delivery`), and plain-text description (1–2,000 characters). There is no Order selector or linked-record field. The API rejects undeclared context fields.
- The Customer may list, view, reply to, and mark read only tickets whose `requester_user_id` is their authenticated User ID and whose role is `customer`. A reply to a waiting or resolved ticket reopens it.
- `/api/v1/customer/support-tickets` provides cursor-paginated list/create/detail/reply/read routes. Create and reply require a UUID `Idempotency-Key`; replies include the current `expected_revision`.
- The UI preserves the draft and key after an uncertain write, retries the same mutation, polls visible history, and refetches on focus/reconnect. Text renders as text. Unread tickets remain separate from chat and notification read state.
- Pending, rejected, suspended, and deactivated Customer accounts have no in-app support exception in this release. Attachments, linked Orders, and exceptional appeal access are deferred.
