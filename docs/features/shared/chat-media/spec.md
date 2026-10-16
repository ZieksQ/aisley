# Private Chat Media Attachments

## WHAT

- Extend existing Customer–Shop, Customer–Logistics, Seller–Logistics, Logistics–Courier, Courier–Seller and Courier–Customer conversations with private images and videos. Previously committed documents remain readable.
- Apply to Customer, Seller and Logistics web chat, and the Courier/mobile API contracts. Admin private chat and support tickets are excluded.
- Reuse the shared messaging store, Sanctum, current participants, approval gates and relationship eligibility. A chat attachment never changes an Order or becomes formal POD/dispute evidence automatically.
- Follow the [shared chat guide](../chat-messaging/spec.md), [design contract](../../../design.md) and [upload policy](../../../references/file-upload-requirements.md).
- Web appearance follows `docs/design.md`; the shared chat guide owns messaging interactions. Preserve required file states, private delivery, accessible controls, and authorization boundaries.
- Use [Shopee's attachment selection and explicit Send](https://help.shopee.sg/portal/4/article/81973-%5BChat%5D-How-do-I-send-images/videos-via-Chat) and [Lazada's contextual image sharing](https://pages.lazada.com.ph/wow/i/ph/PHCampaign/im-launch%3Fhybrid%3D1) as interaction references; limits below are AISLEY choices.
- External Flutter adoption must be recorded separately from Laravel/web implementation.

---

## MUST

### Formats and limits

- New images: JPEG/JPG and PNG, at most 8,000,000 bytes (inclusive), following the shared image policy's format and inspection rules.
- New videos: MP4, at most 8,000,000 bytes (inclusive) and 180 seconds; H.264 video, optional AAC audio. No automatic transcoding in this release.
- Only `.jpg`, `.jpeg`, `.png` and `.mp4` may be newly uploaded or bound. Reject WebP, documents, audio and every other extension. Historical committed files keep authorized delivery and exact message replay.
- At most five attachments; every file is at most 8,000,000 bytes (8 MB), inclusive. The existing 50 MiB aggregate ceiling remains for contract compatibility; five new files can total at most 40,000,000 bytes.
- The 8,000,000-byte image/video cap applies to every new upload, rewrite, and binding to a new message. A ready but unbound historical image/video larger than this cannot be attached to a new message. Do not reject already committed historical media on retrieval or when replaying that exact already-committed message; this grandfathering does not permit a new binding or changed retry payload.
- Filename, extension and browser MIME are hints. Verify actual content server-side; reject mismatched/double extensions, malformed content and incompatible codecs.
- Decode and rewrite images without source metadata, with bounds of 4,096 pixels per edge and 8,000,000 pixels total for the small-VM deployment. Inspect video duration, streams and codecs with ffprobe; generate posters with single-threaded FFmpeg.
- `CHAT_MEDIA_SCAN_ENABLED=false` explicitly permits processing without malware scanning for this school deployment. Size/type/signature/decoding/codec checks remain mandatory. Missing configuration defaults scanning on. When enabled, ClamAV must pass before readiness; outages and scan failures fail closed. This opt-out does not claim malware protection.

### Upload and message lifecycle

- File selection shows previews/removable filename cards and each file's uploading, checking, ready, or error state. Place accepted formats/limits in a keyboard-operable collapsed disclosure beside Attach so it is available before selection without taking permanent composer space.
- Upload one file per multipart request with a UUID Idempotency-Key. Scope it to an authorized existing conversation or a server-resolved prospective start context.
- Prospective uploads create no empty conversation. Server resolves actual participants, Shop, organization, hub and task; client IDs never grant authority.
- Return an attachment identifier and status; uploading alone does not send a message. Pending/rejected/failed files cannot be sent or retrieved.
- Permit an optional trimmed caption up to 2,000 characters. A send requires text or at least one ready attachment.
- Block Send until all selected files are ready or removed. Never silently omit a selected file.
- Start/reply carries ordered attachment_ids with the existing UUID send key. Revalidate ownership, relationship, scope, readiness, expiry, count and combined size under locks.
- Bind files and persist the message/activity atomically; each file belongs to one message. Exact retries return the original message, and a changed caption/file order/selection conflicts.
- Preserve historical text-only idempotency hashes. Attachment-only messages retain a string body with a readable fallback for older consumers.
- Caption, selected IDs and retry identity stay frozen after uncertain delivery. Reconcile the same request before composing another message.
- Keep drafts/files in memory only. Clear private state and revoke local blob URLs on logout/account change/authorization loss; no offline write queue.

### Private delivery and presentation

- Store file bytes on private configured storage, with server-generated keys; keep metadata and references in the database.
- Authorize every preview/download against current scoped history access. No Admin access, public URLs, raw disk paths, persisted signed URLs or cross-tenant reuse.
- Images show bounded aspect-preserving previews and a keyboard-accessible viewer. Videos show a poster and explicit controls without autoplay.
- Historical committed documents show safe filename, format, size and Download. Serve as attachments with safe Content-Disposition and nosniff; do not embed Office/PDF viewers.
- Video delivery supports byte ranges; stream storage content without loading whole videos into PHP memory.
- Ended threads retain authorized historical attachments. Replacement Couriers/organizations cannot inherit old media.
- Show recoverable unavailable/retry placeholders. Media loading must preserve focus and reading position.
- Web controls remain usable at 320/390/768/1440px and in a short viewport, Customer light regardless of OS preference and Seller/Logistics light/dark, with accessible labels, errors and viewer focus restoration.

### Retention and operations

- Delete expired, unbound uploads after 24 hours with locking that cannot race message binding or processing. Committed attachments follow existing message retention; no new historical purge.
- Processing uses a separate media queue and bounded concurrency. When scanning is enabled, scanner signatures must be maintained; failures have bounded retries and an explicit terminal error.
- Log safe IDs, status and timing only; no filenames, contents, private URLs or captions in routine operational logs.
- Upload throttling has its own named per-account counter, separate from chat starts/sends and polling. Existing overall API limits still apply.
- New uploads require explicit media enablement and runtime readiness. Existing text sends and committed media retrieval remain available when new uploads are disabled.

---

## HOW

### Backend and interfaces

- Add chat_attachments with UUID, uploader, immutable scope hash, optional conversation/message, generated disk/path, original safe filename, kind, detected MIME, byte size/checksum, image/video metadata, processing state/error and expiry/timestamps.
- Use additive migrations only; enum-like DB fields are strings with PHP enum casts. Retain the existing conversations/messages infrastructure.
- Add /api/v1/{customer|seller|logistics|courier}/chat-attachments endpoints: GET capabilities, POST upload, GET /{attachment} status, POST /{attachment}/retry, DELETE /{attachment} unbound removal, GET /{attachment}/content and /preview authorized delivery.
- Upload accepts file plus JSON context. Context contains conversation_id or channel and the existing start selectors; channel is shop, logistics, courier or operational. Role/channel combinations remain restricted to existing workflows.
- Extend start/send with attachment_ids and messages with attachments metadata. Omitted attachment_ids remains compatible with existing text requests.
- Message attachment DTO supplies id, kind, filename, mime_type, byte_size, width, height, duration_seconds and role-owned content_url/preview_url, never storage paths.
- Return private no-store responses. Preserve established 401/403/404/409/422/429 semantics; report file and attachment_ids validation at those fields.
- Form Requests own shape validation; existing messaging services own relationship checks; focused attachment services own upload, inspection, scan, bind and delivery.
- Use the dedicated private `azure_chat` disk in production and private local storage in development. `AZURE_CHAT_STORAGE_CONTAINER` defaults to `aisley-chat-media`; optional chat connection credentials otherwise reuse the existing Azure connection. Do not change the existing disk/container/prefix or move historical files. `chat:prepare-storage` creates only the separate container, rejects an existing public chat container without changing its ACL, and verifies read/write/delete. Use a dedicated queue worker; recovery redispatches stale pending work and cleanup removes abandoned files.
- Project images include FFmpeg/ffprobe and GD. The `chat-media` Docker profile starts one media worker with a 128 MiB PHP ceiling and a 192 MiB container ceiling. Production Docker has no ClamAV service, scanner profile, signature volume or scanner dependency; keep `CHAT_MEDIA_SCAN_ENABLED=false`. Optional scanning remains available through the separate local development Compose file.
- Existing PHP/Nginx request ceilings retain unrelated upload compatibility; the chat Request/service enforce exactly 8,000,000 bytes per file.

### Frontend and deployment

- Shared chat/media presentation, generic media clients, attachment state, and coordination now live in `packages/ui/src/chat`, exported through `@aisley/ui/chat`. Customer, Seller, and Logistics screens import this subpath; `@aisley/chat-ui` is a compatibility re-export facade. Keep role API origin/session/CSRF and navigation in each app, and leave unrelated feature packages in place.
- Adopt all seven existing web chat surfaces, including prospective first sends. Preserve current polling, context cards, unread and exact retry behavior.
- Deploy migration/backend before frontend activation. Keep media disabled until private storage, ffprobe and the media worker are ready, plus ClamAV when scanning is enabled.
- Do not install host packages or alter external services automatically. Configure approved tools through project deployment files and document local prerequisites.
- Start with private Hot-tier Blob storage; defer automatic transcoding, direct browser-to-Blob upload and storage tier changes.
- A 1 GiB VM with swap is not certified by these limits; measure peak memory and latency with representative uploads before activation. Budget separately for cumulative storage, download traffic, operations and worker/scanner compute. ClamAV recommends approximately 3–4 GiB RAM; the entire API/Postgres deployment needs additional capacity ([requirements](https://docs.clamav.net/)).
- Actual Azure charges depend on region, redundancy, operations and outbound traffic ([cost guidance](https://learn.microsoft.com/en-us/azure/storage/common/storage-plan-manage-costs)); do not publish a fabricated price estimate.

### Verification and documentation

- Test first sends/replies in every relationship, optional captions, attachment-only messages, legacy hashes/DTOs, ordering, pagination and unread.
- Test size/count/duration boundaries, allowed/removed types, content spoofing, corrupt images, codec mismatches, explicit scan opt-out and fail-closed scanner outages.
- Test participant/store isolation, changed assignments, historical reads, foreign asset reuse, range delivery, exact retries and bind/cleanup races on SQLite and PostgreSQL.
- Verify production media tools and real browser/API and Courier bearer exchanges separately from mocked checks.
- Run affected PHP formatting/tests and web lint/type/build plus responsive/themes, keyboard/focus and loading/offline/error checks.
- Update canonical role specs, schema, workflow/design/upload policy, setup/deployment and only affected Buyer/Courier portable contracts/examples.
- Preserve Flutter status until external client evidence proves adoption. Record actual verification and remaining release checks in app-wide PROGRESS.md.

## Implementation status — 2026-10-12

Laravel attachment lifecycle and all seven web chat surfaces are implemented with default-off activation. Canonical/portable contracts document the additive payloads with local Buyer/Courier image adoption. Tests cover SQLite and disposable PostgreSQL, real ClamAV, production web builds and connected Chromium plus scoped Courier/Customer bearer transport. See the app-wide [progress log](../../../PROGRESS.md) for actual checks and [deployment instructions](../../../../docker/README.md#private-chat-media) for operator activation. Buyer/Courier image selection/send and receive-only video/document consumption are implemented locally against the 2026-10-11 inclusive 8,000,000-byte image/video upload contract. See [G26 verification](verification.md) for bounded authenticated delivery, temporary playback/export lifecycle and actual checks. Mobile video/document upload, Azure production delivery, deployed exchange and installed-device acceptance remain open.

## Lightweight deployment revision — 2026-10-17

New uploads/bindings are PNG/JPG/JPEG/MP4 only, up to 8,000,000 bytes each. Production Docker omits ClamAV and uses explicit disabled scanning; optional local scanning remains available. The private Azure chat disk preserves existing storage. Historical committed media remains readable. Flutter implementation/adoption is unchanged; clients must remove WebP from new image selection and adopt the tighter image bounds. Azure and deployed/installed-device acceptance must be recorded separately from local tests.
