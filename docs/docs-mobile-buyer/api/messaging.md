# Buyer communication API contracts

> Implementation, SDK/package resolution, tests, builds and browser results in this guide are reports from the external Buyer Flutter project and were not rerun here. This bundle contains documentation; `lib/`, tests, tools, lockfiles and build reports belong to that project. Current shipping-contract adoption remains [G25](../references/integration-gaps.md).

Backend and Buyer Flutter inboxes/composers implemented; [Phase 4 evidence](../references/phase-4-verification.md) records partial acceptance. Each route uses Sanctum, active Customer and consent; Laravel derives participants. Plain-text bodies are trimmed, nonempty and at most 2,000 characters. Starts/sends require UUID `Idempotency-Key`. Foreign IDs are scoped not-found; resource denial clears the affected history. No role's operational workflow becomes available through a conversation.

## Separate channels

| Channel | Customer API base | Start fields | Read fields | List/history response |
| --- | --- | --- | --- | --- |
| Shop | `/api/v1/customer/conversations` | `shop_id,body`, optional `context_type:product|order` and `context_id` | `sequence` | `{items,next_cursor,unread_count}` inbox; `{items,next_cursor}` history |
| Logistics | `/api/v1/customer/logistics-conversations` | `context_type:"order",context_id:<owned Order UUID>,body` | `last_read_sequence` | `{data:[...],meta:{next_cursor,unread_count}}` inbox; `{data:[...],meta:{next_cursor}}` history |
| Courier | `/api/v1/customer/courier-conversations` | `context_type:"order",context_id:<owned Order UUID>,body` | `last_read_sequence` | same operational envelopes as Logistics |

For each base: `GET` inbox, `POST` first message/start, `GET /{conversation}` summary, `GET /{conversation}/messages`, `POST /{conversation}/messages`, and `POST /{conversation}/read`. Shop has separate `GET /unread-count`. Operational inbox `meta.unread_count` supplies each channel's total; there are no equivalent dedicated operational unread routes.

Shop list accepts opaque cursor and uses 20 threads; history uses 30 messages. Operational list/history accept cursor (≤2,048 chars) and limit 1–50, default 20. Pages arrive with newest-first cursor selection but messages in each page are returned ascending. Merge by UUID/sequence, maintain reachable older pages after foreground gaps and do not fabricate cursors. Summary is `{data:...}`; start/send is `{conversation,message}`. Shop starts/sends return 201, including replay under its current facade; operational writes return 201 new/200 replay. Both are successful results.

Shop messages include safe `context` and use the Shop public identity. Operational summaries include their Order/task/leg context, `last_read_sequence`, `unread_count`, `send_allowed`, `read_only_reason`; participant identifiers differ from Shop DTOs. Preserve `mine` and sequence/time from server messages. Consult the [typed wire tables](field-index.md) for nested keys/types/nullability, and never guess Seller/Courier contact fields.

## Shop relationship

One Customer–Shop conversation is reused across Product/owned Order contexts. The first valid message creates it; opening a composer does not persist an empty thread. Start checks currently public Shop/Product or owned Order-Shop relationship and the active owning Seller. History remains scoped when contexts become unavailable; safe placeholders replace unavailable Product content. Current server reply permission is authoritative, including Seller account changes. No arbitrary user recipient search exists.

Optional context attaches to individual Shop messages; subsequent sends accept body and valid Product/Order context. Do not use an Order ID as a separate Shop-thread identity or include another Shop's items.

## Logistics relationship

Thread kind is `customer_logistics`. Start requires an owned active Order and a server-resolved current handling Logistics organization/hub. The API rechecks custody, organization and Order status under locks. Terminal Orders or ended handling contexts disable sends; original participants retain only authorized read-only history. A new handling relationship must not inherit another organization's private text. The Buyer cannot choose organization/hub/user IDs or call Logistics routes.

## Courier relationship

Thread kind is `courier_customer`. `GET /api/v1/customer/courier-conversations/order-context/{order}` returns `data:{order_id,order_reference,send_allowed,conversation_id}`. This read creates no thread. Use it for **Message delivery Courier** or **View Courier conversation**; Courier name in tracking or task offer alone is insufficient.

The server resolves an accepted final-mile task, active Courier/affiliation/organization, nonterminal Order and valid handling custody. Eligible active stages include accepted, picked up from hub, in transit and out for delivery. Delivery, failure/cancellation, reassignment or custody loss disables sends. Original participants retain scoped history; a replacement Courier receives a separate private thread. The Buyer submits Order context only and never calls `/courier/operational-conversations` or accepts/changes the task.

## Flutter delivery/recovery

Poll each visible online inbox/thread at a bounded interval (15 seconds follows the storefront), plus focus/reconnect refresh; pause in background/offline. This is foreground HTTP delivery, not push or guaranteed instant realtime. Keep chat unread, ticket reads and general notification reads separate.

Disable duplicate sends. Freeze the pending body/context/key after uncertain network/timeout; exact retries reconcile the same logical message. Pending first-send context must survive polling until resolved. `409` can signal idempotency conflict or ended relationship; refresh state and explain, never silently create a new key. Preserve safe draft/key on throttle. Correctable `422` needs a deliberate corrected attempt, while uncertain previous writes require reconciliation first. Render committed messages as sent only after the response confirms them.

No offline queue, attachments, calls, typing/presence, edits, deletes or blanket Admin transcript access is implemented. Message retention/abuse policy and task-chat two-worker races/live external exchange remain release gaps. Clear drafts/transcripts and stop timers on logout, identity change or scoped denial. New text must not steal focus or force scroll while reading older history.

Sources at baseline: `ConversationApi`, `ConversationService`, `CustomerLogisticsConversationService`, `CourierCounterpartyConversationService`, `CourierCounterpartyEligibility`, Messaging Requests, Customer controllers, `CustomerChatMessagingTest`, `CustomerCourierMessagingTest`, and `OperationalMessagingTest`. Their upstream paths are indexed in [provenance](../references/source-provenance.md).

## Newly inspected portable fixtures

Checkout57e9eb2 reinspection confirmed current Customer-only routes, actor-scoped participants/replay/read state, exact envelopes and Courier order-context. [Operation contracts](operations.md), [wire types](field-index.md), [error codes](error-codes.json) and per-channel [synthetic examples](examples/README.md) are local implementation inputs. No upstream reader or live capture is required for initial authoring; live counterpart/device and two-worker race gates remain pending. Shop read sequence≥1 and operational last_read_sequence≥1 differ from support last_read_sequence≥0. Private cache/transcript cleanup rejects delayed errors as well as successes.
