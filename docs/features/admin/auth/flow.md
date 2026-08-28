# Admin Authentication Flow

**System:** AISLEY  
**Feature:** Admin Authentication  
**Status:** Draft  
**Basis:** `app.md`, `Admin.md`, `specs.md`

---

## 1. Purpose

This file contains the sequence/state behavior for Admin Auth.

It covers:

- initial Admin bootstrap
- login
- CSRF initialization
- role-aware account lookup
- session creation
- session restoration
- protected routes
- authorization handoff
- session expiration
- logout
- future 2FA insertion point

Requirements remain authoritative in `specs.md`.

---

## 2. Initial Admin Bootstrap

```mermaid
flowchart TD
    A[Application bootstrap] --> B[Read configured Admin email/password]
    B --> C[Lookup email + ADMIN role]
    C --> D{Admin exists?}
    D -->|Yes| E[Bootstrap complete]
    D -->|No| F[Create ADMIN account]
    F --> G[Hash password]
    G --> E
```

Rules:

```text
lookup = email + ADMIN
bootstrap is idempotent
same-email non-Admin account does not satisfy lookup
```

---

## 3. Login Entry

```mermaid
flowchart TD
    A[Admin opens /login] --> B{Valid Admin session already exists?}
    B -->|Yes| C[Redirect /dashboard]
    B -->|No| D[Render login form]
```

---

## 4. Login Flow

```mermaid
flowchart TD
    A[Login form] --> B[GET /sanctum/csrf-cookie]
    B --> C[Submit email + password]
    C --> D[POST /login]
    D --> E[Resolve email + ADMIN role]
    E --> F{Admin account exists?}
    F -->|No| G[Reject credentials]
    F -->|Yes| H[Verify password]
    H --> I{Valid?}
    I -->|No| G
    I -->|Yes| J[Create Laravel session]
    J --> K[Encrypted HttpOnly cookie]
    K --> L[Resolve authenticated Admin]
    L --> M[Redirect /dashboard]
```

---

## 5. Login Decision

```text
submitted email/password
    ↓
find:
    email = submitted email
    role = ADMIN
    ↓
record exists?
    ├── no  → deny
    └── yes
          ↓
      password valid?
          ├── no  → deny
          └── yes → establish session
```

---

## 6. Same Email Across Roles

Example:

```text
person@example.com + BUYER
person@example.com + SELLER
person@example.com + ADMIN
```

Admin login:

```text
submitted email
    ↓
ADMIN-scoped lookup
    ↓
only ADMIN password/identity can authenticate
```

Buyer/Seller credentials do not enter the Admin app.

---

## 7. Successful Login Result

```text
valid ADMIN credentials
    ↓
Laravel authenticated session
    ↓
encrypted HttpOnly session cookie
    ↓
browser sends cookie automatically
    ↓
Admin application
```

No web Bearer token needs to be stored in browser JavaScript storage.

---

## 8. Session Restoration

```mermaid
flowchart TD
    A[Admin app loads/reloads] --> B[Auth state = checking]
    B --> C[Request current Admin]
    C --> D{Valid session?}
    D -->|No| E[Auth state = unauthenticated]
    E --> F[Redirect /login]
    D -->|Yes| G{Role = ADMIN?}
    G -->|No| H[Deny Admin access]
    G -->|Yes| I[Load safe identity/permissions]
    I --> J[Auth state = authenticated]
    J --> K[Render protected app]
```

Do not render protected Admin content while authentication is still unresolved.

---

## 9. Protected Route Flow

```mermaid
flowchart TD
    A[Protected request] --> B[Browser sends session cookie]
    B --> C[Backend resolves session]
    C --> D{Authenticated?}
    D -->|No| E[401 / unauthenticated]
    D -->|Yes| F{Role = ADMIN?}
    F -->|No| G[403 / forbidden]
    F -->|Yes| H[Check feature permission]
    H --> I{Authorized?}
    I -->|No| G
    I -->|Yes| J[Execute feature]
```

---

## 10. Authentication vs Authorization

