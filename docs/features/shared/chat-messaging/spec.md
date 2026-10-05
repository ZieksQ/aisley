# Shared Chat Messaging UI/UX

## WHAT

- Govern messaging presentation in Customer, Seller, and Logistics web apps, including their web conversations with Couriers. Courier mobile UI and external Flutter bundles are outside this web specification.
- Follow the [web design contract](../../../design.md) for brand, typography, spacing, shared components, accessibility, and themes. Customer remains light-only; Seller and Logistics support light and dark.
- Role contracts own participants, initiation, navigation, authorization, and lifecycle: [Customer](../../customer/chat-messaging/spec.md), [Seller](../../seller/chat-messaging/spec.md), and [Logistics](../../logistics/chat-messaging/specs.md). This document supplies their common web presentation rules.
- Current baseline is persisted plain-text chat, bounded polling, unread markers, and Customer-originated Product/Order context. Existing Customer–Shop context contains type, ID, label, and URL; it does not promise thumbnails, prices, attachments, or recipient read receipts.
- Rich commerce cards, Seller product sharing, and image attachments below are target enhancements. Their requirements apply when the owning role/API contract enables them; this document does not mark them implemented or override current text-only restrictions.
- Use Messenger as interaction inspiration and marketplace chat as commerce inspiration. Retain AISLEY branding, supported capabilities, and tenant boundaries.

---

## MUST

### Layout and visual hierarchy

- Use a dedicated inbox and conversation view within each role's established app shell and routes. Preserve separate Shop, Logistics, and Courier channels rather than merging their histories.
- At narrow widths show one pane at a time: inbox, then selected conversation. Back returns to the originating inbox with its position preserved; returning from a linked Product/Order should preserve the safe in-memory draft.
- At desktop widths show inbox beside conversation when both fit comfortably. Put optional commerce details in a collapsible side panel; on mobile use an accessible details dialog. Never squeeze the composer to retain a third pane.
- Keep the conversation header and composer visible within the available viewport; scroll history independently. The mobile keyboard must not cover Send, attachment errors, or the active input.
- Inbox rows show safe counterpart identity, latest message preview, activity time, and a numeric unread badge with accessible text. Distinguish selection, unread, and read-only states without color alone.
- Use the Shop's public identity for Customer–Shop headers; use safe Buyer labels for Sellers and role/context labels for operational conversations. Do not expose private Seller accounts, phone numbers, or email addresses.
- Place incoming bubbles left and outgoing bubbles right, with readable maximum widths and wrapping for long content. Group consecutive messages from the same sender without hiding sender/status information from assistive technology.
- Use neutral surfaces and restrained brand accents; preserve readable contrast in every supported theme. Do not copy Messenger blue or marketplace branding as a second visual system.
- Separate days with localized date labels and make message time available without hover alone. Display server timestamps in the viewer's locale; sequence determines message order.

### Composer, reading, and message status

- Provide a labeled multiline composer and visible Send button. Preserve the existing trimmed, nonempty, 2,000-character text limit until an owning contract explicitly adds image-only or card-only messages.
- On desktop, Enter sends and Shift+Enter inserts a newline; never submit during input-method composition. On touch keyboards preserve newline entry and use the explicit Send action.
- Hide unavailable feature actions rather than showing attachment, call, typing, presence, or read-receipt affordances that cannot work. Emoji entered as plain text needs no separate rich-message capability.
- Preserve draft text per conversation in memory while navigating within the authenticated session. Confirm before an action would discard unsent input; clear private drafts/history on logout, account change, or authorization loss.
- Distinguish Sending, Sent, Failed, and Unconfirmed states. Sent requires server persistence; an uncertain timeout keeps the original payload and idempotency key for an exact retry.
- Never infer Delivered or Seen from polling, elapsed time, the sender's read marker, or general notification state. Display recipient receipts only after an authorized API contract exposes their meaning and data.
- Disable new sends offline or when relationship eligibility ends; show a clear reason and recovery action where available. Retain only history that the current participant remains authorized to read.
- Scroll to new messages when the reader is already at the latest message. While reading older history, preserve position and offer a New messages control; loading older pages must also preserve the visible anchor.
- Mark read only for the active, visible conversation through its existing authorized read endpoint. Opening a hidden pane or another thread must not clear its unread count.
- Show checking-session, loading, empty inbox/thread, loading older history, validation, throttling, offline, unavailable, and access-denied states. A fetch failure must not appear as an empty inbox.
- Render message bodies as untrusted plain text. Use semantic lists, accessible sender/status labels, visible focus, and polite announcements for new activity without repeatedly reading the entire history.
- Dialogs and media viewers must support keyboard operation, Escape/Close, contained focus, and focus restoration. Incoming messages must never steal keyboard focus.

