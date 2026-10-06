# Shared Chat Messaging UI/UX

## WHAT

- Govern messaging presentation in Customer, Seller, and Logistics web apps, including their web conversations with Couriers. Courier mobile UI and external Flutter bundles are outside this web specification.
- Follow the [web design contract](../../../design.md) for brand, typography, spacing, shared components, accessibility, and themes. Customer remains light-only; Seller and Logistics support light and dark.
- Role contracts own participants, initiation, navigation, authorization, and lifecycle: [Customer](../../customer/chat-messaging/spec.md), [Seller](../../seller/chat-messaging/spec.md), and [Logistics](../../logistics/chat-messaging/specs.md). This document supplies their common web presentation rules.
- Current baseline is persisted chat with bounded polling, unread markers, Customer-originated Product/Order context, and runtime-gated private attachments under the [Chat Media contract](../chat-media/spec.md). Existing Customer–Shop commerce context contains type, ID, label, and URL; it does not promise commerce thumbnails/prices or recipient read receipts.
- Rich commerce cards and Seller product sharing remain target enhancements. Private image/video/document attachments are implemented behind runtime readiness; see the owning media contract and actual verification log.
- Use Messenger as interaction inspiration and marketplace chat as commerce inspiration. Use Shopee/Lazada attachment selection and explicit-send patterns under the media contract; retain AISLEY branding, supported capabilities and tenant boundaries.

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

- Provide a labeled multiline composer and visible Send button. Preserve the 2,000-character trimmed caption limit. Require text or ready attachments; attachment-only sends are supported by the media contract.
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

### Private attachments — implemented with runtime gating

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
- The [Chat Media specification](../chat-media/spec.md) owns formats, count/aggregate limits, attachment-only sends, scanning, cleanup, retention and compatibility. Attach controls appear only when media runtime capabilities are ready.

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
- Rich cards need additive, role-safe context fields beyond today's type/ID/label/URL. Seller product sharing needs authorized selection/send support; attachments use the implemented private lifecycle defined in the media contract.
- Hide unsupported controls until server and consuming clients are ready. If a future change affects external Buyer/Courier contracts, update only the affected canonical and mobile documentation together at that time.

### Future suggestions and implemented media

| Capability | Suggested format/experience | Required policy before implementation |
| --- | --- | --- |
| Video | MP4 with poster and explicit controls; no autoplay | Implemented under the [media contract](../chat-media/spec.md); no automatic transcoding |
| Audio | MP3 (`.mp3`, `audio/mpeg`); duration and explicit playback controls | Duration/size limits, actual audio validation, private delivery, accessible transcript/caption approach; recording needs separate microphone consent UX |
| Documents | Formats below; filename, type, size and Download | Implemented under the media contract with content inspection, scanning and private download |

Document formats supported when media is enabled:

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

- The chat media policy separately authorizes MP4 and the listed documents; it does not broaden image-upload formats elsewhere. MP3/audio remains deferred. Renaming files cannot bypass validation; legacy and macro-enabled Office formats remain excluded.
- Consider Seller saved replies, participant-scoped conversation search, and reply-to-message references after core chat is stable. Each requires its own scope, authorization, accessibility, and acceptance criteria.
- Read receipts, typing/presence, mute/report, and retention controls remain separate product decisions; borrowing Messenger presentation does not promise its feature set or end-to-end encryption.

### Acceptance scenarios and verification

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

## Dedicated web chat notifications — 2026-10-06

- Customer, Seller, and Logistics headers have a separate Chat messages icon, total unread incoming-message badge (`99+` visually), and accessible dropdown. First messages and subsequent replies, including attachment-only messages, participate automatically after commit. No general notification rows are created.
- Preview the five most recently active authorized conversations with unread incoming messages, ordered by activity then UUID. Show safe counterpart, channel, latest plain-text preview, activity time, and unread count; totals include all authorized conversations beyond the preview limit. Separate role/channel inboxes and their history routes remain authoritative.
- Opening the dropdown reads no messages. Selecting a preview opens its owning thread; only the active visible thread can advance its existing read marker. Successful read acknowledgments immediately refresh the header count. Outgoing messages and exact send retries add no recipient duplicates.
- Poll once every 15 seconds while online and foregrounded, refresh on focus/visibility/reconnect and dropdown opening, and serialize requests with a 15-second deadline. Preserve the last known values with explicit refresh-error feedback; distinguish loading, empty, offline, and access-denied states. Clear private previews on logout, account switch, or authorization loss, and ignore obsolete in-flight responses.
- Dropdowns fit the viewport at 390/768/1280px, support normal links/Tab navigation, Escape/Close with focus restoration and outside dismissal, and preserve Customer light-only plus Seller/Logistics light/dark presentation. This is foreground in-app polling, without sound, popup, realtime transport, email, or background push.

### Additive web API contract

`GET /api/v1/{customer|seller|logistics}/chat-notifications` requires the owning role's existing Sanctum, active-account/approval, and policy-consent middleware. Customer retains its overall API rate limit. Return private `no-store` JSON:

```json
{
  "data": [{
    "id": "<conversation-uuid>",
    "kind": "customer_shop",
    "counterparty_label": "Shop name",
    "last_message_preview": "Hello",
    "last_message_at": "2026-10-06T01:00:00Z",
    "unread_count": 1
  }],
  "meta": { "unread_count": 1 }
}
```

The endpoint accepts no recipient selector and returns at most five previews. Kinds are existing conversation kinds; each role receives only its existing authorized channels. Totals derive from committed incoming messages above the current participant marker within existing service scopes, including authorized read-only history. No new schema, read endpoint, or message-send contract is introduced. Admin and external Courier clients do not receive a new endpoint or UI; existing Buyer/Courier contracts remain compatible.
