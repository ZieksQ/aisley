# Courier account password verification

Adopted local implementation, 2026-10-14; deployed API, SMTP inbox delivery and installed-device acceptance remain open.

## Request and resend

Authenticated `POST /api/v1/courier/account/password/verification-code`, JSON `current_password`, `password`, `password_confirmation`. Use the existing active/approved role, Sanctum bearer and consent boundaries. The server selects the authenticated account's email; submitted email/owner/role fields are rejected.

HTTP 202: `{message:string,data:{challenge_id:UUID,masked_email:string,expires_at:timestamp,resend_available_at:timestamp}}`. All four data fields are required. Timestamps are ISO-8601; preserve six-digit codes as strings, including leading zeros. Queued email is not confirmed inbox delivery.

Request using current/new/confirmed passwords first. Enter the email code in the second step. Resend uses the same POST and same draft, replacing the previous challenge. Password edits require a new challenge.

## Confirm

`PUT /api/v1/courier/account/password` requires the same password fields plus `challenge_id` and `verification_code`. Example body:

```json
{
  "current_password": "Synthetic9Old",
  "password": "Synthetic9Example",
  "password_confirmation": "Synthetic9Example",
  "challenge_id": "11111111-1111-4111-8111-111111111111",
  "verification_code": "012345"
}
```

HTTP 200 retains the existing `{message:string}` envelope. All Courier bearer tokens are revoked, including this device. Clear private state and return to sign-in.

## Errors and lifecycle

- Current and replacement passwords use existing policy: at least eight characters, mixed case and a number; confirmation must match. Missing code/id and invalid passwords return field-addressable 422.
- Codes expire ten minutes after requesting them. Five wrong code submissions invalidate the challenge. Expired, consumed, replaced, wrong-user/role/email/current-credential or changed-password-draft challenges return 422 without updating the password.
- Resend waits 60 seconds; no more than five successful code requests per account per rolling hour. 429 honors server `Retry-After`. 401/403 and policy-consent denial retain existing session handling.
- Keep credentials/code/challenge in memory only. Cancel, successful completion, disposal and account loss clear them; late responses cannot restore another identity's draft. Disable duplicate actions.
- Never automatically replay confirmation. An uncertain timeout/network/5xx result requires sign-in reconciliation before another password change. Code-request uncertainty permits a deliberate fresh request after a cooldown.
- Laravel atomically validates/consumes verification, updates the hash and applies existing revocation/audit behavior. SMTP/outbox failure leaves the password unchanged; expired/obsolete emails are skipped.

## Release

The API requires the additive challenge migration and updated mail workers before client adoption. Old clients without code fields fail safely with 422. No new dependency, recovery UI, reset-link behavior or SMTP variable is introduced. Synthetic tests/builds do not establish real email or installed-device acceptance.
