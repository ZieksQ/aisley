# POD approval and Courier cash checks

Run all commands from this repository or its `src/api` directory. Install the existing workspace and Composer dependencies first.

Backend regression checks, from `src/api`:

```sh
php artisan test --compact --filter='DeliveryApprovalTest|CourierCashRemittanceTest|FinalMileFulfillmentTest|CodAutomationTest|GatewayHttpContractTest|CustomerCheckoutTest'
php tests/Support/run-delivery-postgres.php
```

The PostgreSQL runner uses the local Laravel PostgreSQL connection to create a unique temporary database, runs the delivery/cash tests including process concurrency, and drops that database in `finally`. It requires permission to create databases and the PHP `pcntl` extension. It does not reset the configured application database.

For connected browser checks, prepare the isolated SQLite fixture from `src/api`:

```sh
php tests/Support/seed-pod-browser.php
```

Only `storage/framework/testing/pod-browser.sqlite` is reset. The fixture creates test Logistics/Courier accounts and a COD task with a private photo and completion intent. Start a separate API process from `src/api` using these test settings:

```sh
APP_ENV=local APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
APP_URL=http://127.0.0.1:15800 DB_CONNECTION=sqlite DB_URL= \
DB_DATABASE="$PWD/storage/framework/testing/pod-browser.sqlite" \
SESSION_DRIVER=file SESSION_DOMAIN=127.0.0.1 SESSION_SECURE_COOKIE=false \
QUEUE_CONNECTION=database CACHE_STORE=array FILESYSTEM_DISK=local \
SANCTUM_STATEFUL_DOMAINS=127.0.0.1:15176,127.0.0.1:15800 \
CORS_ALLOWED_ORIGINS=http://127.0.0.1:15176 FINANCE_GATEWAY_ENABLED=true \
php artisan serve --host 127.0.0.1 --port 15800
```

From the repository root, build and serve Logistics:

```sh
VITE_API_URL=http://127.0.0.1:15800 pnpm --filter logistics build
pnpm --filter logistics exec vite preview --host 127.0.0.1 --port 15176 --strictPort
```

Start an isolated Chromium-compatible browser with CDP port `19226` and a separate profile under `src/api/storage/framework/testing/`. The harness uses the first page target. Test account passwords and the API key above are fixture values only.

```sh
brave-browser --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --no-first-run --disable-background-networking --remote-debugging-port=19226 \
  --user-data-dir="$PWD/src/api/storage/framework/testing/pod-browser-profile" about:blank
POD_LIVE_ONLY=1 POD_SKIP_RESPONSIVE=1 node src/logistics/tests/pod-browser.smoke.mjs
POD_MOCK_ONLY=1 node src/logistics/tests/pod-browser.smoke.mjs
```

Reseed before each connected run. The connected run uses real Logistics session/CSRF and scoped Courier bearer requests for correction, photo resubmission, approval, cash receipt, invoice separation, masked Billing, and policy changes. The controlled run intercepts APIs to check delayed photos, exact mutation retries, selection retention, loading/empty/error states, keyboard access, and 390/768/1440-pixel layouts in both themes. Screenshots are saved under the ignored testing directory; mock checks do not certify live backend behavior. No external Flutter client or real payment provider is exercised. Stop these isolated processes when finished.
