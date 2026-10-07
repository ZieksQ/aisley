# Current reconciliation — 2026-10-07

Source baseline: `14776719d2c59a650467660b0f6c5e913141aacc` (`feat: add separate chat notifications`). Current findings were checked against canonical specifications, selected source, routes, and [app-wide progress](../PROGRESS.md).

The filename is retained for existing references. Use this current reconciliation and [plan.md](plan.md) for follow-up work. The historical review below is preserved unchanged; its old line numbers, missing-feature claims, and external Flutter file observations describe the earlier snapshot and are not current instructions.

## Earlier findings: current disposition

| Earlier finding | Current evidence/status |
| --- | --- |
| AISLEY 1: authentication instructions | Resolved. [Root instructions](../../AGENTS.md) and [architecture](../architecture.md) describe web sessions/CSRF, Courier scoped bearer tokens, and optional Customer device tokens. |
| AISLEY 2: inter-hub transfers | Resolved documentation drift. [Shipment fulfillment](../features/shared/shipment-fulfillment/spec.md) permits company-truck transfers between organizations' sole hubs; additional hubs within one organization remain deferred. |
| AISLEY 3: delivery/payment wording | Resolved documentation drift. Confirmed COD delivery marks the Order paid and recognizes Finance entries. [COD automation](../features/shared/cod-automation/spec.md) separately tracks platform invoices/clearing/payouts; [Courier cash reception](../features/logistics/courier-cash-remittance/spec.md) does not clear those invoices. Paid prepaid fulfillment creates no COD receivable and does not implement online checkout. |
| AISLEY 4: Courier login/protected denial mismatch | Resolved in source. Login and [Courier middleware](../../src/api/app/Http/Middleware/Courier/EnsureActiveCourier.php) both delegate account/affiliation denial to [CourierAccessService](../../src/api/app/Services/Courier/CourierAccessService.php). Current [Auth v2.6](../features/courier/auth/spec.md) owns the response mapping. |
| AISLEY 5: misleading recovery completion/email promise | Wording/checklist corrected; recovery itself remains open. [AuthController](../../src/api/app/Http/Controllers/Courier/AuthController.php) truthfully returns recovery unavailable, and current routes have no Courier reset-completion action. Carry actual recovery into plan 05. |
| AISLEY 6: duplicate Courier registration race | Resolved source handling. The controller translates the users email/role uniqueness violation into the documented field-addressable duplicate response after rollback/evidence cleanup; unrelated failures remain failures. Prior focused verification is recorded, not rerun here. |
| AISLEY 7–9: Admin stack, feature headers, missing maps-policy claim | Earlier corrections remain present in [Admin Auth](../features/admin/auth/spec.md), [Admin Account](../features/admin/admin-account-management/spec.md), [Seller Prepare Orders](../features/seller/prepare-orders/spec.md), and [Customer Address Book](../features/customer/address-book/spec.md). The [maps policy](../maps-location-api.md) exists. Draft headers do not imply an absent application or certify all target behavior. |
| Aisley App 1–2: registration/account exit protection and Dashboard/errors | Preserve the previously imported October 3 report of implementation and 380 tests as attributed client evidence. This refresh inspected no external Dart source, Flutter bundle, or installed-device behavior. |
| Aisley App 3–5: wider accessibility, modularity, CI | Historical candidates awaiting a current audit in the owning external project. Do not treat old file lengths or missing-CI observations as current facts. |

## New completed work to account for

