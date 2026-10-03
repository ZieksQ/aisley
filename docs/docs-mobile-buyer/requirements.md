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
