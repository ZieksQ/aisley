# Account password email verification

Implemented contract, 2026-10-14. This is authenticated password editing for Customer, Seller, Logistics and Courier; Admin and forgot-password recovery keep their existing contracts.

## Request a code

`POST /api/v1/{customer|seller|logistics|courier}/account/password/verification-code`

Use each role's existing Sanctum, approval, role and consent boundary. Web clients use cookies/CSRF; Buyer/Courier mobile clients use their current scoped bearer. Ownership and email come from the authenticated User, never an email lookup or submitted recipient.

Submit JSON `current_password`, `password`, `password_confirmation`. Current password must match; replacement requires at least eight characters, uppercase, lowercase and a number, with matching confirmation. Other fields are rejected.

Success is HTTP 202, private/no-store:

```json
{
  "message": "A password verification email has been queued.",
  "data": {
    "challenge_id": "11111111-1111-4111-8111-111111111111",
    "masked_email": "b***@example.invalid",
    "expires_at": "2026-10-14T10:10:00+00:00",
    "resend_available_at": "2026-10-14T10:01:00+00:00"
  }
}
```

Email is queued, not proven delivered. Use the existing SMTP outbox/worker/scheduler. Only the latest code is usable; resend calls the same endpoint with the same password draft and creates a replacement challenge.

## Confirm the password change

Existing routes remain Customer `PATCH /api/v1/customer/account/password` and Seller/Logistics/Courier `PUT /api/v1/{role}/account/password`.

Submit the three original password fields plus `challenge_id` (UUID) and `verification_code` (six-character digit string, preserving leading zeros). Old clients lacking verification receive field-addressable 422; there is no bypass.

Success retains each existing 200/message envelope, audit and session/token policy. Customer preserves its current bearer or regenerated web session and deletes other bearer tokens. Seller keeps its web session and deletes bearer tokens. Logistics regenerates its web session and deletes all Logistics bearer tokens. Courier deletes every bearer and its app clears identity and returns to sign-in. Other cookie sessions retain existing lifetime behavior.

## Limits and failures

- A cryptographically random six-digit code expires ten minutes after creation and is single-use. Five incorrect codes invalidate that challenge.
- Resend cooldown is 60 seconds. At most five successful code requests per account in a rolling hour; code requests also have per-account/minute and per-IP/hour middleware throttles. Confirmation keeps role-specific throttling, with Seller now limited to five/minute per account.
- 401/403 retain authentication, role, approval, affiliation and consent behavior. Invalid credentials, draft mismatch, missing/malformed/incorrect/expired/consumed codes return 422. Throttling returns 429 and `Retry-After` seconds.
- Bind verification to user, role, current email/credential fingerprint and proposed password fingerprint. Account/password/email changes make the old challenge unusable. No password value is persisted in a challenge or email.
- Serialize User-before-challenge locks; consume the code, update the password, revoke tokens and record existing audit effects atomically. Persist rejected-code attempt counts independently of response validation exceptions. Rolled-back mutations leave verification unconsumed.
- Store verification hashes and keyed fingerprints; encrypt code/email only inside the existing outbox. Encrypted jobs contain intent IDs. Recheck identity and usability before delivery; clear payload after accepted/skipped mail. SMTP failure preserves the current password and pending verification. SMTP acceptance does not establish inbox delivery.

## Client and release behavior

Collect passwords first, request code, then show the masked destination, code input, expiry, resend countdown and explicit confirmation. Keep drafts/challenges in memory only; clear on cancel, completion, screen disposal and account loss. Ignore late responses after identity changes. Password edits require a fresh challenge.

Do not queue offline changes, automatically retry password mutations or report success after an uncertain response. Require sign-in reconciliation before another password change when confirmation times out or fails ambiguously (including HTTP 408/5xx or an unreadable success response). Honor `Retry-After`; code-request uncertainty permits a deliberate fresh request after the cooldown.

B11 client recovery, 2026-10-14: the auth provider/Buyer SessionController owns only nonsecret pending-operation, reconciliation and cooldown state. Same-session navigation, screen disposal/recreation, Cancel, profile/session refresh and consent checks preserve it. Block both code requests and confirmation while a confirmation is pending or reconciliation is required. Settle a delayed result against its originating session even after screen disposal; a confirmed success or definitive rejection ends pending state, while an ambiguous result requires sign-out/sign-in. Identity loss or fresh authentication clears the state; obsolete operations cannot change a newer session. Resend cooldown does not block confirmation, and expiry never clears reconciliation. Passwords, codes and challenges remain screen-local. This memory-only recovery does not survive browser reload or application-process restart.

Apply the additive challenge migration before enabling the updated API; restart mail workers for the new email kind and release the web/mobile clients together. Existing unverified client requests fail safely. No dependency or SMTP-setting change is needed. Live SMTP, PostgreSQL process concurrency, deployed API and installed-device acceptance remain separate release checks.
