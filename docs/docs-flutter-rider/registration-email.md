# Registration details before email verification

Contract adopted on 2026-10-14 for Customer, Seller, Logistics, and Courier. Existing accounts keep their login and approval behavior. Admin has no public registration. Email verification proves access to the inbox; it does not replace account or evidence approval.

## Public API

Use `/api/v1/{role}/auth/registration`, where the route selects `customer`, `seller`, `logistics`, or `courier`. Web clients initialize Sanctum CSRF and use their existing credentialed requests. Native Flutter requests require no bearer token. Responses containing verification details use `Cache-Control: no-store`.

| Action | JSON request | HTTP 200 response |
| --- | --- | --- |
| `POST /verification-code` | `email` | `message`, `challenge_id` UUID, `expires_at`, `resend_available_at` |
| `POST /verify-email` | `email`, `challenge_id`, `verification_code` | `message`, `email_verification_token`, `expires_at` |

- Emails are trimmed, lowercased, validated, and limited to 255 characters. Authority fields `role`, `status`, and `email_verified_at` are prohibited. A code request acknowledges identically for an existing or unused same-role email; final registration retains its existing duplicate-email response.
- The verification code is a string of exactly six ASCII digits, including leading zeros, generated cryptographically and stored hashed. It expires ten minutes after issuance. Five wrong attempts invalidate the challenge; counts commit even when verification returns `422`.
- Resend requires 60 seconds between requests and permits five sends per email/role per rolling hour. Issuance shares a persistent identity lock, including concurrent first requests. Resend invalidates earlier codes and proofs for that email/role.
- Code requests also permit 30 sends per IP per hour; verification permits 30 attempts per IP per minute. `429` includes `Retry-After`; clients disable buttons and direct/keyboard submissions until the delay passes.
- Verification returns a random 64-character hexadecimal registration token, valid for 60 minutes after verification. A correct verification retry returns the same unexpired proof; verification never creates a User, application, evidence, session, or access token.
- Malformed inputs return field-addressable `422`. Incorrect, exhausted, unavailable, mismatched, or expired challenges return `errors.verification_code`. Verification creates no account-status or approval privileges.

## Completing registration

When registration OTP is enabled (the default), every existing `POST /api/v1/{role}/auth/register` requires `email_verification_token`, alongside the existing fields and content type. Customer remains JSON; Seller/Logistics/Courier retain multipart evidence. Registration validates the role/email-bound proof before permanent evidence storage, and consumes it in the same database transaction as the complete pending registration. `users.email_verified_at` records the actual verification time.

Missing, invalid, consumed, expired, or wrong-email/wrong-role proofs return `422` with `errors.email_verification_token`; no registration side effects occur. A failed persistence transaction preserves a valid proof and removes losing evidence using the existing role workflow. Concurrent duplicate submissions create at most one role-account. A successful registration keeps its existing `201` pending resource and approval message and issues no credential.

There is no durable registration replay key or applicant polling API. After an uncertain response or upload cancellation, show that registration may already have committed and suggest explicit sign-in before deliberately resubmitting. Duplicate-email handling remains authoritative; never automatically replay registration, log proofs/codes, or claim that cancellation reversed a committed account.

## Separate authenticated Courier account email flow

