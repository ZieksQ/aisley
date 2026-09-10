# Courier API mockup

This is a small, development-only React harness for exercising the implemented Courier API from a browser while the real client is built in Flutter.

## Run it

From the repository root:

```bash
pnpm install
pnpm --dir src/couriermockup dev
```

The Vite proxy forwards `/api` requests to `http://127.0.0.1:8000`. Set `VITE_API_URL` when the API is hosted at another origin.

## Authentication boundary

Login receives the Sanctum token once, then protected requests send it in an `Authorization: Bearer <token>` header. Requests explicitly use `credentials: omit`; this mockup does not initialize Sanctum cookies or send CSRF cookies. The token is kept in browser `sessionStorage` only for this local test harness. Flutter must use OS secure storage.

The mockup currently checks login, session restoration, account read, profile update, password change, logout, and the implemented dashboard scaffold. It does not pretend that deferred shipment operations are available.
