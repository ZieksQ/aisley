# Chat media verification

Run commands from the repository root unless noted otherwise. The connected harness uses Chromium/ChromeDriver, the actual Laravel API, dedicated database media queue, FFmpeg/GD/Zip and real ClamAV. It creates no external Flutter runtime and does not use the application's ordinary database/accounts.

1. Start `docker compose -f docker/chat-media.local.yml up -d`; wait for health/signatures. Install the approved FFmpeg/ffprobe tools through normal local setup if unavailable.
2. From `src/api`, run `php tests/Support/seed-chat-media-browser.php`. It guards and resets only `storage/framework/testing/chat-browser/fixture.sqlite`, creates invented role accounts/context, and writes temporary image/video/PDF plus fixture IDs and a scoped Courier token inside ignored storage. Do not publish fixture tokens.
3. Start an isolated API from `src/api` (port 8000 is deliberately left alone):

```sh
DB_CONNECTION=sqlite DB_URL= DB_DATABASE="$PWD/storage/framework/testing/chat-browser/fixture.sqlite" APP_ENV=local SESSION_DRIVER=file SESSION_SECURE_COOKIE=false CACHE_STORE=file QUEUE_CONNECTION=database CHAT_MEDIA_ENABLED=true CHAT_MEDIA_DISK=local CHAT_MEDIA_CLAMAV_HOST=127.0.0.1 CHAT_MEDIA_CLAMAV_PORT=13310 SANCTUM_STATEFUL_DOMAINS=localhost:15300,localhost:15174,localhost:15176 CORS_ALLOWED_ORIGINS=http://localhost:15300,http://localhost:15174,http://localhost:15176 php artisan serve --host=127.0.0.1 --port=18000
```

4. In another terminal from `src/api`, start its worker:

```sh
DB_CONNECTION=sqlite DB_URL= DB_DATABASE="$PWD/storage/framework/testing/chat-browser/fixture.sqlite" APP_ENV=local CACHE_STORE=file CHAT_MEDIA_ENABLED=true CHAT_MEDIA_DISK=local CHAT_MEDIA_CLAMAV_HOST=127.0.0.1 CHAT_MEDIA_CLAMAV_PORT=13310 php -d memory_limit=512M artisan queue:work media --queue=media --sleep=1 --timeout=180 --tries=3
```

5. From `src/webapp`, build with `pnpm exec next build --webpack`, then run `pnpm exec next start --hostname 127.0.0.1 --port 15300`. From `src/seller` / `src/logistics`, run `pnpm exec vite --host 127.0.0.1 --port 15174 --strictPort` / `pnpm exec vite --host 127.0.0.1 --port 15176 --strictPort`. Start `chromedriver --port=19515 --allowed-ips=127.0.0.1` from the repository root.
6. Run `node packages/chat-ui/tests/media-browser.smoke.mjs` from the root. The test routes browser fetch/XHR/native media URLs to the isolated API without editing production assets. Server-side public storefront reads keep their configured origin; the harness does not mutate that server's data. Login/session/CSRF, normal uploads, malware/content inspection, queue processing, message writes, private bytes and Courier bearer reads are real. Only deliberate post-commit response loss and capability outages are simulated. Screenshots/results are ignored under `node_modules/.cache/chat-media-browser`.
7. Stop the API/worker/app/driver processes started for this check. `docker compose -f docker/chat-media.local.yml down` stops the verification scanner while retaining reusable signatures. Remove fixture storage/private attachment bytes when no longer needed; never clear unrelated app storage.

The harness covers all seven existing web chat surfaces at 390/768/1280px, Customer light and Seller/Logistics light/dark; attachment-only sends, PDF download metadata, private thumbnails/full viewer with focus/Escape, controlled video playback/range, rejected-file feedback/removal, locked exact retry after an uncertain real commit, offline and disabled-media controls. Backend tests separately cover prospective first sends, owner/tenant/context isolation, count/size/expiry, invalid media, scan outages, processing retries, cleanup, terminal history and PostgreSQL races. It does not certify Azure production storage, external Flutter selection/rendering or installed-device behavior.

`node packages/chat-ui/tests/media-bearer.smoke.mjs` additionally verifies real Courier bearer upload/checking of PNG/MP4/PDF, attachment-only send/exact replay, and Customer bearer receipt plus private image/video-range/document reads against the same isolated fixture. It creates no external Flutter or device implementation.