The backend exposes a distinct email-change flow only for active company-created Couriers. It reuses the role/email-bound OTP and proof store but does not alter public registration requirements, legacy public-Courier email editability, or the public Courier registration cutover response. See the [Courier Account Management contract](features/courier/account-management/specs.md#backend-contract-company-created-courier-email-change-flutter-adoption-pending) for routes and lifecycle. Flutter implementation/adoption and the focused backend tests are pending; no mobile behavior is implied here.

## Client flow

Complete registration details/evidence and email → code entry/resend → explicit registration submission → existing approval or account-ready destination. Keep proofs/codes in memory only. Changing email invalidates local verification and requires another code; expiry returns to verification while preserving draft details and selected evidence. Protect existing unsaved work; preserve each client's password-clearing and upload-cancellation behavior. Ignore late responses after reset, route exit, disposal, or a newer attempt.

Use one accessible code field with paste, one-time-code autofill, a numeric keyboard, six-digit validation, and leading-zero preservation. Explain expiry and spam-folder checks; respect reduced motion. Existing role palettes/native themes apply. Verification failure, offline/timeout, throttling, and final approval are distinct states.

Keep registration drafts, passwords and selected evidence in memory through verification, Back/edit navigation, browser tab switching and mobile background/resume. Email changes invalidate the challenge/proof without discarding other fields. Recompute expiry on return; never clear draft data on focus or visibility changes. Refresh, process termination and page closure recovery are outside this guarantee; do not persist passwords, OTPs, proofs or evidence in ordinary storage.

## Persistence, delivery, and release

The additive migration creates `registration_email_identities` and `registration_email_challenges` and makes transactional email User ownership nullable. Only `registration_code` delivery accepts no User; existing kinds still require the matching User/role/email. Enum values remain DB strings with PHP casts. Proof recovery is encrypted; token lookup uses a hash.

Challenge and encrypted mail intent commit together. Existing database jobs, claim leases, SMTP timeout, retries, and recovery scheduler deliver to the pre-account email. Expired, verified, consumed, or superseded challenges are skipped. SMTP acceptance is not evidence of inbox delivery; delivery failure never creates a pending account. Operators should request a fresh code rather than retrying an expired message.

`auth:cleanup-registration-codes` runs hourly, clears obsolete challenge secrets, and removes obsolete challenge history after 24 hours without resetting the hourly quota. Apply migrations and restart workers/scheduler before releasing updated web and mobile clients. Enforcement follows the Admin registration OTP control below; older clients cannot complete new registration without verification. Existing accounts are not backfilled or newly gated.

Local acceptance must cover all role routes, no pre-verification side effects, normalization, hashing/encryption, leading zeros, wrong attempts, resend/expiry, correct retry, proof binding/single use, registration rollback, evidence cleanup, duplicate races, mail delivery/obsolete skipping, client cancellation, draft preservation, and accessible responsive states. Record PostgreSQL process concurrency, deployed API/worker behavior, real SMTP inbox delivery, and installed-device checks separately from local mocks/builds.

## Registration OTP configuration — 2026-10-30

`registration_email_verification_required` is a platform-wide Admin feature control, enabled by default (including when its row is missing), for Customer, Seller, Logistics, and Courier public registration. Authorized Admins use Feature controls; updates require `platform-settings.manage`, a current revision, and the existing before/after audit record. Reads require `platform-settings.view`.

Public `GET /api/v1/{role}/auth/registration/config` returns `{ "email_verification_required": true }` (or `false`) with `Cache-Control: no-store`. This endpoint requires no authentication and exposes only the registration requirement.

When enabled, the OTP and single-use proof contract above applies. When disabled, clients skip code entry and explicitly submit their existing details/evidence without `email_verification_token`; supplied proofs are ignored, and `email_verified_at` stays null. Skipped verification never claims inbox ownership. Existing account approval, validation, duplicate-email, authentication, and evidence requirements still apply. Disabling OTP does not automatically approve an account or change existing accounts.

The API checks the switch again during registration. If re-enabled after a client read, missing proof returns `422` with `errors.email_verification_token`; clients enter verification with drafts/files intact. Settings-read failure blocks submission with explicit retry. No automatic final-registration retry is permitted. Existing code-request/verify endpoints continue requiring real codes even while the switch is off; older clients can retain their OTP flow until updated.

This switch affects public registration only. Password changes/recovery and authenticated Courier account email changes retain verification. External clients should fetch configuration before registration; portable Flutter contracts describe the same endpoint and bypass, but this backend/web change does not establish external Flutter adoption or device acceptance.
