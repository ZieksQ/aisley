# Global Ban / Blocklist Management Flow

**System:** AISLEY  
**Feature:** Global Ban / Blocklist Management  
**Status:** Draft  
**Basis:** `Admin.md`, `app.md`, `specs.md`

## 1. Purpose

This file contains the sequence-heavy behavior for:

- adding user/IP/payment blocks
- disabling/reactivating blocks
- request-time enforcement
- transaction-time payment enforcement
- cache synchronization
- Audit Log handoff

## 2. Admin Entry

```mermaid
flowchart TD
    A[Admin opens Blocklist] --> B[Authenticate Admin]
    B --> C{Blocklist permission?}
    C -->|No| D[Forbidden]
    C -->|Yes| E[Load paginated entries]
    E --> F[Render list/search/filters]
```

## 3. Add User Ban

```mermaid
flowchart TD
    A[Add User Ban] --> B[Search/select exact role-account]
    B --> C[Enter reason/source]
    C --> D[Confirm]
    D --> E[Authenticate + authorize]
    E --> F[Resolve user_id]
    F --> G{Equivalent active ban?}
    G -->|Yes| H[Show existing entry]
    G -->|No| I[Create ACTIVE USER block]
    I --> J[Update/invalidate cache]
    J --> K[Write Audit event]
```

Target rule:

```text
user_id
not email alone
```

## 4. Same Email Across Roles

```text
alex@example.com + BUYER
alex@example.com + SELLER

Ban Seller user_id
→ Seller blocked
→ Buyer account unchanged
```

## 5. Add IP Block

```mermaid
flowchart TD
    A[Add IP] --> B[Validate IPv4/IPv6]
    B --> C{Valid?}
    C -->|No| D[Validation error]
    C -->|Yes| E[Canonicalize]
    E --> F{Equivalent active IP block?}
    F -->|Yes| G[Show existing entry]
    F -->|No| H[Confirm]
    H --> I[Persist ACTIVE IP block]
    I --> J[Update/invalidate cache]
    J --> K[Audit]
```

## 6. Add Payment Block

```mermaid
flowchart TD
    A[Add Payment Block] --> B[Provide provider-safe identifier]
    B --> C[Validate]
    C --> D{Safe/valid?}
    D -->|No| E[Reject]
    D -->|Yes| F{Equivalent active block?}
    F -->|Yes| G[Show existing entry]
    F -->|No| H[Confirm]
    H --> I[Persist ACTIVE PAYMENT_METHOD block]
    I --> J[Update/invalidate cache]
    J --> K[Audit]
```

Never use:

```text
full card number
CVV
OTP
bank password
```

## 7. Disable Block

```mermaid
flowchart TD
    A[Open active entry] --> B[Select Disable]
    B --> C[Confirm]
    C --> D[Authenticate + authorize]
    D --> E{Still active?}
    E -->|No| F[Return current state]
    E -->|Yes| G[Set inactive]
    G --> H[Record actor/time]
    H --> I[Invalidate cache]
    I --> J[Audit]
```

Disable preserves historical record.

## 8. Reactivate Block

If supported:

```mermaid
flowchart TD
    A[Open inactive entry] --> B[Select Reactivate]
    B --> C[Check equivalent active block]
    C --> D{Exists?}
    D -->|Yes| E[Show existing entry]
    D -->|No| F[Set ACTIVE]
    F --> G[Update cache]
    G --> H[Audit]
```

## 9. IP Enforcement

```mermaid
flowchart TD
    A[Incoming request] --> B[Resolve trusted client IP]
    B --> C[Check active IP block]
    C --> D{Blocked?}
    D -->|Yes| E[Deny with generic response]
    D -->|No| F[Continue request pipeline]
```

## 10. User Enforcement

```mermaid
flowchart TD
    A[Protected request] --> B[Resolve authenticated user]
    B --> C{Authenticated?}
    C -->|No| D[Continue normal auth handling]
    C -->|Yes| E[Check user_id]
    E --> F{Globally banned?}
    F -->|Yes| G[Deny request]
    F -->|No| H[Continue authorization/business logic]
```

Existing session/token does not bypass this check.

## 11. Combined Request

```text
incoming request
→ trusted IP
→ IP blocked?
   yes → deny
   no  → continue
→ authenticate when required
→ authenticated user blocked?
   yes → deny
   no  → authorization/business logic
```

## 12. Payment Attempt

