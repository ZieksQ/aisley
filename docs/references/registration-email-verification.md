# Email verification before registration

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

Every existing `POST /api/v1/{role}/auth/register` requires `email_verification_token`, alongside the existing fields and content type. Customer remains JSON; Seller/Logistics/Courier retain multipart evidence. Registration validates the role/email-bound proof before permanent evidence storage, and consumes it in the same database transaction as the complete registration. `users.email_verified_at` records the actual verification time.

Missing, invalid, consumed, expired, or wrong-email/wrong-role proofs return `422` with `errors.email_verification_token`; no registration side effects occur. A failed persistence transaction preserves a valid proof and removes losing evidence using the existing role workflow. Concurrent duplicate submissions create at most one role-account. Successful registration returns `201` and no credential. Customers return `customer.status=pending` by default; when Admin disables `customer_registration_approval_required`, new Customers return `active` with `Your account is ready. You can now sign in.` and an approved application. Existing pending Customers and other roles retain approval requirements. Clients route active results to sign-in rather than waiting for approval.

There is no durable registration replay key or applicant polling API. After an uncertain response or upload cancellation, show that registration may already have committed and suggest explicit sign-in before deliberately resubmitting. Duplicate-email handling remains authoritative; never automatically replay registration, log proofs/codes, or claim that cancellation reversed a committed account.

## Authenticated company-created Courier account email changes

This is a separate post-login use of the same role-and-email-bound verification records. It does not alter public registration behavior or make email editable for legacy public-registration Couriers. Only an active Courier created by an authorized Logistics company can use the API; profile updates continue to reject email.

- `POST /api/v1/courier/account/email/verification-code` accepts the proposed `email` and `current_password`.
- `POST /api/v1/courier/account/email/verify` accepts `email`, `current_password`, `challenge_id`, and `verification_code`; success returns an `email_verification_token` valid for one hour. This step does not update the account.
- `PUT /api/v1/courier/account/email` accepts `email`, `current_password`, and `email_verification_token`. It updates only the authenticated Courier, records the proof's actual verification time in `email_verified_at`, consumes the proof atomically, and revokes all Courier tokens. A fresh login is required.
- The same code/proof properties above apply: hashed six-digit code, ten-minute code lifetime, five wrong attempts, 60-second resend interval, five requests per role/email per hour, and single-use proof. Current-password checks are repeated at each step. Duplicate Courier email, inactive or ineligible Courier, wrong password, and invalid, expired, mismatched, or consumed proof fail closed.
- The outbox uses the existing `registration_code` kind with optional `account_email: true` only for this path. Its account-email wording is separate; public registration message payloads/default wording do not change.

This backend contract does not indicate that the external Courier Flutter app implements or adopts account email changes. Focused feature and shared mail-regression tests remain pending until recorded in the implementation checkpoint.

## Client flow

Email entry → code entry/resend → registration details → existing approval destination. Keep proofs/codes in memory only. Changing email invalidates local verification and requires another code; expiry returns to verification while preserving draft details and selected evidence. Protect existing unsaved work; preserve each client's password-clearing and upload-cancellation behavior. Ignore late responses after reset, route exit, disposal, or a newer attempt.

Customer, Seller, and Logistics web registration use the shared gate's submission lifecycle. Capture the form/evidence and begin an attempt synchronously before awaiting CSRF; freeze its email/proof and disable email changes, verification controls, details, and duplicate submission until it settles. Only the originating live verification generation may complete, show errors, reset verification, or navigate. Route exit aborts the client request and invalidates callbacks; check again after CSRF before sending registration. Client cancellation cannot reverse a server commit.

Defer local proof-expiry reset while final submission is pending and honor a current successful server response. A failed submission with an expired or rejected proof returns to verification with drafts/evidence intact and visible recovery feedback, including unconfirmed-result/sign-in guidance for ambiguous failures. A recoverable validation failure may reuse an unexpired proof for an explicit retry. Old success, error, or cleanup callbacks cannot affect a newer attempt, even when it uses the same email/token.

Use one accessible code field with paste, one-time-code autofill, a numeric keyboard, six-digit validation, and leading-zero preservation. Explain expiry and spam-folder checks; respect reduced motion. Existing role palettes/native themes apply. Verification failure, offline/timeout, throttling, and final approval are distinct states.

## Persistence, delivery, and release

The additive migration creates `registration_email_identities` and `registration_email_challenges` and makes transactional email User ownership nullable. Only `registration_code` delivery accepts no User; existing kinds still require the matching User/role/email. Enum values remain DB strings with PHP casts. Proof recovery is encrypted; token lookup uses a hash.

Challenge and encrypted mail intent commit together. Existing database jobs, claim leases, SMTP timeout, retries, and recovery scheduler deliver to the pre-account email. Expired, verified, consumed, or superseded challenges are skipped. SMTP acceptance is not evidence of inbox delivery; delivery failure never creates a pending account. Operators should request a fresh code rather than retrying an expired message.

`auth:cleanup-registration-codes` runs hourly, clears obsolete challenge secrets, and removes obsolete challenge history after 24 hours without resetting the hourly quota. Apply migrations and restart workers/scheduler before releasing updated web and mobile clients. Enforcement is mandatory; older clients cannot complete new registration without verification. Existing accounts are not backfilled or newly gated.

Local acceptance must cover all role routes, no pre-verification side effects, normalization, hashing/encryption, leading zeros, wrong attempts, resend/expiry, correct retry, proof binding/single use, registration rollback, evidence cleanup, duplicate races, mail delivery/obsolete skipping, client cancellation, draft preservation, and accessible responsive states. Record PostgreSQL process concurrency, deployed API/worker behavior, real SMTP inbox delivery, and installed-device checks separately from local mocks/builds.
