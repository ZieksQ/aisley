# Admin Chat / Messaging Flow

**System:** AISLEY  
**Feature:** Admin Chat / Messaging  
**Status:** Draft  
**Basis:** `Admin.md`, related role messaging sources, `specs.md`

---

## 1. Purpose

This file contains the sequence-heavy behavior removed from `specs.md`.

It covers:

- opening the Admin inbox
- initiating a thread
- replying to a thread
- read receipts
- unread state
- real-time delivery/recovery
- compliance and complaint handoffs
- archive behavior if implemented

---

## 2. Inbox Entry

```mermaid
flowchart TD
    A[Admin opens Messages] --> B[Authenticate Admin]
    B --> C{Messaging permission?}
    C -->|No| D[Forbidden]
    C -->|Yes| E[Load accessible threads]
    E --> F[Load unread counts]
    F --> G[Render inbox]
```

---

## 3. Start New Thread

```mermaid
flowchart TD
    A[Admin selects New Message] --> B[Search/select user]
    B --> C[Show exact role-account]
    C --> D[Optional context]
    D --> E[Compose first message]
    E --> F[Submit]
    F --> G[Backend authenticates Admin]
    G --> H[Validate target role-account]
    H --> I[Validate context if provided]
    I --> J{Authorized/valid?}
    J -->|No| K[Reject]
    J -->|Yes| L[Create thread + first message]
    L --> M[Commit]
    M --> N[Emit realtime/user notification]
    N --> O[Open conversation]
```

Important:

```text
target = user_id + role context
not email alone
```

---

## 4. Existing Thread Reply

```mermaid
flowchart TD
    A[Admin opens thread] --> B[Backend verifies access]
    B --> C[Load paginated history]
    C --> D[Mark visible unread messages read]
    D --> E[Admin writes reply]
    E --> F[Submit message]
    F --> G[Validate + persist]
    G --> H[Commit]
    H --> I[Broadcast / notify user]
    I --> J[Show sent message]
```

---

## 5. User Reply

```mermaid
flowchart TD
    A[User opens authorized Admin thread] --> B[User writes reply]
    B --> C[Backend verifies participant]
    C --> D[Persist message]
    D --> E[Update thread activity]
    E --> F[Admin unread state increases]
    F --> G[Optional Admin Notification]
    G --> H[Realtime event / later API retrieval]
```

---

## 6. Read Receipt Flow

```mermaid
flowchart TD
    A[Recipient opens conversation] --> B[Identify unread visible messages]
    B --> C[Send read update]
    C --> D[Backend verifies participant]
    D --> E[Set read receipt / read_at]
    E --> F[Emit read event if realtime]
    F --> G[Sender UI shows Read]
```

Read updates are idempotent.

Opening the inbox alone should not automatically mark every thread read.

---

## 7. Same Email Across Roles

```text
alex@example.com + BUYER
alex@example.com + SELLER
```

Admin selects Seller:

```text
Seller user_id
    ↓
thread created for Seller account
    ↓
Buyer account has no participant access
```

---

## 8. Compliance Handoff

```mermaid
flowchart TD
    A[Admin opens Seller Compliance case] --> B[Select Message Seller]
    B --> C[Resolve Seller linked to case]
    C --> D[Open existing context thread or create new one]
    D --> E[Compose warning/explanation]
    E --> F[Persist message]
    F --> G[Link thread/message reference to compliance case]
    G --> H[Seller receives official message]
```

Messaging does not perform the suspension/removal itself.

---

## 9. Complaint Handoff

```mermaid
flowchart TD
    A[Admin opens Complaint case] --> B[Choose participant]
    B --> C[Open/create direct thread]
    C --> D[Request information or explain decision]
    D --> E[Persist message]
    E --> F[Reference message/thread from complaint timeline]
    F --> G[Participant can reply]
```

For multiple dispute parties:

```text
Admin ↔ Party A
Admin ↔ Party B
```

Use separate direct threads unless group chat is explicitly designed later.

---

## 10. Manage User Accounts Handoff

```text
User detail
    ↓
Message User
    ↓
exact role-account selected
    ↓
general/account-context Admin thread
```

---

## 11. Persistence Before Realtime

