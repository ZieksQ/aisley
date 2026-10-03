# Flutter file uploads: Android APK and local web-server

## WHAT

- This is Flutter-client implementation guidance for the same Courier app on Android and at `http://localhost:8765` through `flutter run -d web-server --web-hostname localhost --web-port 8765`. It does not authorize a separate web UI or a production browser release.
- Scope of the implemented Flutter transport: registration evidence (`government_id`, `vehicle_registration`), account profile photo (`photo`), independent vehicle documents (`file` for each `{kind}`), and private final-mile photo POD (`photo`). POD uses dedicated rear-camera still capture on Android and file selection elsewhere; signature proof remains deferred.
- The Laravel upload endpoints and [shared image policy](references/file-upload-requirements.md) are unchanged. The server remains authoritative for ownership, MIME/signature/decode, the strict under-10-MiB limit, persistence, and private delivery.
- Current client status: `ApiClient.postMultipart` uses a shared platform-safe adapter. Android/native targets preserve the readable-path `MultipartFile.fromPath` branch, while web-server uses bounded selected bytes with `MultipartFile.fromBytes`. Browser and installed-APK runtime/CORS/camera acceptance has not yet been verified, so build success is not treated as full support.

## MUST

- Preserve the working Android APK path and its multipart field names, bearer handling, idempotency/revision behavior, validation, progress/cancel/retry states, and private-image reads while adding browser support. Do not add a package without approval.
- Reuse the existing `file_selector` selection for uploads and browser POD fallback; Android POD may use the approved `camera` package's captured `XFile`. A web `XFile.path` is not an OS-readable file path; use selected file bytes or a supported stream, its display `name`, and its measured `length()`. Do not pass a browser path or blob URL to `MultipartFile.fromPath`.
- Keep one shared upload request contract and endpoint mapping. Native may retain its tested path-based multipart implementation behind a platform-safe adapter; web must create a multipart file from bounded selected bytes (for example, `MultipartFile.fromBytes` with the original display filename). Do not import `dart:io` into a web-compiled module.
- Preserve exact request parts: registration has `government_id` and `vehicle_registration` plus the existing text/nested address fields; profile photo has `photo`; vehicle document replacement has `file` and `expected_revision`, with the existing UUID `Idempotency-Key` and authorized `{kind}` route. Do not substitute JSON/Base64 or change the backend API.
- Before reading into memory, reject empty, unreadable, unsupported, or at-least-10,485,760-byte files; recheck byte length and image signature after reading. Pickers, extensions, filenames, and browser MIME values are only client feedback, never authorization or server validation. Avoid retaining extra full-size copies; discard selected bytes/previews on cancel, logout, account denial, or replacement.
- Send `Authorization: Bearer <token>` only on protected uploads and private reads. Registration stays public and sends no bearer token. Do not use browser cookies, plaintext token storage, raw storage paths, base64 evidence in JSON, browser blob URLs as server identity, or logging of tokens/file bytes/private URLs.
- Treat selection cancellation, permission/read failure, local validation, upload cancellation, `401`, `403`, field-addressable `422`, `409` for vehicle revision/idempotency, `429`, timeout/offline, CORS/preflight rejection, and server/storage failure as distinct states. A browser CORS failure is not a Laravel validation result.
- Never report success from local preview or upload progress. On an uncertain registration result, do not blindly resubmit; on photo or vehicle replacement, use the existing refetch/idempotency contract before retrying. A cancelled browser request may still have reached the server.

## HOW

### Client handoff

- Keep upload creation centralized in `lib/core/networking/api_client.dart`, not in screens. Adapt the current `filePaths`-only input to a platform-neutral selected-file representation that keeps bytes or a readable source, filename, measured size, and optional native path without treating a web path as a disk path.
- Registration selections retain their validated bytes, filename, size, and optional native path through submission so both browser files can be sent. Account and vehicle selections hand their already validated bytes, filename, and optional native path to the same shared transport; browser paths are never sent to `fromPath`.
- Build `http.MultipartRequest` with the same fields and headers on both targets. Let `package:http` set the multipart boundary; do not hard-code `Content-Type: multipart/form-data`. Use a tested native path branch or byte-based part on Android, and a byte-based part on web. Keep the required part names and filenames stable.
- The fixed localhost Flutter origin and API origin may differ by port. The Laravel API must allow the exact `http://localhost:8765` origin for the necessary `POST` uploads, private `GET` previews, and `OPTIONS` preflight, including `Authorization` and `Idempotency-Key` when sent. Do not bypass CORS with browser security flags, a secret-bearing frontend proxy, or disabled authentication. CORS configuration belongs to the backend owner; record any missing configuration as a contract/deployment gap.
- Keep private photo and OR/CR previews in memory from authenticated API reads, and clear them on session change. Do not put bearer tokens in image URLs or use unauthenticated browser image loading for protected assets.

### Verification before calling web uploads supported

- Unit/contract tests cover both native-path and web-bytes multipart assembly, exact part names/fields/headers, two-file registration, filename/MIME hints, strict byte boundary, invalid/corrupt/empty selections, and zero file bytes in logs.
- Test `flutter build web`, `flutter analyze`, and relevant Flutter tests; build an Android release APK and repeat registration, profile/POD upload/replacement/private read/removal, rear-camera capture, and independent OR/CR replacement/private read on an installed device. Build success alone does not prove upload behavior.
- In a real browser at the fixed localhost origin, test the same upload flows against a reachable development Laravel API with test accounts, including CORS preflight, authenticated private reads, cancellation, 401/403/409/422/429, timeout, retry/reconciliation, and cleanup. Do not mark web support complete until both browser and installed-APK checks pass.
- Record the backend API commit/version, exact browser origin, test results, and any CORS gap in `docs/PROGRESS.md`; never include credentials or private evidence in that log.

Sources: [Flutter `file_selector` package](https://pub.dev/packages/file_selector), [`XFile` API](https://pub.dev/documentation/cross_file/latest/cross_file/XFile-class.html), [`MultipartFile.fromPath` platform limit](https://pub.dev/documentation/http/latest/http/MultipartFile/fromPath.html), [`MultipartRequest` API](https://pub.dev/documentation/http/latest/http/MultipartRequest-class.html), and [browser CORS header rules](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Headers).