```mermaid
flowchart TD
    A[Payment attempt] --> B[Validate user/order context]
    B --> C[Derive safe payment identifier]
    C --> D[Check payment block]
    D --> E{Blocked?}
    E -->|Yes| F[Stop transaction]
    F --> G[Generic payment denial]
    E -->|No| H[Continue payment provider flow]
```

The backend check remains authoritative even if checkout loaded before the block was added.

## 13. Historical Payment

```text
block added now
→ future/applicable payment attempts denied

completed historical transactions
→ unchanged
```

## 14. Existing Session After User Ban

```text
user already logged in
→ Admin activates USER block
→ next protected request
→ Blocklist check
→ denied
```

Session/token revocation is optional/Open.

## 15. Independent Account State

```text
Account status = SUSPENDED
Global Ban = ACTIVE

disable Global Ban
→ Global Ban = INACTIVE
→ Account status remains SUSPENDED
```

## 16. Independent Compliance State

```text
Seller Compliance restriction = ACTIVE
Global Ban = ACTIVE

disable Global Ban
→ compliance restriction remains ACTIVE
```

## 17. Complaint Handoff

```mermaid
flowchart TD
    A[Admin reviews complaint] --> B[Security action appears justified]
    B --> C[Create Blocklist Entry]
    C --> D[Prefill safe complaint reference]
    D --> E[Review target/type/reason]
    E --> F[Explicit confirmation]
    F --> G[Blocklist service creates entry]
```

No automatic ban.

## 18. Compliance Handoff

```text
Compliance case
→ Admin explicitly chooses Global Ban
→ separate Blocklist permission/confirmation
→ block created
```

No automatic coupling.

## 19. Cache Lookup

```mermaid
flowchart TD
    A[Runtime check] --> B[Check cache/index]
    B --> C{Definitive result?}
    C -->|Yes| D[Return result]
    C -->|No| E[Query authoritative store]
    E --> F[Return result]
    F --> G[Optionally refresh cache]
```

## 20. Cache Mutation Sync

```text
Admin mutation commits
→ durable Blocklist state changes
→ invalidate/update relevant cache
→ subsequent checks use new state
```

Cache is not the source of truth.

## 21. Cache Failure

```text
cache unavailable
→ configured fallback policy
```

Recommended:

```text
database fallback
```

Exact fail-open/fail-closed behavior is Open.

## 22. Runtime Match Logging

```text
blocked request/transaction
→ security/application log
→ aggregate monitoring
```

Do not create one Admin Audit event per runtime match.

## 23. Audit Handoff

```text
Admin add/disable/reactivate
→ mutation commits
→ safe Audit event
→ System Audit Logs records:
   actor
   action
   entry ID
   block type
   safe target
   timestamp
```

No payment secrets.

## 24. Duplicate Handling

```mermaid
flowchart TD
    A[Admin submits block] --> B[Normalize target]
    B --> C[Check equivalent active entry]
    C --> D{Exists?}
    D -->|Yes| E[Do not duplicate]
    E --> F[Show existing block]
    D -->|No| G[Create new active block]
```

## 25. Blocked Response

```text
active match
→ deny access / transaction
→ generic message
```

Do not reveal:

```text
internal reason
fraud evidence
Admin creator
payment fingerprint
security notes
```

## 26. Complete Flow

```mermaid
flowchart TD
    A[Authorized Admin] --> B[Blocklist]
    B --> C{Action}

    C -->|Add User| D[Select role-account]
    C -->|Add IP| E[Validate/canonicalize IP]
    C -->|Add Payment| F[Validate safe payment identifier]

    D --> G[Duplicate check]
    E --> G
    F --> G

    G --> H{Already active?}
    H -->|Yes| I[Show existing]
    H -->|No| J[Persist active block]
    J --> K[Sync cache]
    K --> L[Audit]

    C -->|Disable| M[Confirm active entry]
    M --> N[Set inactive]
    N --> O[Sync cache]
    O --> P[Audit]

    J --> Q[Runtime enforcement]
    Q --> R[Request / transaction]
    R --> S{Active match?}
    S -->|Yes| T[Deny generically]
    S -->|No| U[Continue normal flow]
```

## 27. Open Flow Decisions

The exact flow still depends on:

- session/token revocation
- Admin-account ban policy
- IP route exclusions
- CIDR/range matching
- payment provider/fingerprint format
- COD behavior
- fail-open/fail-closed policy
- cache implementation
- reactivation
- banned-user support access
- active order/shipment/task handling
- security alert thresholds