```text
authorize
    ↓
validate
    ↓
persist message
    ↓
commit transaction
    ↓
broadcast realtime event
    ↓
send optional notification
```

A realtime event is not the authoritative message store.

---

## 12. Broadcast Failure

```mermaid
flowchart TD
    A[Message committed] --> B[Realtime broadcast fails]
    B --> C[Keep stored message]
    C --> D[Log/retry transport event if applicable]
    D --> E[Recipient later refreshes/reconnects]
    E --> F[API returns stored message]
```

---

## 13. Persistence Failure

```text
message save fails
    ↓
do not broadcast as successful
    ↓
return send error
    ↓
keep draft available for retry
```

---

## 14. Reconnect Flow

```mermaid
flowchart TD
    A[Realtime connection drops] --> B[Messages may still be persisted]
    B --> C[Client reconnects]
    C --> D[Refetch latest thread messages]
    D --> E[Refetch read/unread state]
    E --> F[Resume realtime subscription]
```

---

## 15. Offline User

```text
Admin sends message
    ↓
message persists
    ↓
user offline
    ↓
unread state remains
    ↓
user returns
    ↓
thread loads message
```

---

## 16. Offline Admin

```text
user replies
    ↓
message persists
    ↓
Admin offline
    ↓
Admin unread state remains
    ↓
Admin returns
    ↓
inbox shows unread thread
```

---

## 17. Archive Flow

Only if archive is implemented:

```mermaid
flowchart TD
    A[Admin chooses Archive] --> B[Confirm/execute archive]
    B --> C[Thread removed from active inbox]
    C --> D[Messages remain stored]
    D --> E[Thread remains searchable/retrievable]
```

Archive never means hard delete.

---

## 18. Deactivated User

```text
user deactivated
    ↓
historical thread retained
    ↓
Admin may still read archive
    ↓
new-send ability follows account policy
```

---

## 19. Suspended User

Recommended but still Open:

```text
Seller suspended
    ↓
normal Seller operations restricted
    ↓
official compliance/support messaging may remain available
```

Exact limited-access policy must be decided separately.

---

## 20. Forbidden Access

```mermaid
flowchart TD
    A[Actor requests thread] --> B[Backend authenticates]
    B --> C{Participant / authorized Admin?}
    C -->|No| D[403 / not found according to policy]
    C -->|Yes| E[Return safe thread data]
```

Thread IDs never grant access by themselves.

---

## 21. Message Safety

```text
submitted text
    ↓
validate length/non-empty
    ↓
store as data
    ↓
escape/sanitize on render
    ↓
no script execution
```

---

## 22. Audit Handoff

For consequential Admin messaging actions:

```text
Admin message/thread action commits
    ↓
emit safe Audit event
    ↓
Audit stores:
    actor Admin
    action
    thread id
    message id
    target user
    context
    timestamp
```

Do not copy full message content into Audit Logs by default.

---

## 23. Admin Notification Handoff

```text
user reply
    ↓
Messaging stores message
    ↓
Admin unread state updates
    ↓
optional ADMIN_MESSAGE_RECEIVED event
    ↓
Admin Notifications creates alert
    ↓
deep link back to thread
```

---

## 24. Complete Flow

```mermaid
flowchart TD
    A[Authorized Admin] --> B[Messages Inbox]
    B --> C{New or Existing?}

    C -->|New| D[Select exact role-account]
    D --> E[Optional context]
    E --> F[Compose first message]
    F --> G[Create thread + persist]

    C -->|Existing| H[Open thread]
    H --> I[Load history + update reads]
    I --> J[Compose reply]
    J --> G

    G --> K[Commit]
    K --> L[Realtime / notification]
    L --> M[User receives message]
    M --> N[User opens thread]
    N --> O[Read receipt]
    N --> P[User replies]
    P --> Q[Persist reply]
    Q --> R[Admin unread / notification]
    R --> H
```

---

## 25. Open Flow Decisions

The exact flow still depends on:

- shared vs individually owned Admin threads
- user-initiated Admin support
- thread uniqueness rules
- exact read-receipt model
- archive behavior
- suspended/banned user access
- realtime provider
- duplicate-send/idempotency implementation
- external notification behavior
- attachment support