### Commerce context and product sharing

- Customer entry points remain Chat on Shop, Message Seller on Product, and Contact Seller on Order. Resolve the Shop and eligible relationship server-side; persist no empty conversation merely from opening chat.
- Reuse one Customer–Shop thread across Product/Order inquiries. Attach context to the intended message; a different product does not create a new recipient or thread.
- Show a removable Product/Order preview above the composer before sending. Removal affects the unsent message only; do not rewrite historical context or silently carry a prior product onto later replies.
- Render committed context beside its message with a clear View product or View order action. Retain a readable label-only card while richer authorized fields are unavailable.
- Target Product cards show a safe thumbnail, product name, selected variant when supplied, and current public price/currency when available. Label current price clearly; it is not a historical quote, stock reservation, or checkout commitment.
- Target Order cards show the authorized order reference, safe status, and only that Shop's relevant items. Price/status comes from the owning resource; chat text cannot update fulfillment, payments, refunds, or addresses.
- Seller Share product is a target action inside an existing Customer–Shop thread. Open a searchable picker limited to the Seller's own currently Buyer-visible catalog; preview one selection and require explicit Send.
- Buyer inquiry cards and Seller recommendations must resolve to the same Shop as the thread. Validate Product visibility and Customer/Shop Order ownership on send and on navigation; client-supplied IDs confer no authority.
- Do not grant Sellers arbitrary Buyer search, new unsolicited outreach, other-Shop recommendations, or access to a Buyer's unrelated orders through the picker or context panel.
- Archived, removed, or unauthorized context displays Product unavailable or Order unavailable with no inaccessible destination or leaked metadata. Preserve the surrounding authorized message and pagination.
- Operational conversations retain their task, pickup request, or Order header and eligibility rules. Do not place shopping recommendation controls in those channels or transfer history to a replacement Courier/organization.

### Image attachments — target phase

- Apply the complete [file and image upload policy](../../../references/file-upload-requirements.md) to chat images, including validation, generated storage keys, metadata, processing, errors, and access rules; do not fork its allowlist.
- Accept JPEG/JPG, PNG, and WebP only, strictly below 10 MiB (10,485,760 bytes) per image. Display accepted formats and the policy's 10 MB wording before selection; images at the exact byte boundary are rejected.
- Chat images are private participant content. Authorize upload, attachment, preview, and retrieval against the owning conversation or authorized prospective start context; never reuse public product-media access rules for uploaded chat photos.
- A chat photo does not become formal delivery proof, dispute evidence, or a product gallery asset automatically; those workflows retain their own submission and authorization rules.
- Client validation and local previews are convenience only. Laravel must verify size, extension, detected MIME/signature, and successful decoding; pending/rejected processing assets cannot be sent or delivered.
- Before Send, show each selected thumbnail with an accessible Remove action, transfer/processing state, and field-specific errors. Support file selection first; any paste/drop path must follow the same checks.
- Sending must not silently omit a failed selected image. Block submission until selected assets are ready or the user removes them; preserve safe text and allow an explicit retry after recoverable failures.
- Keep upload completion distinct from message persistence. Freeze the intended payload after an uncertain send and reconcile the same message; retries must not produce duplicate bubbles or repeated attachments.
- Render authorized images within bounded message previews preserving aspect ratio; open a keyboard-accessible viewer on selection. Show explicit unavailable/retry placeholders without breaking the message layout.
- Deliver through authorized endpoints or short-lived signed URLs; do not store expiring URLs as message content or expose raw storage paths. Clear temporary previews and revoke browser object URLs when no longer needed.
- Before activation, the owning implementation spec must settle image count per message, aggregate request limits, image-only sends, unreferenced-upload cleanup, retention, and cross-client compatibility. Current APIs continue rejecting attachments until that contract exists.

