# Manage Platform Settings Flow

**System:** AISLEY  
**Feature:** Manage Platform Settings  
**Status:** Draft  
**Basis:** `Admin.md`, `app.md`, `specs.md`

## 1. Purpose

This file contains the sequence/state behavior for:

- announcement drafting/publishing
- announcement archive
- policy version publication
- re-consent activation
- user policy acceptance
- Audit Log and feed handoffs

## 2. Announcement Flow

```mermaid
flowchart TD
    A[Admin creates announcement] --> B[DRAFT]
    B --> C[Edit / preview]
    C --> D[Publish]
    D --> E{Valid and authorized?}
    E -->|No| F[Keep DRAFT / show error]
    E -->|Yes| G[PUBLISHED]
    G --> H[Record publisher + time]
    H --> I[Audit publication]
    I --> J[Expose in user dashboard/feed]
    J --> K[Optional ARCHIVE]
```

Recommended lifecycle:

```text
DRAFT → PUBLISHED → ARCHIVED
```

Archive is optional but useful.

## 3. Announcement Publish Boundary

```text
PUBLISHED announcement
→ appears in dashboard/feed
```

Not:

```text
PUBLISHED announcement
→ automatically Push/SMS every user
```

Push Notification Management is separate.

## 4. Announcement Archive

If supported:

```mermaid
flowchart TD
    A[PUBLISHED] --> B[Admin selects Archive]
    B --> C[Confirm]
    C --> D[ARCHIVED]
    D --> E[Remove from active feed]
    E --> F[Keep historical record]
    F --> G[Audit]
```

## 5. Policy Draft Flow

```mermaid
flowchart TD
    A[Admin selects policy type] --> B[Create new draft version]
    B --> C[Edit content]
    C --> D[Preview]
    D --> E[Choose requires re-consent yes/no]
    E --> F[Ready to publish]
```

Policy types:

```text
Terms of Service
Privacy Policy
Internal Rules
```

## 6. Policy Publish Flow

```mermaid
flowchart TD
    A[Publish policy draft] --> B[Authenticate + authorize]
    B --> C[Validate draft/version]
    C --> D{Still publishable?}
    D -->|No| E[Conflict/error]
    D -->|Yes| F[Atomic publication transaction]
    F --> G[Mark version PUBLISHED/current]
    G --> H[Preserve previous published version]
    H --> I[Persist requires_reconsent flag]
    I --> J[Audit publication]
    J --> K[Invalidate current-policy cache]
```

Recommended:

```text
published version = immutable
```

Future edits create a new draft/version.

## 7. Re-Consent Activation

If:

```text
requires_reconsent = true
```

then:

```text
new published policy version
→ becomes required version
→ affected users do not need synchronous row updates
→ next authenticated session checks consent
```

## 8. User Re-Consent Check

```mermaid
flowchart TD
    A[User authenticates / restores session] --> B[Load required current policy versions]
    B --> C[Load user's accepted versions]
    C --> D{Missing required acceptance?}
    D -->|No| E[Continue normal application]
    D -->|Yes| F[Show required policy]
    F --> G[User reviews]
    G --> H{Accepts?}
    H -->|Yes| I[Persist user_id + policy_version_id + accepted_at]
    I --> J[Re-check remaining required policies]
    J --> C
    H -->|No| K[Apply configured decline/blocking policy]
```

Exact decline/blocking behavior is Open.

## 9. Role-Aware Consent

Example:

```text
alex@example.com + BUYER
alex@example.com + SELLER
```

If Buyer accepts:

```text
Buyer consent stored
Seller consent unchanged
```

Consent target:

```text
authenticated user_id
```

not email.

## 10. Multiple Required Policies

```text
Terms v3 requires consent
Privacy v5 requires consent
```

User flow:

```text
check outstanding versions
→ accept required version(s)
→ continue only according to selected blocking policy
```

Exact ordering is Open.

## 11. Consent Idempotency

```text
same user_id + same policy_version_id
→ repeated accept request
→ no inconsistent duplicate
```

## 12. Feed Handoff

```text
announcement publication commits
→ announcement query/feed cache invalidated
→ user dashboard/feed can retrieve published content
```

Feed failure does not roll back the durable published state.

## 13. Push Notification Handoff

Optional separate action:

```text
published announcement
→ Admin chooses Create Push Campaign
→ Push Notification Management
```

No automatic broadcast.

## 14. Audit Handoff

```text
announcement/policy mutation commits
→ safe Audit event
→ System Audit Logs stores:
   Admin actor
   content ID/version
   action
   before/after status
   requires_reconsent flag where applicable
   timestamp
```

Do not duplicate full policy bodies into Audit Logs by default.

## 15. Concurrent Publish

```mermaid
flowchart TD
    A[Admin A publishes draft] --> C[Policy type]
    B[Admin B publishes another draft] --> C
    C --> D[Atomic current-version check]
    D --> E{Conflict?}
    E -->|No| F[One version becomes current]
    E -->|Yes| G[Return conflict / reload current state]
```

The system must never leave two ambiguous current versions.

## 16. Publication Failure

```text
validation/transaction fails
→ remain draft/unpublished
→ do not show user-facing published state
```

## 17. Re-Consent Processing Failure

Recommended durable model:

```text
published policy version
+ requires_reconsent
+ user consent records
```

Therefore a temporary queue/cache failure does not erase the requirement.

## 18. Complete Flow

```mermaid
flowchart TD
    A[Authorized Admin] --> B[Platform Settings]
    B --> C{Content Type}

    C -->|Announcement| D[Create/Edit DRAFT]
    D --> E[Publish]
    E --> F[PUBLISHED]
    F --> G[Audit]
    G --> H[User dashboard/feed]

    C -->|Policy| I[Create new policy draft/version]
    I --> J[Edit + preview]
    J --> K[Select re-consent setting]
    K --> L[Publish atomically]
    L --> M[New current PUBLISHED version]
    M --> N[Audit]

    N --> O{Requires re-consent?}
    O -->|No| P[Users continue normally]
    O -->|Yes| Q[Next authenticated session]
    Q --> R[Compare required vs accepted version]
    R --> S{Accepted?}
    S -->|Yes| P
    S -->|No| T[Show policy consent UI]
    T --> U[Record acceptance]
    U --> R
```

## 19. Open Flow Decisions

The exact flow still depends on:

- announcement archive support
- published-announcement editing/revisions
- scheduling/expiry
- internal-rules visibility
- exact active-user definition
- which roles require policy consent
- re-consent blocking behavior
- decline behavior
- grace periods
- multiple-policy ordering
- policy rollback
- whether publication requires second-Admin approval
- user notification channels beyond the dashboard/feed
