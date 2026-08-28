# Reports Overview Flow
**System:** AISLEY  
**Feature:** Reports Overview  
**Status:** Draft  
**Basis:** `Admin.md`, `app.md`, `specs.md`
## 1. Purpose
The main Reports Overview page is read/aggregation oriented.
This file exists primarily for the stateful asynchronous export path:
- report query
- export request
- queueing
- background generation
- completion/failure
- secure download
## 2. Interactive Report Query
```mermaid
flowchart TD
    A[Admin opens Reports Overview] --> B[Authenticate Admin]
    B --> C{Financial report permission?}
    C -->|No| D[Forbidden]
    C -->|Yes| E[Select Daily / Weekly / Monthly]
    E --> F[Resolve reporting boundaries]
    F --> G[Query authoritative revenue sources]
    G --> H[Aggregate subscription revenue]
    G --> I[Aggregate applicable per-order platform fees]
    H --> J[Total Platform Revenue]
    I --> J
    J --> K[Return summary + trend + bounded records]
```
## 3. Revenue Calculation
```text
Logistics subscription revenue
+
applicable per-order platform fee revenue
=
AISLEY Platform Revenue
```
Never include:
```text
default ₱50 shipping fee
```
## 4. Dashboard Handoff
```text
Dashboard Platform Commission
→ same PlatformRevenueReportService/calculation
→ same period/filter
→ same result subject to cache freshness
```
## 5. Export Request
```mermaid
flowchart TD
    A[Admin selects Export] --> B[Choose CSV/PDF]
    B --> C[Use current report filters]
    C --> D[Submit export request]
    D --> E[Authenticate + authorize]
    E --> F[Validate period/format]
    F --> G[Create export record]
    G --> H[Status = QUEUED]
    H --> I[Commit]
    I --> J[Enqueue background job]
    J --> K[Return export ID/status]
```
The HTTP request does not wait for the full export.
## 6. Background Generation
```mermaid
flowchart TD
    A[Export worker starts] --> B[Set PROCESSING]
    B --> C[Run same report query/service]
    C --> D[Stream/chunk contributing rows]
    D --> E[Generate CSV/PDF]
    E --> F[Store secure file]
    F --> G{Success?}
    G -->|Yes| H[Set COMPLETED + file metadata]
    G -->|No| I[Set FAILED + safe error]
```
## 7. Export State
Recommended:
```text
QUEUED
→ PROCESSING
→ COMPLETED
```
or:
```text
QUEUED
→ PROCESSING
→ FAILED
```
Exact state names are Open.
## 8. Export Consistency
```text
screen report filters
=
export filters
```
and:
```text
screen revenue logic
=
export revenue logic
```
Do not maintain a separate export formula.
## 9. Export Completion Notification
Optional:
```text
export COMPLETED/FAILED
→ Admin Notifications
→ deep link to export/report
```
This is recommended for long-running jobs but not source-required.
## 10. Secure Download
```mermaid
flowchart TD
    A[Admin opens completed export] --> B[Request download]
    B --> C[Authenticate Admin]
    C --> D[Authorize financial export access]
    D --> E{Export belongs to accessible scope and COMPLETED?}
    E -->|No| F[Deny]
    E -->|Yes| G[Generate authorized download response / signed URL]
    G --> H[Download file]
```
Possessing `exportId` or file URL is not sufficient authorization.
## 11. Export Failure
```text
generation fails
→ export = FAILED
→ no valid download
→ retain safe failure information
→ optional retry
```
## 12. Queue Failure
```text
export request validation succeeds
but queue insertion fails
→ do not claim export is processing successfully
→ return/recover with clear failed state
```
## 13. Large Dataset Handling
Recommended:
```text
query in chunks/stream
→ write export incrementally
→ avoid loading all financial records in memory
```
## 14. Audit Handoff
Recommended:
```text
export requested
→ safe Audit event

export downloaded
→ optional safe Audit event
```
Audit contains:
```text
Admin actor
export ID
format
period/filter
timestamp
```
not full report content.
## 15. Complete Flow
```mermaid
flowchart TD
    A[Authorized Admin] --> B[Reports Overview]
    B --> C[Select Daily/Weekly/Monthly]
    C --> D[Aggregate authoritative revenue]
    D --> E[Display totals/breakdown]

    E --> F{Export?}
    F -->|No| G[Continue interactive reporting]
    F -->|Yes| H[Choose CSV/PDF]
    H --> I[Create QUEUED export]
    I --> J[Background worker]
    J --> K[PROCESSING]
    K --> L[Generate using same report service]
    L --> M{Result}
    M -->|Success| N[COMPLETED]
    M -->|Failure| O[FAILED]
    N --> P[Authorized secure download]
```
## 16. Open Flow Decisions
The exact flow still depends on:
- whether CSV and PDF are both MVP
- export queue technology
- export file storage
- export retry policy
- export retention/expiry
- Admin Notification on completion/failure
- download Audit logging
- exact revenue-recognition rules
