# Failure contracts and recovery

Inspected checkout 57e9eb2. The envelope varies by Laravel handler; parse optional `code:string`, `message:string`, `errors:Map<string,List<string>>` without requiring all keys. Field keys follow **request** casing. Do not dump debug traces or private payloads into UI/logs. The examples below are synthetic representations of source handlers, not live captures; validation wording may vary by framework locale.

| Status / code | Meaning / client action |
| --- | --- |
|401, message only | unauthenticated/revoked; clear invalid token/private identity |
|403 FORBIDDEN_ROLE | wrong persisted role; clear unauthorized identity |
|403 ACCOUNT_PENDING_APPROVAL / ACCOUNT_REJECTED / ACCOUNT_SUSPENDED / ACCOUNT_INACTIVE | no private access; show matching approval/account state |
|403 POLICY_CONSENT_REQUIRED | retain valid identity, suspend protected work, read/accept current policy; never replay blocked write automatically |
|404, sometimes message only | scoped unknown/foreign/invisible resource; clear that record without leaking existence |
|422 INVALID_CREDENTIALS / EMAIL_ALREADY_REGISTERED / INVALID_RESET_TOKEN | auth field feedback; no usable new token |
|422 validation without code | show exact field errors; preserve safe draft; do not require code |
|409 QUOTE_EXPIRED / QUOTE_INPUT_CHANGED / QUOTE_STALE | refresh quote and require reviewed Place |
|409 QUOTE_ALREADY_PLACED / IDEMPOTENCY_KEY_REUSED | reconcile committed intent; never generate a fresh key blindly |
|409 ORDER_NOT_CANCELLABLE / ORDER_NOT_MODIFIABLE / ORDER_TRANSITION_CONFLICT | refresh Order capabilities; eligible window ended |
|409 POLICY_VERSION_STALE | current publication changed; refresh/read/confirm new version |
|409 IDEMPOTENCY_CONFLICT / CONVERSATION_READ_ONLY | operational message key/relationship conflict; refresh and reconcile |
|409 message only | Shop/support aborts may have no code; preserve key/draft and refresh |
|429 RATE_LIMITED or message only | honor exposed Retry-After; prevent submit/retry loop |
|503 ADDRESS_DATA_UNAVAILABLE | optional address API unavailable; bundled/manual form still usable |
|5xx / offline / CORS / decode / deadline | explicit unavailable/uncertain state, never empty list or proof of rollback |

Shop idempotency misuse can be a validation error; operational chat uses409 IDEMPOTENCY_CONFLICT. Never collapse all channels into one assumed error-code set. Unknown server codes still show safe HTTP-category recovery. Named limiters can change; exact Retry-After is the server timing authority, not a permanent retry schedule.

```json
{"message":"Unauthenticated."}
```

```json
{"code":"FORBIDDEN_ROLE","message":"This area is restricted to customers."}
```

```json
{"message":"The quantity field must be at least 1.","errors":{"quantity":["The quantity field must be at least 1."]}}
```

```json
{"code":"QUOTE_EXPIRED","message":"The checkout quote has expired. Request a new quote.","errors":{"quote_id":["The checkout quote has expired. Request a new quote."]}}
```

```json
{"message":"The ticket changed. Refresh it before trying again."}
```

For consent denial, `data:{required_policies:[{type:string,label:string,version:int?,read_url:string,accept_url:string?}],status_url:string}` accompanies code/message. These are API paths subject to the same trusted-origin/type validation. Recheck status after acceptance; neither a local checkbox nor this denial descriptor opens private access.

[Examples](examples/README.md) contain feature-specific request/success/null/empty/failure fixtures. [Operations](operations.md) decide whether exact replay is permitted. Cancelled transport can still commit. Retry supported UUID writes with identical frozen body/key; do not replay additive Cart/photo writes. All private failures are session-generation scoped, including stale401/403 from a previous account.
