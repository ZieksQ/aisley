# Monitor Seller Compliance Flow

**System:** AISLEY  
**Feature:** Monitor Seller Compliance  
**Status:** Draft  
**Basis:** `Admin.md`, `Seller.md`, `app.md`, `specs.md`

## 1. Purpose

This file contains the sequence/state behavior for:

- internal flags/reports
- Seller/product review
- formal warning
- temporary compliance suspension
- permanent product removal
- no-violation resolution
- listing-visibility cascade
- Messaging and Audit handoffs

## 2. High-Level Flow

```mermaid
flowchart TD
    A[Flag / report / verification need] --> B[Compliance item]
    B --> C[Admin review]
    C --> D[Inspect Seller, product, policy context, history]
    D --> E{Finding}

    E -->|No violation| F[Resolve without sanction]
    E -->|Warning| G[Record formal warning]
    E -->|Seller-level violation| H[Apply temporary compliance suspension]
    E -->|Product violation| I[Remove non-compliant product]

    G --> J[Message Seller]
    H --> K[Hide/restrict Seller listings]
    H --> J
    I --> L[Block product from buyer discovery/checkout]
    I --> J

    F --> M[Audit / close case]
    J --> M
    K --> M
    L --> M
```

## 3. Compliance Review

```text
Admin opens actionable item
→ exact Seller user ID resolved
→ product ID resolved if applicable
→ review report/flag
→ inspect product
→ inspect Seller history
→ compare against platform policy
→ choose explicit outcome
```

## 4. No Violation

```mermaid
flowchart TD
    A[Admin review] --> B[No violation found]
    B --> C[Record finding]
    C --> D[Resolve/close compliance item]
    D --> E[Audit if required]
```

No Seller/product restriction is applied.

## 5. Warning

```mermaid
flowchart TD
    A[Violation warrants warning] --> B[Enter finding/reason]
    B --> C[Confirm warning]
    C --> D[Persist warning]
    D --> E[Audit warning]
    E --> F[Open/create Admin Chat thread]
    F --> G[Send official warning/explanation]
    G --> H[Link message/thread to compliance case]
```

Messaging failure does not erase the committed warning.

## 6. Temporary Seller Compliance Suspension

```mermaid
flowchart TD
    A[Admin selects Suspend Seller] --> B[Enter reason]
    B --> C[Confirm]
    C --> D[Authenticate + authorize]
    D --> E[Check current compliance state]
    E --> F{Can apply suspension?}
    F -->|No| G[Conflict/current state]
    F -->|Yes| H[Persist compliance suspension]
    H --> I[Activate Seller-level marketplace restriction]
    I --> J[Products become hidden/restricted]
    J --> K[Checkout blocks new purchases]
    K --> L[Audit]
    L --> M[Message Seller]
```

## 7. Suspension Cascade

Recommended scalable model:

```text
Seller compliance_suspended = true
→ product/search query excludes Seller listings
→ product detail enforces restriction
→ cart/checkout validates restriction
```

This avoids requiring destructive deletion of all Seller products.

## 8. Existing Orders

```text
compliance suspension applied
→ existing order records remain unchanged
→ no automatic cancellation/refund
```

Operational handling is a separate policy decision.

## 9. Permanent Product Removal

```mermaid
flowchart TD
    A[Admin selects Remove Product] --> B[Validate product belongs to Seller]
    B --> C[Enter reason]
    C --> D[Confirm permanent compliance removal]
    D --> E[Persist product compliance removal]
    E --> F[Exclude product from discovery]
    F --> G[Block new checkout]
    G --> H[Preserve historical references]
    H --> I[Audit]
    I --> J[Message Seller if required]
```

Removing one product does not automatically suspend the Seller.

## 10. Vacation Mode Independence

```text
Vacation Mode = Seller-controlled
Compliance Suspension = Admin-controlled
```

Example:

```text
Vacation Mode ON
Compliance Suspension ON

Seller turns Vacation Mode OFF
→ Compliance Suspension remains ON
→ Listings remain restricted
```

## 11. Manage User Accounts Independence

```text
Account lifecycle SUSPENDED
+
Compliance SUSPENDED
```

If compliance restriction is removed:

```text
Account lifecycle remains SUSPENDED
```

## 12. Global Ban Independence

```text
Global Ban ACTIVE
+
Compliance SUSPENDED
```

If compliance restriction is removed:

```text
Global Ban remains ACTIVE
```

## 13. Complaint Handoff

```mermaid
flowchart TD
    A[Seller-related complaint] --> B[Admin finds compliance issue]
    B --> C[Explicit Create/Open Compliance Case]
    C --> D[Reference complaint/evidence]
    D --> E[Run normal compliance review]
```

Complaint does not automatically impose sanction.

## 14. Global Ban Handoff

If severity warrants separate security action:

```text
Compliance case
→ explicit Global Ban action
→ separate authorization/confirmation
→ Blocklist feature owns ban
```

## 15. Messaging Handoff

```text
compliance action commits
→ Admin Chat warning/explanation
→ thread/message reference linked to case
```

Message itself is not the authoritative sanction.

## 16. Audit Handoff

```text
warning / suspension / product removal / resolution
→ mutation commits
→ safe Audit event
→ System Audit Logs records:
   Admin actor
   Seller ID
   product ID if applicable
   case ID
   action
   timestamp
```

## 17. Dashboard Handoff

```text
new actionable compliance item
→ Dashboard Seller Compliance count increases

case resolved/non-actionable
→ count eventually decreases
```

Exact actionable definition belongs to this feature.

## 18. Concurrent Review

```mermaid
flowchart TD
    A[Admin A opens case] --> C[Same compliance item]
    B[Admin B opens case] --> C

    C --> D[Admin A applies action]
    D --> E[Action commits]

    C --> F[Admin B submits stale action]
    F --> G[Backend checks current case/version]
    G --> H[Return conflict/current state]
```

No silent stale overwrite.

## 19. Complete Flow

```mermaid
flowchart TD
    A[Flag/report] --> B[Admin queue]
    B --> C[Review Seller/product/history]
    C --> D{Outcome}

    D -->|No violation| E[Resolve]
    D -->|Warning| F[Persist warning]
    D -->|Suspend Seller| G[Compliance suspension]
    D -->|Remove product| H[Product compliance removal]

    F --> I[Admin Chat warning]
    G --> J[Seller-level listing restriction]
    J --> I
    H --> K[Product hidden + checkout blocked]
    K --> I

    E --> L[Audit / close]
    I --> L
```

## 20. Open Flow Decisions

The exact flow still depends on:

- exact compliance-case statuses
- suspension duration/expiry
- Seller access while suspended
- existing-order fulfillment policy
- product reinstatement policy
- exact listing/search cascade implementation
- case assignment/priority/SLA
- Seller appeal/review process
- complaint-to-compliance handoff rules
- compliance-to-Global-Ban policy