```text
Admin Auth
    ↓
authenticated ADMIN identity
    ↓
authorization middleware/policy
    ↓
feature permission
```

Auth does not grant every Admin every permission.

---

## 11. Dashboard Handoff

```text
successful login
    ↓
authenticated Admin
    ↓
/dashboard
```

Dashboard owns its own business data.

---

## 12. Session Expiration

```mermaid
flowchart TD
    A[Admin uses protected app] --> B[Session expires]
    B --> C[Next protected API request]
    C --> D[Backend returns unauthenticated]
    D --> E[Frontend clears auth state]
    E --> F[Redirect /login]
```

---

## 13. Login Page with Existing Session

```text
/login
    ↓
valid Admin session?
    ├── yes → /dashboard
    └── no  → show login form
```

---

## 14. Logout

```mermaid
flowchart TD
    A[Admin selects Logout] --> B[POST /logout]
    B --> C[Backend invalidates session]
    C --> D[Session no longer authorizes requests]
    D --> E[Frontend clears Admin state]
    E --> F[Redirect /login]
```

Frontend-only state clearing is not sufficient logout.

---

## 15. Logout Verification

After logout:

```text
old session
    ↓
protected request
    ↓
unauthenticated
```

---

## 16. Future 2FA Insertion Point

The exact 2FA method is not defined yet.

Future generic extension:

```mermaid
flowchart TD
    A[Email/password valid] --> B{2FA enabled?}
    B -->|No| C[Create authenticated session]
    B -->|Yes| D[Perform configured second-factor challenge]
    D --> E{Challenge valid?}
    E -->|No| F[Remain unauthenticated]
    E -->|Yes| C
```

Do not implement a specific TOTP/SMS/email flow until the security mechanism is selected.

---

## 17. Error Paths

Invalid email/password:

```text
POST /login
    ↓
generic authentication failure
    ↓
remain on login page
```

Invalid/expired session:

```text
protected request
    ↓
401
    ↓
clear frontend auth state
    ↓
login
```

Authenticated but unauthorized:

```text
protected request
    ↓
403
    ↓
show forbidden/access-denied state
```

---

## 18. Cross-Feature Handoff

All protected Admin features depend on Auth:

```text
Admin Auth
    ↓
Admin Dashboard
    ↓
Account Approval
Manage User Accounts
Seller Compliance
Complaints & Disputes
Reports Overview
Admin Notifications
System Audit Logs
Platform Settings
Admin Account Management
Admin Chat / Messaging
Global Ban / Blocklist
Push Notification Management
```

Each feature performs its own authorization checks.

---

## 19. Web vs Mobile Auth Boundary

```text
ADMIN WEB
    Sanctum stateful session cookie
    HttpOnly
    CSRF

FLUTTER MOBILE
    personal access token
    Authorization: Bearer
```

This Auth flow covers Admin Web only.

---

## 20. Complete Flow

```mermaid
flowchart TD
    A[Initial Admin bootstrapped] --> B[Open Admin web app]
    B --> C{Valid session?}

    C -->|Yes| D[Resolve ADMIN identity]
    D --> E[Load permissions]
    E --> F[Dashboard]

    C -->|No| G[Login page]
    G --> H[GET CSRF cookie]
    H --> I[POST login]
    I --> J[Lookup email + ADMIN]
    J --> K{Credentials valid?}

    K -->|No| L[Safe login error]
    L --> G

    K -->|Yes| M[Create Laravel session]
    M --> N[HttpOnly encrypted cookie]
    N --> D

    F --> O[Protected Admin feature]
    O --> P{Session + permission valid?}
    P -->|Yes| O
    P -->|No session| G
    P -->|No permission| Q[Forbidden]

    O --> R[Logout]
    R --> S[Invalidate session]
    S --> G
```

---

## 21. Open Flow Decisions

The source does not yet define:

- session lifetime
- idle timeout
- remember-me
- concurrent sessions
- login rate limits
- lockout behavior
- failed-login security logging
- 2FA mechanism/challenge
- forgot-password flow
- password-reset flow
- login history
- active-session management
- exact post-login return-route behavior
- Admin Global Ban behavior
