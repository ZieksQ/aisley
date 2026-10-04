# Customer bearer authentication

Backend implemented; Buyer Flutter pending. Sources: Customer Auth controller/Requests/Resources, `EnsureActiveCustomer`, Customer Account service, Sanctum configuration and `CustomerAuthenticationTest.php` at the [baseline](../references/source-provenance.md).

## Exact login path

Send `POST /api/v1/customer/auth/login` with normalized email, password and nonempty `device_name` (maximum 255 characters), for example:

```json
{"email":"buyer@example.com","password":"<entered password>","device_name":"buyer-android"}
```

An active Customer receives `200 {message, customer: {id, displayName, avatarUrl, role, status}, token}`. The token is issued with abilities `["customer"]`; it is returned only on this login path, never by `/me`. Persisted role/status checks protect Customer routes. Do not imply an additional token-ability middleware exists: current `customer.active` checks the principal's stored role/status.

Omitting `device_name` selects the existing web-session flow. That storefront initializes `/sanctum/csrf-cookie`, uses credentialed HttpOnly cookies and CSRF, and regenerates the session; it does not store a bearer token in browser storage. Flutter Android and the dedicated local browser test target use the explicit token path and do not mix those cookies with bearer credentials.

Registration accepts `first_name`, `last_name`, optional `middle_name`, `contact_number`, `sex`, `birth_date`, `email`, `password`, `password_confirmation`. Sex values are `male`, `female`, `non_binary`, `prefer_not_to_say`; birth date is before today. Password is at least 8 characters with mixed case and numbers. Laravel normalizes email and owns age/role/status. Response is `201 {message, customer}` with a pending account/Application and **no credential**. Duplicate Customer email is `422 EMAIL_ALREADY_REGISTERED`; another role's same-email identity is separate. Address/ID evidence and applicant status polling are unavailable.

Invalid/unknown/other-role-only credentials share `422 INVALID_CREDENTIALS`. Credentials are verified before account-state denial. Valid credentials for pending/rejected/suspended/inactive accounts produce `403 ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED` or `ACCOUNT_INACTIVE` without a token. Protected wrong-role requests produce `FORBIDDEN_ROLE`. Do not infer approval from locally stored status.

## Restoration, consent and cleanup

Secure read → token present → `GET /api/v1/customer/auth/me` with bearer → validate `customer.role = customer` and active status → `GET /api/v1/policy-consent/status` → enter private routes only when `all_required_accepted` is true. Deduplicate bootstrap and use identity/session generation to reject late responses. The Buyer app keeps all shopping screens blocked during recoverable verification failures; authentication/recovery and public Terms/Privacy remain reachable. Backend public read contracts are unchanged.

Required policies use current `terms_of_service` and `privacy_policy`. Read public content and require explicit `POST /api/v1/policy-consent/{type}/versions/{version}/accept` with `{"confirmation":true}`. There is no acceptance idempotency header requirement: the User/version uniqueness makes exact acceptance replay safe. A stale version returns `409 POLICY_VERSION_STALE`; refresh content/status before renewed confirmation. Initial/re-consent enforcement follows the Admin platform control; `required`, exact `accepted` and `all_required_accepted` are distinct server fields.

Protected features may return `403 POLICY_CONSENT_REQUIRED` with required descriptors/read/accept/status paths. Keep the session, suspend protected work and open consent; never accept automatically or replay the blocked commerce write. `/me`, logout and consent endpoints remain reachable. `401` or explicit role/account-state denial clears invalid private identity; a resource `403/404` clears only affected state unless it actually signals account loss.

`POST /api/v1/customer/auth/logout` deletes the current personal access token. It does not revoke all devices. On successful logout, delete the locally stored token and all account-scoped memory/requests. A revoked token later receives `401`. Offline logout can clear local state, but cannot prove remote revocation; explain that outcome and never retain a secret merely to retry after switching accounts.

Account password change uses `PATCH /api/v1/customer/account/password` with current password and confirmed replacement. It preserves the current bearer token and deletes other personal access tokens; the existing cookie-session path rotates its current session. Durable device/session list and revoke-all UI are unavailable. Do not promise all cookie sessions are invalidated.

## Password recovery

`POST /api/v1/customer/auth/forgot-password` with email acknowledges generically for valid input; eligible active Customers receive mail. Reset is `POST /api/v1/customer/auth/reset-password` with email, token, password and confirmation. Tokens are role-scoped, hashed, single-use and expire under current configuration (default 60 minutes). Successful reset deletes all personal access tokens; invalid/expired/reused/cross-role token returns `422 INVALID_RESET_TOKEN`.

Mail URL uses `CUSTOMER_PASSWORD_RESET_URL`, default `http://localhost:3000/reset-password?token=...&email=...`. Native app links/deep links are not configured. First delivery can open the configured trusted storefront recovery flow; native reset handling is pending an approved link contract. Never log or persist reset URLs/tokens, and do not invent a Flutter link merely by changing screen routing.

## Secure storage and local browser

Use the destination project's approved platform secure-storage implementation. Android credentials must use protected platform storage; restoration/write/delete failure must show a retryable state and fail closed for private routes. No token in ordinary preferences, guest history, URLs or logs. Do not enable a plaintext fallback. Sanctum currently has `expiration = null`; there is no refresh-token endpoint or promised automatic rotation. Revalidate through `/me` and sign in again after actual revocation.

The fresh-project choice is flutter_secure_storage10.0.0, with Android platform storage and origin-bound WebCrypto on HTTPS/localhost. Metadata was inspected; run restoration/deletion/failure checks before claiming either target accepted. See [selected baseline](../setup.md). Any internal browser persistence is allowed only through that reviewed secure-storage implementation for the local test target. [flutter_secure_storage documentation](https://pub.dev/packages/flutter_secure_storage)

Buyer runs at `http://localhost:8766`, independent of Courier `8765`. See [architecture](../architecture.md) for exact-origin CORS, non-stateful token configuration, exposed headers and cookie contamination checks. A production browser delivery requires a separate security/deployment decision.

## Standalone contract record

New source inspection at57e9eb2 confirmed these auth/session/consent/token effects. [Exact operations](operations.md), [wire types](field-index.md) and [synthetic auth fixtures](examples/customer-auth.json) supply all requests/responses locally; upstream source is optional provenance. Registration profile_photo_path is normally null but is currently serialized; discard it, never construct a storage URL, and retain G24. Login token/storage failure and offline logout remain explicit retry/uncertainty states.
