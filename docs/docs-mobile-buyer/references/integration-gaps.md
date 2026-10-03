# Backend and Buyer integration gaps

Baseline reviewed 2026-10-03. All Buyer Flutter implementation is pending even where APIs exist. This register identifies unavailable platform behavior, source contradictions and integration/release decisions; it does not authorize backend changes.

| ID | Gap and evidence | Buyer delivery treatment | Owner / phase |
| --- | --- | --- | --- |
| G01 | Customer RegisterRequest/controller omit reference-required address/ID evidence | Profile/credentials-only pending registration; explain limitation; no copied Courier upload parts | Customer API/Admin review; 1 follow-up |
| G02 | No pending-applicant read, rejection resubmission, appeal exception or email-verification policy | Informational pending/rejected state and later login; no protected applicant support | Customer Auth; 1 |
| G03 | Reset mail URL targets configured storefront; native links not configured | Use trusted storefront recovery; approve native app-link/reset handoff separately | Auth/deployment; 1 |
| G04 | Buyer `localhost:8766` absent from default CORS; exposed headers empty | Backend owner allow-lists exact origin, keeps non-stateful token path and exposes Retry-After as needed | API/deployment; 1/5 |
| G05 | Fresh-project SDK/package/architecture choices now supplied with official metadata | Use setup pins; transitive resolution/analyze/build/storage/target checks unexecuted | Flutter; 1/5 |
| G06 | All 19 source-identical PSGC assets/manifest supplied; Dart loader still unimplemented | Copy/register assets, verify hierarchy/cascade/manual fallback and NCR coverage | Flutter/data; 2 |
| G07 | Optional flutter_map/latlong2/geolocator chosen; native public credential suitability still external | Geoapify intentional pin only; keep text-only if credential/permission/provider gate unresolved | Maps/deployment; 2/5 |
| G08 | Portable Cart/Product contracts reconciled against source; historical canonical contradictions preserved upstream | Use local typed operations/specs; no backend/runtime fix implied | Documentation resolved; Flutter 3 |
| G09 | Portable checkout/fulfillment context reconciled with implemented downstream workflow | Seller chooses Logistics; Buyer reads safe tracking and never selects providers | Documentation resolved; Flutter 3 |
| G10 | Homepage configured shortcuts include unavailable vouchers/listings; Bazaar/MoneyFest deferred | Omit enabled destinations without approved implemented result; Category cards are keyword search, not exact global Category filter | Discovery/product; 2 |
| G11 | Quote/voucher rules exist but voucher-specific concurrency and full UX cases remain open | No wallet/claim/code-entry/authoring API promises; verify stacking, zero savings, stale choices and limited capacity | Checkout/API/Flutter; 3/5 |
| G12 | Pending mutation keys/payloads are session memory; no GET placement-by-key | Same-key in-session reconciliation; process-death uncertainty needs approved recovery/storage design before unattended recovery claims | Checkout/security; 3/5 |
| G13 | General notification list/detail/read exists; unread-count/read-all and push device registration absent | Per-page unread is not an exact global badge; no invented unread-count, native push/background guarantee | Notifications; 4 |
| G14 | Wishlist alerts, voucher wallet/authoring, online payments, returns/refunds, live GPS/ETA and broader account controls deferred | Clear unavailable state or omit action; source enum value alone is not implemented workflow | Owning platform features; later |
| G15 | Profile/review multipart lacks durable image replay; profile metadata inspection has no explicit numeric dimension cap or demonstrated bounded full decode/rewrite | Reconcile uncertainty, retain partial review progress; backend upload hardening/retention requires owner decision | Upload/security; 2/4/5 |
| G16 | Three channels implemented; retention/abuse policy, operational two-worker races/live exchanges remain release gates | Foreground HTTP polling, scoped read-only state; no attachments/Admin blanket transcript access | Messaging/API/Flutter; 4/5 |
| G17 | Support ticket notifications/linked records/attachments deferred; requester UI says description but API uses body | Only subject/category/body create, revision-checked reply; pending/inactive Customers have no exception | Support; 4 |
| G18 | Sanctum token expiration currently null; no refresh/revoke-all/session registry API | Secure restore and /me revalidation; current-token logout, documented password token effects; no invented refresh schedule | Security/Auth; 1/5 |
| G19 | Portable contracts now cover inspected behavior; canonical historical wording remains optional evidence | Local specs/typed contracts govern implementation; log live contract differences separately | Documentation resolved; each phase |
| G20 | Native Android and real-browser Buyer integration never run; source tests were inspected only | Record actual analyze/tests/build/device/browser/live results later; preserve all unchecked mobile criteria | Flutter/release; 5 |
| G21 | Address correction implementation does not fully demonstrate current published-rate/coverage revalidation | It checks owned shipping-address completeness and Order eligibility but does not recalculate the saved shipping quote; review material-location changes with the backend owner before release | Order/Finance/API; 3/5 |

Unavailable APIs must not be mocked into production success. Test fixtures may model future/denied states clearly, but future endpoint proposals need separate backend authorization and acceptance.


## Newly inspected contracts — checkout 57e9eb2

| ID | New finding / treatment | Release evidence |
| --- | --- | --- |
| G22 | Support detail cursor uses Laravel’s global request-bound resolver; source confirms traversal is available. | Verify advancing older-event pages and no-progress guard with controlled live records; no backend gap claimed. |
| G23 | NCR has direct cities/no Province nodes, but saved Address province remains required text. Flutter offers a reviewed compatibility suggestion, never a fictional PSGC Province. | Verify exact saved-text shipping coverage for NCR/direct cities with deployment data. |
| G24 | Registration Resource exposes profile_photo_path (normally null); discard this field. No evidence upload endpoint exists. | Backend owner assesses privacy of any non-null path; Flutter never constructs URLs from it. |

Corrected portable contract details: Account uses account envelope; Quote Address has label but no coordinates; Support write replay preserves201 and Customer reply automatically reopens waiting/resolved tickets. These were source inspections, not live exchanges. No additional routes or backend fixes are authorized.
