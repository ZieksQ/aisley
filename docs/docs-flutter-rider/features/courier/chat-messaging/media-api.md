# Private chat attachment API — 2026-10-17

This Laravel contract supports new image/video uploads and historical document reads in existing chat relationships. Buyer and Courier Flutter image selection/send, authenticated images and receive-only MP4/document consumption are implemented locally. New uploads use the revised limits below; deployed media exchange and installed-device acceptance remain open.

## Selection and limits

Select up to five PNG/JPG/JPEG/MP4 files, at most 8,000,000 bytes (8 MB) each inclusive. PNG/JPEG images are bounded to 4,096 pixels per edge and 8 megapixels and are decoded/rewritten without source metadata. MP4 retains the 180-second cap, one H.264 video stream and optional AAC audio; no transcoding. Reject new WebP, document, audio and unlisted uploads, empty/corrupt/spoofed files and double extensions. The existing 50 MiB aggregate ceiling remains compatible; five new files can total at most 40,000,000 bytes. Selection does not send a message.

Apply the new allowlist/byte bounds to uploads, processing and every new binding. Historical unbound WebP/documents or oversized files cannot be newly bound. Preserve authorized retrieval and exact replay of media already committed to a message, including historical WebP/documents; this does not permit changed retry payloads.

The school deployment may explicitly set `CHAT_MEDIA_SCAN_ENABLED=false`. Malware scanning is then skipped, while content/type/size/authorization checks remain required. When scanning is enabled, scanner failure/unavailability blocks processing. Private storage, worker and tools remain required. Clients must remove WebP from new selection and use the revised image dimensions; this contract revision does not establish Flutter implementation/adoption. Prior client evidence and live/device gates remain unchanged.

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

Uploads/retries are limited to 15 per minute per account, separately from message counters. Upload one file per multipart request, at most 8,000,000 bytes for PNG/JPG/JPEG/MP4 only. Do not set multipart Content-Type manually; the transport adds the boundary. Error responses retain the existing Laravel message/errors envelope: 401 auth, 403 approval/account/consent, 404 scope, 409 conflict/ended relationship, 422 validation, 429 throttle, 503 media unavailable. There is no raw storage path or public blob URL in the DTO.

## DTO and state

`ChatAttachment`: `id` UUID, `kind` image|video|document, `filename` string, `mime_type` string, `byte_size` integer, `state` pending|ready|rejected|failed|deleted, nullable `error_code`, `width`, `height`, numeric `duration_seconds`, `content_url`, `preview_url`. URLs are API-relative and role-specific; authorize each read. Pending/ready unbound assets have null URLs; use a local selected-file preview. `rejected` means select another file; `failed` permits explicit processing retry. Machine errors are `FILE_REJECTED`, `INVALID_CONTENT`, or `PROCESSING_UNAVAILABLE`. Never expose scanner output or private paths.

Every existing message adds `attachments:ChatAttachment[]`, empty for text-only messages. Clients should tolerate an omitted field against an older deployment. Existing start/reply bodies add ordered, distinct `attachment_ids:UUID[]`, maximum five. Caption `body` is optional when attachments are present and remains trimmed plain text at most 2,000 characters. Without text or attachments, validation fails. Attachment-only responses retain a readable body (`Sent an attachment` / `Sent N attachments`) for older clients and inbox previews.

Wait until every selected asset is ready before explicit Send. Server binding rechecks uploader, immutable relationship/context, ready state, expiry, count and aggregate size under locks, in the same message transaction. Ready assets cannot be reused in another message. Uploading for a prospective thread creates no empty conversation. Unbound files expire after 24 hours; sent media follows existing authorized history retention, including ended read-only relationships.

Freeze caption, ordered attachment IDs, context and UUID send key after an uncertain send. Retry that exact intent to reconcile persistence. A changed caption/ID order with the same key returns 409. Never silently omit a file or automatically create a new send key after a timeout. Upload timeout retries reuse the upload key and same selected bytes/context. Keep selected files/attempt state private in memory; clear/revoke on logout/account change or authorization loss. No offline send queue is added. Disabling new uploads preserves text sends and authorized committed media reads.

