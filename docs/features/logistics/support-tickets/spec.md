---
feature: logistics-support-tickets
version: 1.0
status: Logistics web UI and API implemented; production interaction checks pending
role: Logistics
---

# Logistics Support Tickets

An active, Admin-approved Logistics account uses its own dashboard's `/support-tickets` page for private Admin support. This is separate from Courier operations and operational chat. The shared lifecycle and privacy rules are in `docs/features/admin/chat-messaging/spec.md`.

- The first-release form contains subject (1–150 characters), category (`general`, `account`, `order`, `delivery`), and plain-text description (1–2,000 characters). No parcel, pickup, Courier task, or organization-record link is accepted yet.
- `/api/v1/logistics/support-tickets` provides cursor-paginated list/create/detail/reply/read routes under active Logistics, Sanctum, and policy-consent gates. The API derives and scopes ownership to the authenticated Logistics User.
- Create/reply require UUID idempotency keys; replies include the current `expected_revision`. A requester reply reopens a waiting or resolved ticket.
- The Logistics page has a distinct navigation entry, polls/refetches visible history, preserves uncertain drafts/keys for safe retry, and renders plain text safely.
- Operational decisions remain in their owning Logistics workflows. Linked records, attachments, ineligible-account appeals, and proactive Admin outreach are deferred.
