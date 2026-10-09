# Buyer feature index

> Implementation, SDK/package resolution, tests, builds and browser results in this guide are reports from the external Buyer Flutter project and were not rerun here. This bundle contains documentation; `lib/`, tests, tools, lockfiles and build reports belong to that project. Current shipping-contract adoption remains [G25](../references/integration-gaps.md).

Phases 1–4 are implemented; live/device acceptance remains partial. See [Phase 4 evidence](../references/phase-4-verification.md), [Phase 3 evidence](../references/phase-3-verification.md) and [Phase 2 evidence](../references/phase-2-verification.md). Backend status describes inspected Laravel availability; upstream checkboxes are not imported as mobile completion. Read shared API/design/security guides first.

Before creating, revising or implementing a Customer feature, read [Customer specification rules](customer/rule.md) and [agent instructions](../AGENTS.md). New or revised Customer specs use WHAT/MUST/HOW and 200–230 physical lines, overriding the feature-spec skill's shorter preference. All 22 Customer specs now meet that rule; shared policy consent has its own complete contract outside the Customer length range.

| Feature | Phase | Backend boundary | Flutter |
| --- | --- | --- | --- |
| [Customer authentication](customer/customer-auth/spec.md) | 1 | Auth/approval-aware registration, login and recovery implemented; address/ID registration and native reset links deferred. | Implemented; target acceptance pending |
| [Auth-aware navigation](customer/customer_verify_auth/spec.md) | 1 | /me role/status and policy guards implemented; storefront session UX has its own separate implementation. | Implemented; target acceptance pending |
| [Homepage and discovery](customer/customer-homepage/spec.md) | 2 | Public aggregation, optional personalization and cursor discovery implemented; shortcut/error/cache gaps remain. | Implemented; acceptance partial |
| [Products and Shops search](customer/search/spec.md) | 2 | Separate public Product/Shop search endpoints and ranked result modes implemented. | Implemented; acceptance partial |
| [Shop directory and storefront](customer/browse-shop/spec.md) | 2 | Directory/detail, category filtering and optional Shop-scoped q search implemented. | Implemented; acceptance partial |
| [Product Detail and configuration](customer/view-product/spec.md) | 2 | Product Detail Resource, media/valid variants and current purchase handoffs implemented; canonical checklist retains historical foundation wording. | Implemented; acceptance partial |
| [Profile, password, photo and preference](customer/account-management/spec.md) | 2 | Owned account/profile/password/private-photo and promotional preference APIs implemented. | Implemented; acceptance partial |
| [Address Book and defaults](customer/address-book/spec.md) | 2 | Owned CRUD/defaults and checkout snapshots implemented; location-changing Order shipping revalidation remains a gap. | Implemented; acceptance partial |
| [Wishlist](customer/wishlist/spec.md) | 2 | Owned cursor/status list and idempotent PUT/DELETE implemented; alerts/guest merge deferred. | Implemented; acceptance partial |
| [Recently Viewed](customer/recently-viewed-items/spec.md) | 2 | Owned record/merge/list/remove/clear and public Product resolver implemented. | Implemented; acceptance partial |
| [Cart configuration](customer/view-cart/spec.md) | 3 | Cart routes/tables/service/Resources/tests implemented despite stale Draft spec claiming no API. | Implemented; acceptance partial |
| [COD checkout and placement](customer/checkout-order/spec.md) | 3 | Quote/place/batch, per-Shop Orders, shipping/vouchers/reservations/snapshots and UUID replay implemented. | Implemented at 57e9eb2; current shipping DTO/selection adoption pending G25 |
| [Checkout voucher usage](customer/voucher-usage/spec.md) | 3 | Existing quote candidate/eligibility/selection/savings/snapshot/redemption implemented; wallet/claim/authoring deferred. | Implemented at 57e9eb2; current shipping DTO/selection adoption pending G25 |
| [Owned Orders and tracking](customer/order-status/spec.md) | 3 | Owned list/detail/timeline, status mapper, immutable facts and safe assigned-Courier projection implemented; live maps deferred. | Implemented at 57e9eb2; current shipping DTO/selection adoption pending G25 |
| [Order cancellation and address correction](customer/order-modification-cancellation/spec.md) | 3 | Eligible placed COD mutations, locked reservations, new address snapshots and replay implemented; shipping-rate revalidation gap remains. | Implemented at 57e9eb2; current shipping DTO/selection adoption pending G25 |
| [Shop messages](customer/chat-messaging/spec.md) | 4 | Shared Customer–Shop thread APIs, Seller replies and Shop unread-count implemented; retention/release gates remain. | Implemented; acceptance partial |
| [Public Product questions](customer/product-qa/spec.md) | 4 | Public Product Q&A, active-Customer ask, owning Seller official answer and after-commit alerts implemented. | Implemented; acceptance partial |
| [Verified reviews and ratings](customer/product-review-ratings/spec.md) | 4 | Delivered own-item Review create/public list/photos and read-only official Seller response implemented; release/media concurrency checks incomplete. | Implemented; acceptance partial |
| [Admin support tickets](customer/support-tickets/spec.md) | 4 | Own-ticket APIs and Admin triage/status lifecycle implemented; linked records/attachments/notification fanout deferred. | Implemented; acceptance partial |
| [Inbox notifications and preference](customer/notifications/spec.md) | 4 | Allow-listed own list/detail/read and in-app promotion preference implemented; unread-count/read-all/native push absent. | Implemented; acceptance partial |
| [Logistics delivery messages](customer/logistics-messaging/spec.md) | 4 | Separate owned active-Order/current-handler text/history/send/read APIs implemented. | Implemented; acceptance partial |
| [Delivery Courier messages](customer/courier-messaging/spec.md) | 4 | Accepted-final-mile counterpart APIs and private Customer Order-context read implemented; live/race release gates open. | Implemented; acceptance partial |
| [Policies and consent](shared/policy-viewing-consent/spec.md) | 1 | Public versions/status/acceptance/enforcement implemented | Implemented; target acceptance pending |

The first 19 entries cover all canonical Customer areas. Notifications, separate Logistics/Courier messaging and shared consent add four explicit contracts. No dedicated canonical Customer notification spec exists; its portable spec records actual API behavior and the source gap.

Newer [marketplace evidence](../references/marketplace-verification.md) and dated October 5 [progress](../PROGRESS.md) report responsive desktop presentation, retained pages, shopping controls, embedded Profile photos and selected-only PSGC. These are external client results, not storefront changes or live/device certification. Laravel [private chat media](../api/chat-media.md) is implemented across the three channels; imported Flutter text-chat completion does not establish attachment adoption (G26).