### Privacy and role boundaries

- Enforce Sanctum, role, approval, account, and relationship gates on every server operation. A disabled control supplements server authorization; it cannot replace it.
- Keep Shop, Logistics organization, task, and participant isolation across inboxes, linked resources, attachments, and caches. Losing access clears forbidden private state immediately.
- Admin has no automatic private-chat access. Reporting, moderation review, retention/deletion, and exceptional access require their own approved contract.
- Keep private bodies and drafts out of persistent browser storage, public caches, analytics, and routine logs. Use safe operational IDs and outcomes for diagnostics.

---

## HOW

### Adoption and interfaces

- Apply this guide as existing web chat screens are changed; a documentation update does not certify current visual compliance. Preserve current role routes, separate channel identities, and existing API behavior.
- Reuse compatible `@aisley/ui` primitives and established theme tokens. Keep role navigation/API clients separate; share presentation components only where their responsibilities and consumers are compatible.
- Keep pages focused on composition; place inbox rows, history, composer, context cards, picker, and media viewer in cohesive components. Keep request/retry/read state in hooks or services and API parsing in typed clients.
- Preserve bounded foreground polling, focus/reconnect refresh, cursor pagination, server sequence ordering, and message-ID reconciliation. No new realtime service or library is required by this specification.
- Rich cards need additive, role-safe context fields beyond today's type/ID/label/URL. Seller product sharing needs authorized selection/send support; attachments need a validated private asset lifecycle. Define these in the owning implementation specs before changing public DTOs or accepting new payloads.
- Hide unsupported controls until server and consuming clients are ready. If a future change affects external Buyer/Courier contracts, update only the affected canonical and mobile documentation together at that time.

### Future suggestions — not enabled upload formats

| Capability | Suggested format/experience | Required policy before implementation |
| --- | --- | --- |
| Video | MP4 (`.mp4`, `video/mp4`); poster, explicit play/pause, no autoplay | Approved codecs, duration/size limits, content inspection, processing/transcoding, private delivery, accessible text alternative |
| Audio | MP3 (`.mp3`, `audio/mpeg`); duration and explicit playback controls | Duration/size limits, actual audio validation, private delivery, accessible transcript/caption approach; recording needs separate microphone consent UX |
| Documents | Formats listed below; show filename, format, size, and explicit download | Define per-format size limits, content validation, scan/quarantine, safe download headers, private delivery, and retention; inspect packaged formats within resource bounds and render any text preview as untrusted plain text |

Document formats proposed for future chat attachments:

| Extension | Format |
| --- | --- |
| `.pdf` | PDF |
| `.docx` | Microsoft Word |
| `.xlsx` | Excel |
| `.pptx` | PowerPoint |
| `.odt` | OpenDocument Text |
| `.ods` | OpenDocument Spreadsheet |
| `.odp` | OpenDocument Presentation |
| `.txt` | Plain text |
| `.csv` | CSV |

