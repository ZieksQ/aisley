# Manage Complaints and Disputes Flow

**System:** AISLEY  
**Feature:** Manage Complaints and Disputes  
**Status:** Draft  
**Basis:** `Admin.md`, `specs.md`

## 1. Purpose

This file contains the sequence/state behavior for:

- complaint intake
- evidence handling
- Admin review
- requests for more information
- binding decision
- resolution/closure
- feature handoffs
- Audit Log integration
  Exact database status names remain Open because the source does not define them.

## 2. High-Level Case Flow

```mermaid
flowchart TD
    A[User submits report / complaint] --> B[Create complaint case]
    B --> C[Persist complaint + evidence references]
    C --> D[Admin Notification / Dashboard workload]
    D --> E[Admin opens case]
    E --> F[Review parties, context, evidence, history]
    F --> G{Enough information?}
    G -->|No| H[Request more information]
    H --> I[Party responds / adds evidence]
    I --> F
    G -->|Yes| J[Admin records binding decision]
    J --> K[Commit case decision]
    K --> L[Append case history + Audit event]
    L --> M[Notify involved party/parties]
    M --> N[Resolved / closed according to case policy]
```

## 3. Logical State Progression

Source-backed logical stages:

```text
submitted
→ Admin review
→ binding decision
→ resolved
```

Exact enums such as:

```text
OPEN
IN_REVIEW
RESOLVED
CLOSED
```

are not mandated until implementation chooses them.

## 4. Complaint Intake

```mermaid
flowchart TD
    A[Authenticated user reports issue] --> B[Validate complaint]
    B --> C[Resolve submitter user_id + role]
    C --> D[Resolve related order/product/user if provided]
    D --> E[Persist complaint case]
    E --> F[Persist evidence metadata/files]
    F --> G[Case becomes available to Admin]
    G --> H[Admin Notification may be created]
```

## 5. Evidence Upload

```text
user submits file
→ validate type/size
→ generate safe storage key
→ store privately
→ create evidence record linked to case
→ evidence becomes visible only through authorized retrieval
```

If storage fails:

```text
do not report evidence as attached
```

## 6. Admin Queue

```mermaid
flowchart TD
    A[Admin opens Complaints] --> B[Authenticate Admin]
    B --> C{View permission?}
    C -->|No| D[Forbidden]
    C -->|Yes| E[Load actionable cases]
    E --> F[Search/filter/paginate]
    F --> G[Open case detail]
```

## 7. Admin Review

```text
case detail
→ inspect complaint
→ inspect exact role-aware parties
→ inspect related entity
→ inspect evidence
→ inspect message/action history
→ determine whether information is sufficient
```

## 8. Request More Information

Recommended:

```mermaid
flowchart TD
    A[Admin needs clarification] --> B[Select Message Party / Request Info]
    B --> C[Resolve exact role-account]
    C --> D[Open/create Admin Chat thread linked to case]
    D --> E[Admin sends question]
    E --> F[Party replies]
    F --> G[Link message/reference to case history]
    G --> H[Admin resumes review]
```

Messaging does not resolve the case.

## 9. Separate Party Privacy

For a two-party dispute:

```text
Admin ↔ Complainant
Admin ↔ Respondent
```

Use separate direct conversations unless future requirements explicitly permit a shared thread.

## 10. Decision Flow

```mermaid
flowchart TD
    A[Admin ready to decide] --> B[Enter decision summary/reason]
    B --> C[Confirm binding decision]
    C --> D[Backend authenticate + authorize]
    D --> E[Verify case is still decision-eligible]
    E --> F{Another final decision already committed?}
    F -->|Yes| G[Return conflict/current decision]
    F -->|No| H[Persist decision atomically]
    H --> I[Record deciding Admin + time]
    I --> J[Append case history]
    J --> K[Emit System Audit event]
    K --> L[Notify involved party/parties]
```

## 11. Concurrent Admin Review

```mermaid
flowchart TD
    A[Admin A reviews case] --> C[Same case]
    B[Admin B reviews case] --> C
    C --> D[Admin A submits final decision]
    D --> E[Decision commits]
    C --> F[Admin B submits different final decision]
    F --> G{Case still decision-eligible?}
    G -->|No| H[Conflict: show committed decision]
```

Do not silently overwrite.

## 12. Decision Notification Failure

```text
decision commits
→ external notification attempted
→ notification fails
→ keep binding decision
→ retry/log notification according to policy
```

Do not roll back the decision solely because notification delivery failed.

## 13. Complaint → Seller Compliance

If findings indicate Seller compliance action may be needed:

```text
Complaint decision/findings
→ explicit handoff to Seller Compliance
→ separate authorization/action
→ Compliance owns sanction state
```

No automatic suspension/product removal.

## 14. Complaint → Manage User Accounts

If an account action is warranted:

```text
Complaint case
→ explicit Manage User Accounts action
→ separate confirmation
→ account lifecycle feature owns suspension/deactivation
```

## 15. Complaint → Global Ban

```text
Complaint case
→ explicit Create Blocklist Entry
→ Global Ban permission/confirmation
→ Blocklist owns security restriction
```

No automatic ban.

## 16. Complaint → Financial Action

Current source does not define refund/compensation behavior.
Therefore:

```text
Complaint decision
≠
automatic refund
```

Any future financial operation must use a separately defined payment/refund flow.

## 17. Complaint → Order

```text
Complaint decision
≠
automatic order status mutation
```

Order/logistics state remains owned by its domain.

## 18. Audit Handoff

```text
binding Admin action commits
→ safe Audit event emitted
→ System Audit Logs records:
   Admin actor
   case ID
   action
   safe decision reference
   timestamp
```

Evidence binaries are not copied into Audit Logs.

## 19. Dashboard Handoff

```text
new actionable complaint
→ Dashboard Open Complaints may increase

case becomes non-actionable/resolved
→ Dashboard count eventually decreases
```

Exact actionable definition belongs to Complaints.

## 20. Admin Notification Handoff

```text
new complaint
→ Admin Notifications
→ safe complaint preview
→ deep link to case
```

The notification is not the case itself.

## 21. Resolved Case

After binding resolution:

```text
case remains historically retrievable
→ evidence remains subject to retention policy
→ messages/actions remain traceable
→ decision remains visible
```

Hard deletion is not the normal resolution path.

## 22. Complete Flow

```mermaid
flowchart TD
    A[User complaint] --> B[Case created]
    B --> C[Evidence stored securely]
    C --> D[Admin workload / notification]
    D --> E[Admin review]

    E --> F{Need more info?}
    F -->|Yes| G[Message relevant party]
    G --> H[Reply / additional evidence]
    H --> E

    F -->|No| I[Compose binding decision]
    I --> J[Atomic decision commit]
    J --> K[Case history]
    K --> L[Audit Log]
    L --> M[Notify parties]
    M --> N[Resolved/closed]

    J --> O{Separate action required?}
    O -->|Compliance| P[Seller Compliance]
    O -->|Account| Q[Manage User Accounts]
    O -->|Security| R[Global Ban]
    O -->|None| N
```

## 23. Open Flow Decisions

The exact flow still depends on:

- exact case status enum
- complaint submission roles
- user-facing submission entry points
- decision vs closure distinction
- appeal/reopen
- party notification channel
- internal notes
- case assignment
- priority/SLA
- evidence retention
- financial/refund integration
- exact complaint-to-compliance/account/security handoff rules
