# Buyer feature index

All Flutter implementation and acceptance criteria are pending. Backend status describes inspected Laravel availability; upstream checkboxes are not imported as mobile completion. Read shared API/design/security guides first.

| Feature | Phase | Backend boundary | Flutter |
| --- | --- | --- | --- |
| [Customer authentication](customer/customer-auth/spec.md) | 1 | Auth/approval-aware registration, login and recovery implemented; address/ID registration and native reset links deferred. | Pending |
| [Auth-aware navigation](customer/customer_verify_auth/spec.md) | 1 | /me role/status and policy guards implemented; storefront session UX has its own separate implementation. | Pending |
| [Homepage and discovery](customer/customer-homepage/spec.md) | 2 | Public aggregation, optional personalization and cursor discovery implemented; shortcut/error/cache gaps remain. | Pending |
| [Products and Shops search](customer/search/spec.md) | 2 | Separate public Product/Shop search endpoints and ranked result modes implemented. | Pending |
| [Shop directory and storefront](customer/browse-shop/spec.md) | 2 | Directory/detail, category filtering and optional Shop-scoped q search implemented. | Pending |
| [Product Detail and configuration](customer/view-product/spec.md) | 2 | Product Detail Resource, media/valid variants and current purchase handoffs implemented; canonical checklist retains historical foundation wording. | Pending |
| [Profile, password, photo and preference](customer/account-management/spec.md) | 2 | Owned account/profile/password/private-photo and promotional preference APIs implemented. | Pending |
| [Address Book and defaults](customer/address-book/spec.md) | 2 | Owned CRUD/defaults and checkout snapshots implemented; Dart assets/native pin integration pending. | Pending |
| [Wishlist](customer/wishlist/spec.md) | 2 | Owned cursor/status list and idempotent PUT/DELETE implemented; alerts/guest merge deferred. | Pending |
| [Recently Viewed](customer/recently-viewed-items/spec.md) | 2 | Owned record/merge/list/remove/clear and public Product resolver implemented. | Pending |
| [Cart configuration](customer/view-cart/spec.md) | 3 | Cart routes/tables/service/Resources/tests implemented despite stale Draft spec claiming no API. | Pending |
| [COD checkout and placement](customer/checkout-order/spec.md) | 3 | Quote/place/batch, per-Shop Orders, shipping/vouchers/reservations/snapshots and UUID replay implemented. | Pending |
| [Checkout voucher usage](customer/voucher-usage/spec.md) | 3 | Existing quote candidate/eligibility/selection/savings/snapshot/redemption implemented; wallet/claim/authoring deferred. | Pending |
| [Owned Orders and tracking](customer/order-status/spec.md) | 3 | Owned list/detail/timeline, status mapper, immutable facts and safe assigned-Courier projection implemented; live maps deferred. | Pending |
| [Order cancellation and address correction](customer/order-modification-cancellation/spec.md) | 3 | Eligible placed COD mutations, locked reservations, new address snapshots and replay implemented; shipping-rate revalidation gap remains. | Pending |
| [Shop messages](customer/chat-messaging/spec.md) | 4 | Shared Customer–Shop thread APIs, Seller replies and Shop unread-count implemented; retention/release gates remain. | Pending |
| [Public Product questions](customer/product-qa/spec.md) | 4 | Public Product Q&A, active-Customer ask, owning Seller official answer and after-commit alerts implemented. | Pending |
| [Verified reviews and ratings](customer/product-review-ratings/spec.md) | 4 | Delivered own-item Review create/public list/photos and read-only official Seller response implemented; release/media concurrency checks incomplete. | Pending |
| [Admin support tickets](customer/support-tickets/spec.md) | 4 | Own-ticket APIs and Admin triage/status lifecycle implemented; linked records/attachments/notification fanout deferred. | Pending |
| [Inbox notifications and preference](customer/notifications/spec.md) | 4 | Allow-listed own list/detail/read and in-app promotion preference implemented; unread-count/read-all/native push absent. | Pending |
| [Logistics delivery messages](customer/logistics-messaging/spec.md) | 4 | Separate owned active-Order/current-handler text/history/send/read APIs implemented. | Pending |
| [Delivery Courier messages](customer/courier-messaging/spec.md) | 4 | Accepted-final-mile counterpart APIs and private Customer Order-context read implemented; live/race release gates open. | Pending |
| [Policies and consent](shared/policy-viewing-consent/spec.md) | 1 | Public versions/status/acceptance/enforcement implemented | Pending |

The first 19 entries cover all canonical Customer areas. Notifications, separate Logistics/Courier messaging and shared consent add four explicit contracts. No dedicated canonical Customer notification spec exists; its portable spec records actual API behavior and the source gap.
