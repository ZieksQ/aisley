# Phase 4 implementation and verification

Date: 2026-10-04. Branch: `feature/buyer-phase-4-communication`, created from
`feature/buyer-phase-3-commerce`. Adopted local Laravel contract baseline:
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`. Running localhost backend revision
is unidentified. No backend, database, server configuration, dependency or other
checkout changed. Existing Flutter 3.47.2 / Dart 3.13.2 pins remain unchanged.

## Implemented scope

- Independent Shop, Logistics and Courier DTOs, repositories, inbox/thread
  controllers and read markers; presentation widgets alone are shared. Shop uses
  `items/next_cursor` and read `sequence`; operations use `data/meta` and
  `last_read_sequence`. Laravel supplies participants and `send_allowed`.
- Account inbox entries, Shop/Product/owned Order context entries, notifications,
  support forms/details and protected Order-item Review composer. Public Product
  questions/reviews remain available to guests. Protected routes and authentication
  returns validate UUIDs and supported context queries.
- Opening a composer creates no conversation. Courier entry reads the documented
  Order-context endpoint. First-message/reply uncertainty freezes the body, context
  and UUID; deliberate exact retry accepts documented replay outcomes. Definitive
  conflicts refresh before reviewed changes; unresolved prior uncertainty never
  silently creates a replacement key. Ended authorized history stays readable;
  deliberate new-contact actions clear drafts/transcripts before a new relationship.
- Foreground visible-route reads poll every 15 seconds without overlapping controller
  requests. Offline/background pauses polling; focus, foreground return and explicit
  refresh permit read recovery. Refresh merges UUIDs/sequences and preserves older
  cursors through gaps; repeated/no-progress pages stop. Incoming cues leave focus
  and old-history scroll alone; only deliberate View navigation moves to new content.
  Serialized monotonic reads apply to displayed committed rows.
- Notifications support all/read/unread pagination, detail, post-display idempotent
  read and validated Product/Q&A/review/Shop/owned Order destinations. Unsupported
  targets remain readable in notification detail. Promotion preferences reuse the
  existing Account implementation; no global badge, read-all or push registration.
- Public paginated Q&A renders official Seller answers. Asking submits only
  `question` with plain-text/newline/scalar-length validation and frozen UUID replay.
  The public screen follows identity/consent changes without retaining private input.
- Public reviews use server aggregates, verified-purchase labels, photos and published
  Seller responses. Creation sends only `rating/body`, without a replay header;
  uncertain text retains identical-content retry and changed-content conflict state.
  Order-item guidance comes from `canReview/reviewId`; Laravel remains authoritative.
- Photos upload separately only after confirmed Review creation: multipart `image`,
  JPEG/PNG/WebP, strictly under 10 MiB, up to five, edges up to 8,000 pixels and
  40 million pixels. Committed photos survive independent failures. Uncertain uploads
  discard previews and require canonical public Review pagination before another
  deliberate selection/upload; there is no automatic byte replay. Interrupted native
  picker recovery requires reselection because original identity/form is unproven.
- Support inbox filters use cursor pagination; Description maps to `body` and create
  includes only `subject/category/body`. Replies freeze body/revision/key, stale
  revision refresh precedes reviewed new intent, and server-confirmed replies may
  reopen resolved tickets. Reply/status/assignment events render distinctly in
  chronological order. Ticket reads and history traversal remain independent.
- Session composition keeps unresolved supported requests in memory across navigation.
  Identity loss/account switch clears projections, drafts, previews, keys and owned
  controllers; late successes/errors cannot repopulate them. Consent clears private
  views while retaining minimal unresolved same-identity intent, including interrupted
  in-flight requests. Resolving consent never automatically replays writes.

## Executed checks

| Command/check | Result and scope |
| --- | --- |
| `dart format --output=none --set-exit-if-changed lib test` | Passed; 185 files, zero changes. |
| `flutter analyze --no-pub` | Passed; no issues. |
| `flutter test --no-pub` | 198 unit/widget tests passed; 42 opt-in live tests skipped. |
| `CHROME_EXECUTABLE=/usr/bin/chromium flutter test --no-pub --platform chrome test/web` | Ten passed; communication UUID JSON, independent reads and multipart Review bytes cross Fetch exactly once. |
| `BUYER_LIVE_API=1 flutter test --no-pub test/live` | 42 public/denial/preflight checks passed at localhost:8000; no authenticated writes. |
| `flutter build web --no-pub` with public HTTPS placeholder defines | Passed; Wasm dry run also compiled. |
| `flutter build apk --release --no-pub` with the same defines | Passed; APK is 60.7 MB. |
| Exact port-8766 web run and `python3 tool/browser_smoke.py` | Passed in isolated Chromium: public Q&A/reviews, private communication guards, prior public screens, policies, actual preflights and invalid-bearer denial. |
| Documentation/spec lengths, privacy and diff whitespace | Passed; 624 local links, all 22 Customer specs within 200–230 lines, Progress 73 lines. Broad live/device criteria remain unchecked. |

Release defines are public, nonfunctional `https://api.example.invalid` and
`https://shop.example.invalid`. Existing debug signing remains; successful builds
establish compilation, not distribution readiness. Browser run used
`flutter run -d web-server --web-port 8766 --dart-define=API_BASE_URL=http://127.0.0.1:8000`;
a final-source restart used the same command with `--no-pub`.

Synthetic coverage includes exact API prefixes/methods/envelopes/casing/nullability,
mutation headers/bodies, separate channel/read state, lost first sends and exact
replay, duplicate prevention, relationship changes, consent during requests, identity
loss and obsolete responses, malformed success, HTTP 401/403/404/409/422/429/500,
offline/timeout, repeated/no-progress cursors and separately failed paging. Contribution
coverage includes Unicode/plain text, identical Review replay, changed-content conflict,
encoded image/size/filename limits, partial/uncertain uploads, canonical page traversal,
interrupted upload consent and obsolete picker selection. Support covers lost creation,
stale revision review/new key and chronological cursor history. Widget coverage includes
320px doubled text, short keyboard forms, validation focus, Back/discard, read-only
threads, polling lifecycle/focus recovery, post-display notification reads, guest guards,
public session transitions and message-arrival focus/scroll preservation.

The initial live run exposed doubled API path slashes in the new repositories; they
were corrected to the established relative-path convention and exact-path regression
checks added. The corrected full live suite passed. Browser smoke was also rerun after
waiting for the initial server compilation; the final ready-server check passed.
These were client corrections, not backend contract conflicts.

## Remaining acceptance gates

- Controlled authenticated Customer–Seller/Logistics/Courier exchanges, actual Order
  ownership/custody/reassignment/terminal transitions, Review eligibility/aggregates,
  official answers/responses, ticket reopening/assignment/read state and older live
  ticket cursor traversal. Public reads and denial checks cannot establish these.
- Installed Android/TalkBack, native picker and secure-storage permission/runtime,
  actual image selection/dimensions/uploads and private media authorization, device
  foreground/network/back/keyboard and counterpart delivery. Mocks/builds do not
  replace these checks or certify server concurrency.
- G04 browser Retry-After exposure, G12 process-restart recovery (requests remain
  memory-only), G15 upload hardening, G16 retention/abuse/two-worker races and G22
  controlled live support traversal. Prior Phase 1–3 gates also remain open.
- Native push/background delivery, global notification count/read-all, support
  attachments/linked records/Admin controls and other deferred workflows remain
  unavailable. No CORS/backend changes or real credentials/private uploads were used.
