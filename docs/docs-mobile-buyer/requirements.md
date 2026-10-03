# Buyer requirements

Status: documentation baseline; every Flutter capability below is pending. Backend availability is recorded in [feature specs](features/README.md) and [API inventory](api/endpoints.md).

Guests can discover visible Products/Shops, search, inspect Product media and valid variants, read public Q&A/reviews, read Terms/Privacy, and keep bounded local Recently Viewed hints. Private actions require an active Admin-approved Customer and required server policy consent.

The app must cover all 19 canonical Customer feature areas: Customer Auth, auth-aware navigation, Homepage, Search, Browse Shop, View Product, Account Management, Address Book, Wishlist, Recently Viewed, View Cart, Checkout, Voucher Usage, Order Status, Order Modification/Cancellation, Shop Chat, Product Q&A, Reviews/Ratings, and Support Tickets. Additional owning specs cover notifications, policy viewing/consent, Logistics messages, and Courier messages.

An approved Customer can maintain their own profile/password/private avatar; manage shipping/billing addresses; save visible Products; synchronize/remove browsing history; configure Cart lines; obtain authoritative per-Shop COD quotes; choose existing eligible voucher UUIDs; place atomic checkout; and inspect owned Orders with safe tracking, eligible cancellation and delivery-address correction.

The Customer can ask public Product questions, review eligible delivered purchases, upload permitted review images, and communicate through three independent private channels. Shop chat handles pre-sale and purchase questions. Logistics chat requires an active owned Order handled by that organization. Courier chat requires an accepted final-mile task on that Order. Admin support uses owned tickets with subject/category/description, replies, and read markers; it is not an arbitrary Admin chat.

The app must expose a server-backed notification inbox, allowed destinations and the existing default-off in-app promotion preference. This is separate from three chat unread states and support-ticket read markers. Native push delivery, background synchronization, FCM/APNs registration and message transport are deferred.

Registration currently accepts profile and credentials only, creates a pending User/Application and grants no token. The reference requirement for address and ID evidence is a backend gap. Display derived age as guidance when possible; never submit client age. Pending/rejected applicants cannot use protected Customer APIs or bypass approval with support tickets.

Laravel owns current prices, stock/variant eligibility, serviceable shipping/rate versions, vouchers, total COD, payment/status fields, snapshots and transitions. One checkout creates one Order per Shop; Seller chooses Logistics downstream. Buyer cannot select a Courier/provider, advance tracking, alter prices, claim delivery completion, collect COD, or mutate another role's resources.

Acceptable first delivery includes Android and a fixed-origin local Flutter web test target, truthful failure/retry states, secure token restoration and cleanup, accessible navigation/forms, optional location fallback, and verified authenticated uploads. [Integration gaps](references/integration-gaps.md) remain visible; existing source-test coverage is not new mobile certification.

Bazaar/MoneyFest placeholders, guest Cart/Wishlist merge, voucher claiming/wallet/authoring, online payments, returns/refunds/disputes, live GPS/ETA, review editing/moderation, account email changes/MFA/deletion, and unimplemented registration evidence must not be presented as operational features.


## Delivery authority and dependencies

[Fresh setup](setup.md) supplies the selected Material/ChangeNotifier/go_router/Dio stack and nineteen PSGC assets. Local specs plus typed operation/wire tables are sufficient for a fresh implementation; optional upstream provenance does not gate authoring. Live acceptance still needs configured origins, approved accounts and representative server data.

| Feature group | Required dependencies | Authority boundary |
| --- | --- | --- |
| Auth/navigation/consent | trusted API, secure TokenStore, session generation, public policy reader | Admin approval and current server consent |
| Home/search/Shop/Product | public typed repositories, safe URL mapping, bounded pagination | backend publication/Shop visibility and variant completeness |
| Profile/addresses/save/history | verified Customer, uploads, offline PSGC, guest-store isolation | owned account/defaults and unchanged Order snapshots |
| Cart/quote/vouchers/place | owned shipping address, exact intent, server totals, frozen keys | atomic reservations/redemptions and one Order per Shop |
| Orders/cancel/correct | immutable snapshots, current actions/revisions, tracking pages | locked transition window; no Buyer fulfillment power |
| Shop/Logistics/Courier chat | separate eligibility/context/DTO/read/polling state | participants resolved by server, readonly after relationship ends |
| Q&A/reviews/notifications/support | Product visibility/delivered ownership, independent read state | official Seller replies, Admin ticket lifecycle |

## Fulfillment and financial context

Seller approves/prepares their own Orders, selects Logistics downstream, requests pickup and participates in first-mile handoff. Logistics controls hub custody, dispatch and associated Courier approval. Courier is external mobile-only: accepted first/final-mile work, private evidence and COD collection are outside Buyer. Customer sees safe Order/tracking/contact projections only and cannot call those role endpoints.

Quote/batch/Order totals are PHP money strings; Product/Cart numeric prices are display information. No mobile total is submitted as authority. Placement commits all Shop Orders, pricing/address/voucher snapshots, reservations/redemptions and selected Cart cleanup atomically. COD initially remains pending and delivery/COD recognition comes from the server workflows. Commission does not add a Buyer surcharge. Cancellation releases eligible reservations once but does not currently restore voucher capacity. Address correction lacks demonstrated current-rate/coverage recalculation and remains a release gate.

## Reliability and acceptance requirements

Every supported screen must distinguish loading, empty, validation, forbidden, consent-required, stale, offline, unavailable, throttled, conflict and uncertain mutation. Preserve safe input across recoverable failure, prevent duplicate submits and honor only supported replay. Browser file paths, cookies and server map keys must never be substituted for approved native/web adapters.

All 22 Customer specs and shared consent remain Flutter pending. Execute parser/repository/view-model/widget tests, analyzer, Android/web builds, installed-device and fixed-origin browser checks, followed by controlled live exchanges. Record the backend checkout/SDK/packages/configuration with results. [Verification](verification.md) separates completed documentation checks from these unexecuted application gates.

## Explicit deferred inventory

Do not infer implementation from enum values, public shortcut URLs or historical planned spec wording. Missing registration evidence/status polling, native reset app links, exact global notification badges, push, guest Cart/Wishlist merge, wallet/claim/code vouchers, online payments/refunds/returns, live GPS/ETA, account session controls and support attachments/fanout remain unavailable. Pin assistance is optional and gated on suitable public credentials, permission and provider terms. Support detail cursor traversal relies on Laravel’s request-bound resolver and needs explicit integration verification.
