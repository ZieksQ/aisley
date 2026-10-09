# Private chat attachment API — 2026-10-06

This additive Laravel contract supports images, video and documents in existing chat relationships. External Flutter media selection, rendering, authenticated exchange and device acceptance remain **unimplemented/unverified in this repository**. Existing client text-chat evidence and adopted backend baselines are unchanged.

## Selection and limits

Select up to five files totaling at most 50 MiB. JPG/JPEG, PNG and WebP are strictly below 10 MiB each. MP4 is at most 30 MiB and 180 seconds, with one H.264 video stream and optional AAC audio; there is no transcoding. PDF, DOCX, XLSX, PPTX, ODT, ODS, ODP, UTF-8 TXT and CSV are at most 10 MiB each. Empty files, unsupported/double extensions, spoofed formats, unsafe/encrypted documents and failed malware checks are rejected. Images are decoded, bounded and rewritten without source metadata. Videos get a poster. File selection does not send a message.

## Routes

Use the authenticated caller's `/api/v1/{role}/chat-attachments` base. All routes enforce existing Sanctum, role, approval/account and consent requirements. There is no Admin attachment route. Courier uses its scoped bearer token; Customer mobile uses its scoped Customer token. Web uses session/CSRF.

| Method / suffix | Contract |
| --- | --- |
| GET base | `{data:{enabled:bool,max_files:5,max_total_bytes:52428800}}`; enabled requires explicit configuration and available inspection/scanner tools. Operators must also prepare private storage and the dedicated worker. |
| POST base | Multipart `file`, `context` JSON string, UUID `Idempotency-Key`; 201 new / 200 exact upload replay; `{data:ChatAttachment}`. Same key with different bytes, name or scope returns 409. |
| GET `/{id}` | Uploader-only status `{data:ChatAttachment}`. Poll pending work with bounded backoff; pause background/offline polling. |
| POST `/{id}/retry` | Uploader-only retry of unbound, unexpired `failed` work; no body; 200 pending / 409 ineligible / 503 unavailable. |
| DELETE `/{id}` | Uploader-only removal of unbound work; 200 `{deleted:true}` / 409 already sent. |
| GET `/{id}/content` | Authorized conversation participants only, bound ready content; private/no-store/nosniff. Documents force download. MP4 supports one byte range (206), invalid ranges return 416. |
| GET `/{id}/preview` | Authorized bound ready image thumbnail/video poster (JPEG). Missing/foreign/unbound content is scoped 404. |

Uploads/retries are limited to 15 per minute per account, separately from message counters. Upload is at most one 30 MiB file per multipart request. Do not set multipart Content-Type manually; the transport adds the boundary. Error responses retain the existing Laravel message/errors envelope: 401 auth, 403 approval/account/consent, 404 scope, 409 conflict/ended relationship, 422 validation, 429 throttle, 503 media unavailable. There is no raw storage path or public blob URL in the DTO.

## DTO and state

`ChatAttachment`: `id` UUID, `kind` image|video|document, `filename` string, `mime_type` string, `byte_size` integer, `state` pending|ready|rejected|failed|deleted, nullable `error_code`, `width`, `height`, numeric `duration_seconds`, `content_url`, `preview_url`. URLs are API-relative and role-specific; authorize each read. Pending/ready unbound assets have null URLs; use a local selected-file preview. `rejected` means select another file; `failed` permits explicit processing retry. Machine errors are `FILE_REJECTED`, `INVALID_CONTENT`, or `PROCESSING_UNAVAILABLE`. Never expose scanner output or private paths.

Every existing message adds `attachments:ChatAttachment[]`, empty for text-only messages. Clients should tolerate an omitted field against an older deployment. Existing start/reply bodies add ordered, distinct `attachment_ids:UUID[]`, maximum five. Caption `body` is optional when attachments are present and remains trimmed plain text at most 2,000 characters. Without text or attachments, validation fails. Attachment-only responses retain a readable body (`Sent an attachment` / `Sent N attachments`) for older clients and inbox previews.

Wait until every selected asset is ready before explicit Send. Server binding rechecks uploader, immutable relationship/context, ready state, expiry, count and aggregate size under locks, in the same message transaction. Ready assets cannot be reused in another message. Uploading for a prospective thread creates no empty conversation. Unbound files expire after 24 hours; sent media follows existing authorized history retention, including ended read-only relationships.

Freeze caption, ordered attachment IDs, context and UUID send key after an uncertain send. Retry that exact intent to reconcile persistence. A changed caption/ID order with the same key returns 409. Never silently omit a file or automatically create a new send key after a timeout. Upload timeout retries reuse the upload key and same selected bytes/context. Keep selected files/attempt state private in memory; clear/revoke on logout/account change or authorization loss. No offline send queue is added. Disabling new uploads preserves text sends and authorized committed media reads.

## Customer context selectors

Existing thread: `{conversation_id:"<uuid>"}`. Prospective Shop: `{channel:"shop",shop_id:"<uuid>"}` with optional validated `context_type:product|order,context_id`. Prospective Logistics or Courier: `{channel:"logistics"|"courier",context_type:"order",context_id:"<owned-order-uuid>"}`. Participants and eligibility are server-resolved. Use the same existing conversation family for Send; do not call other roles' routes.

[Messaging contracts](messaging.md), [DTO index](field-index.md), and [synthetic media examples](examples/chat-media.json) describe the same addition.

Customer–Courier mutations now use separate named per-account start (15/minute) and reply (30/minute) counters so browsing, upload/status and history do not consume those budgets. The overall 120 Customer requests/minute remains enforced. This matches existing Customer Shop/Logistics counter isolation.