| Area | Current implementation boundary |
| --- | --- |
| COD Finance | Collector-owned invoices/private PDFs, scheduled/manual full-balance collection, verified gateway clearing, reserved payouts, timing/settings/history, and sandbox recovery are implemented. [Finance contract](../features/shared/cod-automation/spec.md) uses simulated money; overview report gaps remain below. |
| Logistics delivery and cash | [POD Pending/History/Approval settings](../features/logistics/delivery-confirmations/spec.md), correction reasons, reviewer/system attribution, and automatic eligible prepaid approval exist. COD stays manual; [cash obligations/receipts](../features/logistics/courier-cash-remittance/spec.md) apply only to new confirmed COD deliveries. [Billing](../features/logistics/billing/spec.md) exposes masked simulated-account metadata. |
| Shared web chat and throttles | Seven web surfaces reuse `@aisley/chat-ui`; Customer chat mutations use counters isolated from browsing/polling. Existing role authorization, histories and exact retries remain authoritative. |
| Private chat media | [Chat Media](../features/shared/chat-media/spec.md) implements image/video/document processing/scanning, ordered atomic binding, private retrieval/ranges, and abandoned-upload cleanup. New uploads default off until operator readiness. Chat limits and cleanup do not automatically apply to non-chat uploads; Admin/support attachments and audio remain outside this feature. |
| Dedicated chat alerts | Customer/Seller/Logistics use [separate unread controls](../features/shared/chat-messaging/spec.md#dedicated-web-chat-notifications--2026-10-06) with foreground polling and five previews. No general notification rows, support alerts, native push, or new Courier endpoint result from this change. |

October 5–6 progress records scoped tests and connected/mocked browser checks for these changes. This documentation refresh does not rerun them, certify a whole commerce journey, or advance external Flutter adoption. Azure media delivery, live payment integration, target-environment migrations/worker readiness, and device/screen-reader acceptance retain their recorded limits.

## Active follow-up findings

These are source/specification findings at the baseline above; no new runtime reproduction was performed. Roadmap IDs stay stable in [plan.md](plan.md).

| Plan ID / priority | Current finding and evidence |
| --- | --- |
| 01 / P0 | [Order address mutation](../../src/api/app/Services/Customer/CustomerOrderMutationService.php) accepts another complete owned shipping address without a same-location guard or coverage/shipping recalculation. A new destination can retain the old frozen commercial quote. Restrict the existing correction or separately specify relocation/requote. |
| 04 / P0 correctness | [FinanceReportService](../../src/api/app/Services/Finance/FinanceReportService.php) selects Seller-linked remittance batches but sums whole batch totals, including unrelated Shop allocations. It also checks current-month closure for `profitState`, while [FinanceWorkflowService](../../src/api/app/Services/Finance/FinanceWorkflowService.php) refuses that closure. COD automation does not repair either overview calculation; export/pagination enhancements follow as P1. |
| 02 / P0 acceptance | Current shipping/Auth/POD/media client adoption needs evidence from the external Buyer/Courier projects. App-wide progress preserves earlier client baselines and records subsequent contract changes without marking Flutter complete. Verify each client's actual adopted revision and authenticated/device behavior. |
| 05 / P1 | Courier recovery remains unavailable; implement role-scoped issuance/delivery/reset with expiry, single use, throttling and an explicit token-revocation policy. Keep already-corrected Auth denials/duplicates. |
| 08 / P1 | [Courier DashboardController](../../src/api/app/Http/Controllers/Courier/DashboardController.php) still returns empty aggregate data and unavailable operational sections. Existing scoped task/notification APIs and reported independent client previews do not implement that aggregate. |
| 07 / P1 | [SupportTicketWriter](../../src/api/app/Services/Support/SupportTicketWriter.php) lacks reply/status notification fanout; Customer general notification routes lack global unread/read-all operations. Dedicated chat totals do not close these gaps. Preserve separate support, chat and notification read state. |
| 09 / P1, before public release | [CustomerAccountService](../../src/api/app/Services/Customer/CustomerAccountService.php) reads image metadata and stores original bytes without demonstrating bounded full decode/rewrite/EXIF removal. [CustomerUserResource](../../src/api/app/Http/Resources/Customer/CustomerUserResource.php) still declares a legacy raw path field; registration supplies no uploaded photo, so a current non-null disclosure was not established. Audit non-chat image paths individually under the [upload policy](../references/file-upload-requirements.md); implemented chat processing is separate. |
| 03 / P1 | [CSV bulk catalog](../features/seller/bulk-product-import-export/spec.md) remains a bounded draft with no current API or Seller route. Start from private dry run → explicit valid-row commit → recoverable results, preserving catalog/Inventory ownership. |
| 06 / P1 | Checkout supports exact-key placement replay and result-by-batch, but no placement-by-key recovery read. Define protected restart recovery and retention before claiming uncertain purchases survive app termination. |
| 10–13 / P2 | Voucher authoring, Courier self-availability, incident reporting, and Customer registration evidence/application-status extensions still need owning contracts/policy decisions. [Customer registration](../features/customer/customer-auth/spec.md) remains pending/no-credential with profile/credentials only. Existing voucher use, fleet capacity, failed attempts and support are distinct implemented workflows. |

## Verification and scope

Checked current source/document links and anchors, roadmap consistency, unchanged historical-review content, dated progress append/archive threshold, Git whitespace and documentation-only file scope. Official Laravel/OWASP implementation references in the plan were rechecked. No application code, migration, external Flutter bundle, imported snapshot or archive was changed; no application tests/builds, browser/live/storage/provider or device checks ran.

## Historical review

# Aisley

### Higher-impact findings

1. **Authentication instructions conflict with the implemented system.**  
   AGENTS.md:31 requires Sanctum tokens across all consumers. The workflow:43 (docs/workspace.md:43) specifies cookie sessions for web apps, which the Admin controller implements (src/api/app/Http/Controllers/Admin/AuthController.php:52). Seller and Logistics also use sessions; Courier uses bearer tokens, and Customer supports both. The repository rule needs to describe this split accurately.
2. **Core docs still prohibit implemented inter-hub transfers.**  
   docs/workspace.md:365 says no inter-hub movement is authorized. docs/schema.md:1527 calls `in_transfer` unavailable. But the transition service (src/api/app/Services/Fulfillment/FulfillmentTransitionService.php:713) implements departure, arrival, and transfer of custody between organizations. One hub **per organization** remains valid; it does not prohibit transfers between organizations.
3. **The schema documentation incorrectly says delivery makes no payment change.**  
   docs/schema.md:1518 says delivery performs no payment mutation. The implementation:1214 (src/api/app/Services/Fulfillment/FulfillmentTransitionService.php:1214) marks confirmed COD payment as `paid` and invokes Finance revenue recognition. The newer delivery specification agrees with the code.
4. **Courier account-status errors differ between login and protected requests.**  
   A deactivated Courier receives `ACCOUNT_PENDING_APPROVAL` from login:137 (src/api/app/Http/Controllers/Courier/AuthController.php:137), but `ACCOUNT_INACTIVE` from middleware:22 (src/api/app/Http/Middleware/Courier/EnsureActiveCourier.php:22). Rejected accounts also receive different codes. This can send the mobile client to different recovery screens for the same account state.
5. **Courier password recovery is marked complete, but is not implemented.**  
   The acceptance checklist:129 (docs/features/courier/auth/spec.md:129) checks off recovery completion, while the same spec:174 (docs/features/courier/auth/spec.md:174) says no reset token or notification exists. The controller:110 (src/api/app/Http/Controllers/Courier/AuthController.php:110) nevertheless tells users reset instructions will be sent. Both the completion status and response wording need correction.
6. **Concurrent Courier registration can violate the documented duplicate-email response.**  
   The contract:79 (docs/features/courier/auth/spec.md:79) promises a field-addressable duplicate-email error. The controller:43 (src/api/app/Http/Controllers/Courier/AuthController.php:43) checks existence before its transaction and rethrows database exceptions. Two simultaneous submissions can pass that check and hit the database uniqueness constraint, producing a server error instead. This is a source-level race finding; I did not reproduce it under concurrency.

### Other documentation drift

7. **Several Admin specifications describe the wrong framework and role values.**  
   Admin Auth:18 (docs/features/admin/auth/spec.md:18) specifies persisted `ADMIN` and Next.js. The actual app uses Vite/React Router (src/admin/package.json:6), and the role enum (src/api/app/Enums/UserRole.php:9) stores `admin`. Admin Account Management:292 (docs/features/admin/admin-account-management/spec.md:292) even says application source and manifests are unavailable.
8. **Feature status headers contradict their own implementation sections.**  
   Seller Prepare Orders:7 (docs/features/seller/prepare-orders/spec.md:7) calls operational preparation deferred, although its body and code implement pickup requests, readiness, and waybills. Customer Address Book:7 (docs/features/customer/address-book/spec.md:7) calls order integration deferred, while its checklist correctly records implemented address correction.
9. **Address Book points readers away from an existing authoritative policy.**  
   Its final instruction:102 (docs/features/customer/address-book/spec.md:102) says `docs/maps-location-api.md` does not exist. That policy exists (docs/maps-location-api.md:1) and defines the approved location behavior.

# Aisley App

1. Improve registration and protect unsaved changes — best starting point.
   Registration’s Back and Sign-in buttons immediately leave the form without a discard confirmation, despite the design guide requiring it. Add that protection, password visibility controls, better keyboard navigation, and navigation to the first invalid field. Apply equivalent protection to account edits. See registration form (lib/features/auth/presentation/components/registration_form.dart:10) and design rules (docs/design-courier.md:77).

2. Make dashboard and error wording Courier-friendly.
   The dashboard says “The aggregate is unavailable,” while some errors tell users to check the API contract or expose field names. Replace these with understandable explanations and recovery steps. You could also consolidate repetitive unavailable-summary notices while preserving truthful availability states. See dashboard copy (lib/features/dashboard/presentation/components/dashboard_body.dart:64) and delivery errors (lib/features/delivery/presentation/controllers/delivery_controller_errors.dart:80).

3. Expand accessibility and responsive-layout tests.
   Some newer screens already test large text, but coverage isn’t systematic. Test registration, account, batch details, POD, and support at narrow widths, large text, dark mode, and with keyboard navigation. I found no meetsGuideline checks; Flutter provides automated checks for contrast, touch targets, and labels. Flutter accessibility testing (https://docs.flutter.dev/ui/accessibility/accessibility-testing).

4. Refactor delivery actions into clearer responsibilities.
   The 405-line delivery-actions file (lib/features/delivery/presentation/controllers/delivery_controller_actions.dart:4) contains movement, proof upload, and completion workflows. Separate those meaningfully while preserving existing revision checks, idempotency keys, and uncertain-response handling.

5. Automate your existing quality checks.
   I found no checked-in CI workflow. Running analysis and tests automatically would help catch regressions as both projects evolve.