- The image policy does not authorize any of these formats. Keep MP4, MP3, and document selection disabled until separate approved policies and role contracts exist; renaming a file must never bypass validation. Legacy Office and macro-enabled formats remain outside the proposed list.
- Consider Seller saved replies, participant-scoped conversation search, and reply-to-message references after core chat is stable. Each requires its own scope, authorization, accessibility, and acceptance criteria.
- Read receipts, typing/presence, mute/report, and retention controls remain separate product decisions; borrowing Messenger presentation does not promise its feature set or end-to-end encryption.

### Acceptance scenarios for future implementation

- [ ] At 390px, 768px, and 1280px, inbox/thread navigation, long content, keyboard-open composer, dialogs, and context cards remain usable without page-wide horizontal scrolling; verify Customer light and dashboard light/dark themes.
- [ ] Keyboard and screen-reader users can send, insert newlines, remove context, navigate history, and close viewers; input-method composition never triggers an unintended send.
- [ ] Incoming messages and older-history loads preserve reading position/focus; only the visible active thread advances authorized unread state.
- [ ] Repeated Product/Order entry reuses the correct Shop thread; Seller sharing rejects invisible/cross-Shop products and never exposes unrelated Buyer orders.
- [ ] Missing Product/Order/media context remains readable as a safe placeholder; operational channels retain correct task identity and read-only states.
- [ ] Loading, empty, offline, validation, 401/403/404, conflict, throttling, and timeout states give truthful feedback; exact retry after response loss creates no duplicate message or attachment.
- [ ] Valid allowed images below the byte limit work after media activation; exact-limit, corrupt, spoofed, and unlisted files fail server validation with recoverable UI errors.
- [ ] Private attachments cannot be fetched or reused by another participant/tenant outside the authorized thread; logout and authorization loss clear private views and drafts.
- [ ] Product cards, images, recipient receipts, and future formats appear only for implemented capabilities; text-only consumers remain compatible during staged adoption.
- Record actual backend/browser/type/lint/build checks with the implementation. Leave these scenarios unchecked until verified; this specification alone supplies no application or Flutter test evidence.

### Reference patterns

- [Meta: Messenger photos and read-receipt controls](https://about.fb.com/news/2023/12/default-end-to-end-encryption-on-messenger/) informs familiar media viewing and truthful receipt presentation. AISLEY's choices above are recommendations, not a claim of Messenger feature/security parity.
- [Shopee Seller Education: Webchat User Guide](https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/c467b10191494f4269ffd462f9a7ddcb/Webchat%20User%20Guide.pdf), especially product sharing and order management, supports commerce-linked chat. This historical guide is pattern evidence, not a guarantee of today's Shopee UI or limits.
- [Lazada's official app listing](https://play.google.com/store/apps/details?id=com.lazada.android&hl=en) describes direct seller chat. Detailed AISLEY product-card and tenancy rules are project requirements, not inferred Lazada internals.

### Web adoption record (2026-10-05)

- `@aisley/chat-ui` now supplies the shared inbox, conversation history, and composer across Customer–Shop, Customer–Courier, Customer–Logistics, Seller–Shop, Seller–Courier, Seller–Logistics, and Logistics operational chat. The role apps retain their existing routes, API clients, authorization, and separate channel identities. Product/Order context stays label-only or links to its existing route; this rollout adds no rich cards, attachments, receipts, or backend/mobile capability.
- ESLint/Oxlint and TypeScript checks passed for all three web apps; Seller and Logistics production builds passed. The mocked Seller Courier Chromium smoke passed at 390, 768, and 1280px in both dashboard themes, covering empty/eligible entry, exact first-send retry, history paging, desktop Enter-to-send, mobile newline preservation, read-only/access-denied states, offline, validation, and throttling. Confirmed 409/422/429 rejections preserve editable text without claiming delivery uncertainty; uncertain transport/server outcomes retain the original locked payload and key. The Customer production build could not complete because Next.js could not fetch its existing Geist fonts from Google Fonts in the restricted network environment; Customer browser smoke was not run. Existing large-chunk warnings remain in the Seller and Logistics builds.