## Courier context selectors

Existing thread: `{conversation_id:"<uuid>"}`. Prospective thread: `{channel:"operational",leg:"first_mile"|"final_mile",task_id:"<task-list-uuid>",counterparty_role:"logistics"|"seller"|"customer"}`. Existing rules allow Logistics on offered/accepted active tasks, Seller only after first-mile acceptance and Buyer only after final-mile acceptance. First-mile task-list IDs keep the existing mapping to the shared DeliveryTask. Upload does not extend the send window or transfer history on reassignment.

Example multipart context: `{"channel":"operational","leg":"final_mile","task_id":"11111111-1111-4111-8111-111111111111","counterparty_role":"customer"}`. After status becomes ready, POST the existing Courier operational start selectors plus `attachment_ids:["22222222-2222-4222-8222-222222222222"]`, optional body, and UUID send key. Use `Authorization: Bearer <courier-token>` for uploads, polling, image/video bytes and downloads. A Flutter URL widget without bearer headers cannot read private media; use authenticated transport and dispose private buffers on account change.

## Flutter consumption — 2026-10-12 (audit G26)

Buyer and Courier support receive-only MP4 playback and document download in every existing chat channel, with image-only selection/send. New image selections accept 8,000,000 bytes exactly and reject larger files before dispatch; permanent upload 422 requires removal/replacement. Count/aggregate and frozen uncertain-send identity remain unchanged.

Content reads validate ready metadata, allowed kind/extension/MIME, exact attachment ID and role-relative path, response MIME and size before export/playback. Bounded streams reject redirects, empty/truncated/oversized bodies and obsolete scopes. Every read uses the existing bearer client; players and download adapters receive fetched bytes only. Historical committed reads remain supported up to the former image (<10 MiB), MP4 (30 MiB) and document (10 MiB) bounds; these retrieval limits grant no new upload/binding permission.

Videos have an authorized poster and explicit View video, Play/Pause and seeking; no autoplay or background playback. Android uses generated private temporary playback files, removed on close/access loss and swept on next startup; web uses revocable blob URLs. Documents show filename/format/size and Download, without inline viewers. Android uses a two-phase system Save As picker that holds no bytes until a still-current choice is confirmed; cancellation/access loss suppresses writes and removes incomplete destinations. Web downloads from fetched bytes and revokes its blob URL. Download feedback reports the request, not unobservable browser completion. Explicitly saved document copies belong to the user and remain after sign-out.

Cancel reads, evict images, dispose players, clear download buffers and remove temporary handles on identity/controller replacement, logout, consent/relationship loss or close. Ignore obsolete success/error replies. HTTP 429 respects Retry-After with manual retry; no offline queue or automatic unchanged upload retry is added. Playback uses pinned video_player 2.11.1, path_provider 2.1.6 and web 1.1.1; the initially evaluated file_saver was excluded because its byte/picker and blob lifecycle did not meet these boundaries. Android document export is a focused native channel; no broad storage permission is added.

Adopted media baseline: Laravel `28fc740` and the 2026-10-11 decimal-byte limit revision. Local source/test/build/browser evidence belongs to the owning verification record. Private storage/worker/scanner readiness, deployed cross-role exchange and installed Android/TalkBack acceptance remain release gates. Mobile video/document upload is outside this receive-only release.

## Backend contract revision — 2026-10-17

New upload/binding policy now allows PNG/JPG/JPEG/MP4 only with the image bounds above and explicit optional malware scanning. Deployed storage/processing and updated Flutter selection acceptance remain unverified by this documentation update. Historical media and all participant/role/relationship rules remain unchanged.

## Flutter policy adoption — 2026-10-26

New mobile chat selections accept JPEG/PNG only, at most 8,000,000 bytes inclusive, with 4,096-pixel edges and 8,000,000 pixels. The image-only composer keeps receive-only MP4/documents and authorized historical WebP/document reads; committed exact-send replay remains intact. Local verification is recorded in the owning platform-sync reference; deployed media exchange and installed-device acceptance remain open.
