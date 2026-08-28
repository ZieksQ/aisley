# Admin Account Management Flow

**System:** AISLEY  
**Feature:** Admin Account Management  
**Status:** Draft  
**Basis:** `Admin.md`, `app.md`, `specs.md`

---

## 1. Purpose

This file contains the sequence-heavy behavior intentionally removed from `specs.md`.

It covers:

- opening Account Settings
- profile update
- password change
- preference update
- 2FA enable/disable
- email change if supported
- session expiration
- Audit Log handoff

---

## 2. Entry Flow

```mermaid
flowchart TD
    A[Admin opens Account Settings] --> B[Request current Admin]
    B --> C{Valid authenticated ADMIN session?}
    C -->|No| D[Redirect to login]
    C -->|Yes| E[Load safe profile]
    E --> F[Load preferences]
    F --> G[Load safe security status]
    G --> H[Render Account Settings]
```

Rule:

```text
target account = authenticated Admin
```

Never:

```text
target account = client-provided user_id
```

---

## 3. Profile Update Flow

```mermaid
flowchart TD
    A[Edit profile] --> B[Submit]
    B --> C[Authenticate Admin]
    C --> D[Derive target from session]
    D --> E[Allowlist fields]
    E --> F[Validate]
    F --> G{Valid?}
    G -->|No| H[Return field errors]
    G -->|Yes| I[Persist]
    I --> J[Audit if consequential]
    J --> K[Return updated profile]
```

Cross-role rule:

```text
ADMIN row changes
SELLER/BUYER/etc. rows remain unchanged
```

---

## 4. Password Change Flow

```mermaid
flowchart TD
    A[Choose Change Password] --> B[Enter required verification + new password]
    B --> C[Submit]
    C --> D[Authenticate Admin]
    D --> E[Apply selected fresh-auth/current-password rule]
    E --> F{Verification valid?}
    F -->|No| G[Return security error]
    F -->|Yes| H[Validate new password]
    H --> I{Valid?}
    I -->|No| J[Return validation error]
    I -->|Yes| K[Hash password]
    K --> L[Persist]
    L --> M[Apply shared session policy]
    M --> N[Audit password change]
    N --> O[Return success]
```

Never audit or log:

```text
old password
new password
password hash
```

---

## 5. Preferences Flow

```mermaid
flowchart TD
    A[Edit preferences] --> B[Submit supported values]
    B --> C[Authenticate Admin]
    C --> D[Validate known keys]
    D --> E{Valid?}
    E -->|No| F[Return validation errors]
    E -->|Yes| G[Persist]
    G --> H[Return updated preferences]
```

Preferences never modify:

```text
role
permissions
status
```

---

## 6. 2FA Enable Flow

The exact 2FA method is still undecided.

Generic flow:

```mermaid
flowchart TD
    A[Select Enable 2FA] --> B[Authenticate Admin]
    B --> C[Perform required security verification]
    C --> D{Valid?}
    D -->|No| E[Stop]
    D -->|Yes| F[Create pending enrollment]
    F --> G[Present setup challenge]
    G --> H[Admin verifies second factor]
    H --> I{Verification succeeds?}
    I -->|No| J[Remain disabled]
    I -->|Yes| K[Enable 2FA]
    K --> L[Create recovery material if supported]
    L --> M[Audit ADMIN_2FA_ENABLED]
```

Important:

```text
setup started
    ≠
2FA enabled
```

---

## 7. 2FA Disable Flow

```mermaid
flowchart TD
    A[Select Disable 2FA] --> B[Show warning]
    B --> C[Authenticate Admin]
    C --> D[Perform required security verification]
    D --> E{Valid?}
    E -->|No| F[Keep 2FA enabled]
    E -->|Yes| G[Disable 2FA]
    G --> H[Invalidate enrollment/recovery material as required]
    H --> I[Audit ADMIN_2FA_DISABLED]
    I --> J[Return disabled status]
```

Exact verification/recovery behavior is Open.

---

## 8. Admin Auth Handoff

After 2FA becomes enabled:

```text
Account Management
    configures 2FA state
        ↓
Admin Auth
    reads that state during future login
        ↓
Admin Auth
    performs the selected 2FA challenge
```

---

## 9. Email Change Flow

Only applies if email editing is implemented.

```mermaid
flowchart TD
    A[Edit email] --> B[Validate new email]
    B --> C[Check unique email + ADMIN]
    C --> D{Conflict?}
    D -->|Yes| E[Reject]
    D -->|No| F[Apply security verification policy]
    F --> G[Apply email verification policy if required]
    G --> H[Update ADMIN account only]
    H --> I[Apply session policy]
    I --> J[Audit ADMIN_EMAIL_CHANGED]
```

Same-email accounts under other roles remain unchanged.

---

## 10. Session Expiration Flow

```mermaid
flowchart TD
    A[Account Settings open] --> B[Session expires]
    B --> C[Admin submits mutation]
    C --> D[Backend returns unauthenticated]
    D --> E[Clear frontend auth state]
    E --> F[Do not show success]
    F --> G[Redirect to login]
```

---

## 11. Forbidden Field Flow

Example malicious payload:

```json
{
  "name": "Admin",
  "role": "SUPER_ADMIN",
  "permissions": ["*"]
}
```

Backend:

```text
authenticate
    ↓
derive self target
    ↓
allowlist editable fields
    ↓
role/permissions rejected or ignored
    ↓
no authorization change
```

---

## 12. Audit Handoff

For consequential changes:

```text
mutation commits
    ↓
safe Audit event emitted
    ↓
shared Audit infrastructure
    ↓
actor + action + safe diff + time
```

No secret data enters the Audit payload.

---

## 13. Complete Flow

```mermaid
flowchart TD
    A[Authenticated Admin] --> B[Account Settings]
    B --> C[Profile]
    B --> D[Login & Security]
    B --> E[Preferences]

    C --> F[Validate allowlisted fields]
    F --> G[Persist]
    G --> H[Audit if needed]

    D --> I[Change Password]
    I --> J[Verify security]
    J --> K[Validate + hash]
    K --> L[Persist]
    L --> M[Session policy]
    M --> N[Audit]

    D --> O[Configure 2FA]
    O --> P[Setup]
    P --> Q[Verify]
    Q --> R[Enable or Disable]
    R --> S[Audit]

    E --> T[Validate typed preferences]
    T --> U[Persist]
```

---

## 14. Related Features

```text
Admin Auth
    login/session/2FA enforcement

System Audit Logs
    security-change accountability

Admin Governance
    other Admins and custom permissions

Manage User Accounts
    Buyer/Seller/Logistics/Courier accounts

Platform Settings
    global platform settings/content
```

---

## 15. Open Flow Decisions

The flow remains intentionally generic until AISLEY decides:

- whether email is editable
- email verification requirements
- current-password confirmation
- fresh-auth timing
- password-change session invalidation
- exact 2FA method
- 2FA recovery
- exact preference set
- security-change email alerts
