# Courier task chat API handoff

**Backend contract:** `courier-operational-messaging-v2` (2026-09-24). This file is for the external Flutter client and Seller/Customer app owners. It describes implemented Laravel endpoints, not completed client screens.

## Eligibility and identity

| Channel | Courier start selectors | Counterpart start selector | Send window |
| --- | --- | --- | --- |
| Courier ↔ Logistics | `leg`, task-list `task_id`, `counterparty_role: "logistics"` | Logistics task context | Offered or accepted active task |
| Courier ↔ Seller | `leg: "first_mile"`, first-mile task-list `task_id`, `counterparty_role: "seller"` | Seller-owned Order UUID | Accepted first-mile task until Seller handoff |
| Courier ↔ Buyer | `leg: "final_mile"`, final-mile task-list `task_id`, `counterparty_role: "customer"` | Customer-owned Order UUID | Accepted final-mile task before delivery |

The API derives task, Courier, Shop/Buyer, Logistics organization, and hub from persisted records. Seller and Buyer conversations are separate `courier_seller` and `courier_customer` kinds, not Customer–Shop, Seller–Logistics, Customer–Logistics, or Logistics–Courier threads. A new Courier assignment gets a new thread; the former Courier's history remains read-only to its original participants. No client supplies another user's ID, organization, hub, sender, or membership.

## Routes and payloads

All requests use `/api/v1`, `Accept: application/json`, role-specific Sanctum authentication, active approval, and policy consent. Courier Flutter uses `Authorization: Bearer <token>`; web clients use their existing Sanctum session/CSRF handling. Writes return `Cache-Control: private, no-store` and require online confirmation. Every start/send has a fresh UUID `Idempotency-Key`; retry an uncertain send with the **same** key and body.

| Caller | Route family |
| --- | --- |
| Courier | `/api/v1/courier/operational-conversations` |
| Seller | `/api/v1/seller/courier-conversations` |
| Buyer (`customer` API role) | `/api/v1/customer/courier-conversations` |

Each family has `GET /` (inbox), `POST /` (first message/start), `GET /{conversation}`, `GET /{conversation}/messages`, `POST /{conversation}/messages`, and `POST /{conversation}/read`. Inbox/history accept `cursor` and `limit` (default 20, maximum 50); the Courier inbox also accepts `leg=first_mile|final_mile`.

Courier start:

```json
{"leg":"first_mile","task_id":"<first-mile-task-list-uuid>","counterparty_role":"seller","body":"I am heading to your Shop."}
```

For Buyer contact, use `leg: "final_mile"`, the UUID from `final-mile-tasks`, and `counterparty_role: "customer"`. A first-mile task-list UUID is the legacy task reference; Laravel maps it to the shared DeliveryTask. For Seller/Buyer counterpart start, use:

```json
{"context_type":"order","context_id":"<owned-order-uuid>","body":"I can meet you at the entrance."}
```

Start and send return `201` for a new message and `200` for an exact idempotent retry:

```json
{"conversation":{"id":"<uuid>","kind":"courier_seller","leg":"first_mile","task_id":"<uuid>","task_reference":"<safe-reference>","order_id":"<uuid>","order_reference":"<safe-reference>","counterparty_role":"seller","counterparty_label":"<Shop name>","last_sequence":1,"last_read_sequence":0,"unread_count":0,"send_allowed":true,"read_only_reason":null},"message":{"id":"<uuid>","conversation_id":"<uuid>","sequence":1,"sender_role":"courier","mine":true,"body":"I am heading to your Shop.","created_at":"<UTC ISO-8601>"}}
```

Other safe thread fields include `last_message_preview` and `last_message_at`. The Buyer-facing `counterparty_label` is the generic `Courier`, not a private identity/contact field. The Courier-facing Buyer label is `Buyer`. Do not render `body` as HTML/Markdown.

`GET /` returns `{ "data": [<thread>], "meta": { "next_cursor": null, "unread_count": 0 } }`. `GET /{id}` and `POST /{id}/read` return `{ "data": <thread> }`. `GET /{id}/messages` returns `{ "data": [<message>], "meta": { "next_cursor": null } }`, ordered by ascending `sequence` within the page. Send uses `{ "body": "..." }`; read uses `{ "last_read_sequence": 1 }`. Bodies are trimmed, nonempty plain text up to 2,000 characters. Only other-party messages after the caller's monotonic marker count as unread.

`401` means unauthenticated; `403` means account/approval/consent denial; scoped `404` means unavailable or foreign context/thread; `409` means task/relationship ended or idempotency conflict (`TASK_NOT_ACTIVE`, `CONVERSATION_READ_ONLY`, `IDEMPOTENCY_CONFLICT`); `422` means invalid body, leg/counterpart pair, UUID/key, or unsupported fields; `429` means throttled. Never treat a timeout as a saved message until an exact-key retry confirms it.

## Client work not in this repository

- Flutter: show Logistics on active offered/accepted tasks, Seller only after first-mile acceptance, Buyer only after final-mile acceptance. Implement inbox/thread, private in-memory message state, foreground polling, read markers, timeout-safe retry, offline/401/403/404/409/422/429 states, and clear data on logout/account switch.
- Seller dashboard: add a first-mile Courier entry from an eligible owned Order and an inbox/reply screen using the Seller family.
- Customer storefront: add a final-mile Courier entry from an eligible owned Order and an inbox/reply screen using the Customer family.
- Verify live cross-role exchange and task reassignment/terminal behavior before enabling any client button. No Courier production web UI is added here.
