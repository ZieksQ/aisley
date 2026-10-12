# Buyer uploads on Android and local web

Flutter transport and profile/Review workflows implemented; [Phase 4 evidence](references/phase-4-verification.md) records partial acceptance. Existing Customer endpoints accept multipart `photo` for profile and `image` for review media. Registration currently has no Customer ID/evidence upload. Current Laravel Shop/Logistics/Courier chat supports [private media](api/chat-media.md); Buyer image upload/viewing and received MP4/documents are implemented locally; live/device acceptance remains open (G27). Product questions and support tickets remain text-only. [Upload policy](references/file-upload-requirements.md) owns formats/limits/privacy.

Use one platform-neutral selected-file model with display filename, measured length and bytes/stream or readable native path. Android may use a tested native path adapter; browser `XFile.path` is not an OS file. Read bounded selected bytes or a supported stream for browser multipart. Isolate `dart:io` through conditional adapters. `XFile` exposes length/read APIs for portable handling. [XFile API](https://pub.dev/documentation/cross_file/latest/cross_file/XFile-class.html)

For profile/review uploads, validate early before retaining large buffers: reject empty/unreadable or unlisted JPEG/JPG/PNG/WebP files and size at least 10,485,760 bytes. Recheck length/type hints after reading; Laravel remains authoritative for MIME/signature/decoding/extension/ownership. Keep accurate filenames for server extension validation; no double-extension rename bypass. Unsupported Android HEIC selections require clear guidance or an explicitly approved conversion workflow; never relabel bytes.

Let the HTTP multipart client create its boundary. Preserve exact part names and bearer header; no Base64 JSON, blob URL, raw path or signed storage secret as server identity. Show transfer/persistence feedback and only announce success after the API confirms. Clear selected bytes and previews on cancel, replacement, logout/account loss, and disposal. Selection cancel is an ordinary state, while permission/read failure needs actionable feedback.

Private avatar previews fetch bytes through authenticated `GET /api/v1/customer/account/profile-photo` and render in-memory images; browser image tags/plain network URLs cannot add bearer authorization. Keep bearer out of URLs. Accept only trusted API-origin private URLs and avoid shared disk/browser caches. Public review images use their safe visibility-gated delivery URLs; do not assume Courier POD is available to Buyer or expose registration evidence.

Profile replacement/removal updates the account projection and rereads its authenticated image. A timeout/cancel can still have committed; refetch before another upload. Review text creation and each photo are separate writes: preserve the canonical Review after partial image failure, track each outcome, and reconcile uncertain uploads through the review projection. Current image APIs do not supply durable idempotency/replay; blindly retrying can duplicate a photo or consume the limit. Current review image limit is 5, edges 8,000 and total pixels 40,000,000 under config; profile does not currently enforce those numeric dimension limits. Profile inspection uses getimagesize and MIME/extension checks; resource-bounded full decoding/rewrite is not demonstrated by that service. Do not claim all shared image-processing requirements are already enforced.

Test real API preflight/upload/private-read at `http://localhost:8766`; backend CORS changes are required as documented in [architecture](architecture.md). Differentiate CORS/browser failure from Laravel `422`, throttle, session/consent loss and storage failure. Test both web bytes and Android path/bytes branches, exact field names, accepted types/byte boundary, progress/cancel, partial success, stale session cleanup and installed-device picker permission. A browser/web build and release APK build do not establish live acceptance. Synthetic byte/header/limit/partial-upload tests and Chromium multipart transport pass; real uploads and installed-native picker acceptance remain pending.

## Selected fresh-project transport

Use image_picker1.2.0 XFile and Dio5.9.0 FormData/MultipartFile through injected adapters from [setup](setup.md). Construct a fresh FormData/byte stream for each deliberate upload; never reuse an exhausted multipart stream or automatically replay an uncertain write. Native retrieveLostData is drained once on Android. Its files lack proven Customer/form context, so they are discarded and the verified form asks for a deliberate new selection; web never invokes native recovery. Profile mutation envelope is message/account/customer; review-image success is201 data ReviewPhoto. GET profile bytes requires private bearer transport and missing photo404. [Operations](api/operations.md) and [examples](api/examples/README.md) provide synthetic success/validation/denial/partial-recovery inputs. These choices are documented, not executed or device accepted.

## Chat media adoption boundary — G27

Profile/Review image rules above retain their existing fields and uncertain-upload behavior.
Chat media uses the separate [media contract](api/chat-media.md): images, MP4 and allow-listed
documents, readiness processing, an upload UUID key and explicit binding on Send. Its exact
upload replay does not apply to profile/Review writes. Browser selection requires bytes/streams;
private content and previews need authenticated API reads, account cleanup and scoped memory.
No chat file picker, image/video/document renderer or attachment action is enabled by this sync.

## Upload recovery — 2026-10-10

Profile photo writes now live for the verified session across navigation. Cancel upload cancels
only its request, releases the selected preview and keeps replacement/removal blocked until
current server state is read. Selection dismissal preserves an existing valid selection;
Remove selection explicitly discards it. Native interruption/permission/read failures have
separate feedback; no recovered file is restored or uploaded automatically.

The shared picker measures metadata before reading a bounded XFile stream, rechecks actual
length, matching file signature/extension/MIME, and decodes a small preview to reject corrupt
content. Review selection checks PNG/JPEG/WebP header dimensions before preview decoding;
encoded ImageDescriptor dimension getters are unavailable on web. Its documented edge/pixel
limits apply on both platforms. These client
checks do not close G15 server decoding/rewrite/retention gaps.

Profile reconciliation reads the current account projection before its current authenticated
photo URL. Only authorized missing-photo results confirm absence; account/resource denial and
failed reads keep unresolved uploads blocked. A confirmed upload remains saved when its preview
refresh fails. Review reconciliation preserves committed text/photos, traverses the canonical
Review pages and stops obsolete scans after identity loss. Cancellation, malformed success and
lost responses never replay image writes. See [upload recovery evidence](references/upload-recovery-verification.md).
