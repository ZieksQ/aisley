# APUE Admin Requirements and Implementation Scope

**Current date:** 2026-08-28  
**Scope:** Current AISLEY Admin application and the Admin Dashboard work that is supported by already implemented domains.

## Current Decision

The Admin Dashboard must remain a scaffold for now. The items under **Can Be Implemented Now** describe technically ready follow-up work, but they must not be added until explicitly requested.

The missing Logistics role and Logistics registration count are intentionally excluded from this document's current scope.

## Pending Registrations KPI

KPI means **Key Performance Indicator**. On the Dashboard, the Pending Registrations KPI would be a summary card showing how many Admin-owned applications still need review.

Current count definition:

```text
Pending Registrations
= pending Customer applications
+ pending Seller applications
```

Example:

```text
Pending Registrations: 12
Customers: 7
Sellers: 5
```

Expected behavior:

- Count only registration applications whose status is `pending`.
- Include only Customer and Seller applications.
- Exclude approved and rejected applications.
- Exclude Courier applications because Admin does not own Courier approval.
- Omit Logistics registrations from the current scope.
- Obtain the count from a backend aggregate, not by counting a partial frontend list.
- Require the `registrations.view` permission.
- Never show an unauthorized count as zero, because zero would incorrectly imply that no work exists.
- Link to `/registrations?status=pending` when the Admin is authorized.
- Display zero as a valid state, such as `No pending registrations`.

The KPI summarizes workload only. It must not approve or reject an application directly.

## Registration Action Center

The Action Center would show a short, bounded list of pending applications that the Admin may want to review next. It answers **which applications need attention**, while the KPI answers **how many applications need attention**.

Example:

```text
Registration Action Center
- Customer application submitted 2 hours ago — Review
- Seller application submitted yesterday — Review
- Seller application submitted 2 days ago — Review
```

Expected behavior:

- Use the existing registration applications as the source of truth.
- Show only a small bounded number of pending items.
- Use an explicit, predictable ordering such as oldest submitted first.
- Show only safe summary information, such as application type and submission time.
- Do not expose uploaded documents, addresses, phone numbers, or other unnecessary personal information.
- Link each item to the authoritative registration review screen.
- Require the `registrations.view` permission.
- Keep approval and rejection actions inside the Account Registrations feature.
- Refresh after an application is approved or rejected so completed work disappears from the list.

## Currently Implemented Features

### Admin Authentication

- Sanctum stateful session authentication with CSRF protection.
- Admin-only role lookup and active-account enforcement.
- Login throttling and generic invalid-credential responses.
- Session restoration and secure logout.
- Protected Admin routes.
- Shared local/testing Admin account seeded as `admin@test.com`.
- Successful active-Admin login auditing.

### Dashboard Scaffold

- Protected `/dashboard` route.
- Responsive Admin layout and sidebar.
- Light and dark themes.
- Authenticated Admin greeting.
- Permission-aware Account Registrations shortcut.
- Placeholder cards for future operational features.

### Account Registrations

- Customer and Seller registration queue.
- Pending, approved, and rejected filters.
- Customer and Seller filters.
- Search, sorting, and pagination.
- Registration detail view.
- Permission-gated approval and rejection.
- Optional rejection reason.
- Reviewer and review timestamp recording.
- Queued applicant email notifications.
- Audit events for registration decisions.

### System Audit Logs

- Permission-gated audit log list and detail pages.
- Search, filtering, sorting, and pagination.
- Historical actor and target snapshots.
- Structured before-and-after changes.
- Request and event metadata.
- Append-only audit records.
- Queued audit persistence and scheduled recovery.
- Successful Admin login events, including identification of the currently signed-in Admin as `You`.

### Development Support

- Root `pnpm dev` starts the API, Admin frontend, queue worker, and scheduler with the other configured applications.
- The queue worker processes queued notifications and audit events.
- The scheduler recovers pending audit outbox events.

## Can Be Implemented Now

The following Dashboard work can use existing data and does not require unfinished marketplace domains:

1. **Permission-aware Dashboard API**
   - Add a bounded authenticated endpoint such as `GET /api/v1/admin/dashboard`.
   - Return only sections the current Admin is authorized to see.

2. **Pending Registrations KPI**
   - Return the total pending Customer and Seller registration count.
   - Optionally include separate Customer and Seller counts.

3. **Registration Action Center**
   - Return a small safe preview of pending applications.
   - Link each item to its registration review screen.

4. **Pending Registration Deep Link**
   - Link the KPI to `/registrations?status=pending`.

5. **Widget States**
   - Add loading, empty, error, and retry states.
   - Preserve the Dashboard navigation shell when a request fails.

6. **Refresh Behavior**
   - Refetch when returning to the Dashboard.
   - Refresh after approval or rejection.
   - Optionally show a generated-at or last-updated timestamp.

7. **Backend Coverage**
   - Test guest and non-Admin denial.
   - Test active Admin access.
   - Test permission-limited responses.
   - Test Customer and Seller counts.
   - Test exclusion of approved, rejected, and Courier applications.
   - Test bounded previews and personal-information minimization.

8. **Frontend Coverage After Test-Tool Approval**
   - Test loading, zero, error, and retry states.
   - Test permission-aware visibility and registration navigation.
   - Test responsive and keyboard-accessible behavior.
   - A frontend testing dependency must not be added without explicit approval.

## Technically Possible but Not Currently Required

These values could be calculated from existing tables, but their business purpose and Dashboard placement are not finalized:

- Total Customer accounts.
- Total Seller accounts.
- Active, disabled, or pending account totals.
- A recent Admin audit-activity preview.
- Additional quick links to Account Registrations and System Audit Logs.

Do not add these merely because the data exists. Their metric definitions and value to Admins should be approved first.

## Do Not Implement Yet

The following Dashboard features depend on authoritative domains that have not been implemented:

- Seller Compliance workload or compliance actions.
- Complaints and Disputes counts or previews.
- Platform Commission or revenue calculations.
- Logistics subscription revenue.
- Per-order platform fees.
- Order activity, delivery counts, or order charts.
- Admin Notifications preview or unread count.
- A complete multi-feature Action Center.
- Revenue, order, or marketplace trend charts.
- Real-time notification polling, WebSockets, or Server-Sent Events.
- Technical infrastructure-health metrics.

The Dashboard must not invent placeholder values or business formulas for these features.

## Dashboard Actions That Must Remain Outside the Dashboard

Even after Dashboard widgets are implemented, the Dashboard should summarize and navigate. It should not directly:

- Approve or reject registrations.
- Suspend or restore users.
- Apply Seller sanctions.
- Resolve complaints or disputes.
- Modify financial records.
- Publish announcements.
- Send notification campaigns.
- Modify Audit Log records.

Those actions belong to their authoritative Admin feature screens.

## Recommended First Dashboard Increment

When Dashboard implementation is authorized, the safest first increment is:

```text
Authenticated Dashboard API
→ permission-aware Pending Registrations KPI
→ Customer/Seller breakdown
→ bounded Registration Action Center
→ deep links to Account Registrations
→ loading, empty, error, and refresh states
→ backend tests
```

This increment uses existing Account Registrations data, avoids unfinished domains, and preserves the Dashboard's role as an overview and navigation surface.
