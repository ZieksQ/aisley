# Manage Account Registrations Flow

**System:** AISLEY  
**Feature:** Manage Account Registrations  
**Status:** Draft  
**Email Provider:** Brevo  
**Basis:** `Admin.md`, `app.md`, `specs.md`

## 1. Purpose

This file contains the sequence/state behavior for:

- registration submission handoff
- Admin queue
- approval
- rejection
- email notification
- concurrency handling
- Dashboard/Notification/Audit handoffs

## 2. Registration Ownership

```text
Buyer
→ Admin approval

Seller
→ Admin approval

Logistics
→ Admin approval

Courier
→ Logistics approval
```

Courier is outside this Admin flow.

## 3. Registration Entry

```mermaid
flowchart TD
    A[Buyer / Seller / Logistics registers] --> B[Create role-account]
    B --> C[Registration status = PENDING]
    C --> D[Normal role access remains unavailable]
    D --> E[Admin Notifications may emit pending-registration alert]
    E --> F[Admin Account Registration queue]
```

## 4. Admin Queue

```mermaid
flowchart TD
    A[Admin opens Account Registrations] --> B[Authenticate Admin]
    B --> C{View permission?}
    C -->|No| D[Forbidden]
    C -->|Yes| E[Load PENDING Buyer/Seller/Logistics]
    E --> F[Search/filter/paginate]
    F --> G[Admin opens registration detail]
```

## 5. Approval Flow

```mermaid
flowchart TD
    A[Admin opens PENDING registration] --> B[Select Approve]
    B --> C[Show confirmation]
    C --> D[Submit approval]
    D --> E[Backend authenticate + authorize]
    E --> F[Resolve exact user/account ID]
    F --> G{Current status still PENDING?}
    G -->|No| H[Return conflict/current state]
    G -->|Yes| I[Atomic transition to APPROVED]
    I --> J[Record reviewed_by / reviewed_at]
    J --> K[Commit]
    K --> L[Emit Audit event]
    L --> M[Queue/send approval email]
    M --> N[Return committed APPROVED state]
```

## 6. Approval Result by Role

```text
Buyer APPROVED
→ eligible for normal Buyer sign-in

Seller APPROVED
→ eligible for normal Seller sign-in

Logistics APPROVED
→ eligible for Logistics sign-in
→ subscription step still required
```

Important:

```text
Logistics APPROVED
≠
Logistics SUBSCRIBED
```

## 7. Rejection Flow

```mermaid
flowchart TD
    A[Admin opens PENDING registration] --> B[Select Reject]
    B --> C[Enter reason if policy requires]
    C --> D[Confirm rejection]
    D --> E[Backend authenticate + authorize]
    E --> F[Resolve exact role-account]
    F --> G{Current status still PENDING?}
    G -->|No| H[Return conflict/current state]
    G -->|Yes| I[Atomic transition to REJECTED]
    I --> J[Record reviewer/time/reason]
    J --> K[Commit]
    K --> L[Emit Audit event]
    L --> M[Queue/send rejection email]
    M --> N[Return committed REJECTED state]
```

## 8. Same Email Across Roles

```text
alex@example.com + BUYER = PENDING
alex@example.com + SELLER = PENDING
```

Admin approves Seller:

```text
SELLER → APPROVED
BUYER → remains PENDING
```

Decision target is the exact account ID.

## 9. Concurrent Admin Decision

```mermaid
flowchart TD
    A[Admin A opens PENDING] --> C[Same registration]
    B[Admin B opens PENDING] --> C
    C --> D[Admin A submits APPROVE]
    D --> E[Atomic PENDING → APPROVED]
    E --> F[Commit succeeds]

    C --> G[Admin B submits REJECT]
    G --> H{Status still PENDING?}
    H -->|No| I[Conflict: already APPROVED]
```

Only one final transition wins.

## 10. Email Delivery Boundary

Brevo is only the delivery transport.

```text
AISLEY
    owns approval/rejection decision

Brevo
    delivers the resulting email
```

Brevo never changes:

```text
PENDING
APPROVED
REJECTED
```

## 11. Email Failure Flow

```mermaid
flowchart TD
    A[Decision committed in AISLEY] --> B[Queue email job]
    B --> C[Shared Brevo email service]
    C --> D{Brevo accepts delivery?}
    D -->|Yes| E[Record/finish delivery attempt]
    D -->|No| F[Keep committed registration state]
    F --> G[Log/retry according to policy]
```

Never:

```text
Brevo failure
→ roll back APPROVED / REJECTED
```

## 12. Approval Email Handoff

```text
APPROVED committed
→ queue email
→ shared Brevo integration
→ approval email
→ applicant inbox
```

For Logistics:

```text
APPROVED
≠
SUBSCRIBED
```

The message must not claim subscription is active.

## 13. Rejection Email Handoff

```text
REJECTED committed
→ queue email
→ shared Brevo integration
→ rejection email
→ applicant inbox
```

Reason/resubmission wording depends on future policy.

## 14. No Push/SMS Dependency

Manage Account Registrations does not require:

```text
Firebase
Twilio
AWS SNS
Push provider
SMS gateway
```

Current external dependency:

```text
Brevo for email delivery
```

## 13. Dashboard Handoff

```text
PENDING registration created
→ Dashboard Pending Registrations count increases

PENDING → APPROVED/REJECTED
→ pending count eventually decreases
```

Count includes:

```text
Buyer
Seller
Logistics
```

not Courier.

## 14. Admin Notifications Handoff

```text
new Admin-owned registration
→ ACCOUNT_REGISTRATION_PENDING event
→ Admin Notifications
→ deep link to registration
```

The decision remains owned by Manage Account Registrations.

## 15. Audit Handoff

```text
approval/rejection commits
→ safe Audit event
→ System Audit Logs records:
   Admin actor
   target user ID
   role
   previous status
   new status
   timestamp
```

No credentials/secrets.

## 16. Login Handoff

```text
PENDING
→ normal role access denied

REJECTED
→ normal role access denied

APPROVED
→ normal role access may proceed
   subject to role-specific requirements
```

For Logistics:

```text
APPROVED
→ sign in
→ subscription requirement
```

## 17. Invalid Re-Decision

```text
APPROVED
→ reject request arrives
→ reject as invalid/stale transition

REJECTED
→ approve request arrives
→ reject as invalid/stale transition
```

A future reconsideration workflow would need separate requirements.

## 18. Complete Flow

```mermaid
flowchart TD
    A[Buyer/Seller/Logistics registers] --> B[PENDING]
    B --> C[Admin queue]
    C --> D[Admin reviews]
    D --> E{Decision}

    E -->|Approve| F[Atomic APPROVED]
    E -->|Reject| G[Atomic REJECTED]

    F --> H[Audit approval]
    G --> I[Audit rejection]

    H --> J[Queue approval email to Brevo]
    I --> K[Queue rejection email to Brevo]

    J --> L[Eligible for role access]
    K --> M[Normal role access denied]

    L --> N{Role = Logistics?}
    N -->|Yes| O[Subscription still required]
    N -->|No| P[Continue normal role use]
```

## 19. Open Flow Decisions

The exact flow still depends on:

- rejection-reason policy
- rejected-registration resubmission
- reconsideration/reopen flow
- email retry/resend UI
- exact login error for PENDING/REJECTED
- optional additional Seller/Logistics review data
- any future KYC/document-verification process
