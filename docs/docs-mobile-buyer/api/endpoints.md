# Verified Buyer endpoint inventory

Enumerated using `php src/api/artisan route:list --path=api/v1 --json` at backend `7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0` on 2026-10-03. This was read-only route inspection, not authenticated API execution. Every endpoint below is implemented in this Laravel checkout; every Buyer Flutter integration remains pending.

**Public** needs no token. **Public/optional identity** personalizes only an active Customer, with any authenticated Home response private/no-store. **Active Customer** composes Sanctum and persisted role/status gate. **Active Customer + consent** adds the server policy gate and resource ownership. **Active policy actor** uses shared Sanctum/active-role policy authorization and remains exempt from consent blocking. Route/controller authorization and business rules still apply beyond middleware. GET routes also accept framework HEAD; the table shows the intended GET consumer method.

Customer feature routes generally include `throttle:120,1`; focused throttles are also shown. Login/password recovery additionally enforce controller rate limits. A named limiter in the table needs its current provider definition before timing is assumed. Error shapes and CORS/header visibility are documented separately.

[Request/DTO guide](contracts.md), [field index](field-index.md), [authentication](authentication.md), [messaging](messaging.md), [integration gaps](../references/integration-gaps.md) and [provenance](../references/source-provenance.md) complete this inventory.

## address-options

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/address-options/barangays` | Public | 60,1 | `AddressOptionController@barangays` |
| `GET` | `/api/v1/address-options/municipalities` | Public | 60,1 | `AddressOptionController@municipalities` |
| `GET` | `/api/v1/address-options/provinces` | Public | 60,1 | `AddressOptionController@provinces` |
| `GET` | `/api/v1/address-options/regions` | Public | 60,1 | `AddressOptionController@regions` |

## Customer / account

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/account` | Active Customer + consent | 120,1 | `Customer\AccountController@show` |
| `GET` | `/api/v1/customer/account/notification-preferences` | Active Customer + consent | 120,1 | `Customer\PromotionPreferenceController@show` |
| `PATCH` | `/api/v1/customer/account/notification-preferences` | Active Customer + consent | 120,1, 30,1 | `Customer\PromotionPreferenceController@update` |
| `PATCH` | `/api/v1/customer/account/password` | Active Customer + consent | 120,1, customer-account-password | `Customer\AccountController@updatePassword` |
| `PATCH` | `/api/v1/customer/account/profile` | Active Customer + consent | 120,1 | `Customer\AccountController@updateProfile` |
| `POST` | `/api/v1/customer/account/profile-photo` | Active Customer + consent | 120,1, customer-profile-photo | `Customer\AccountController@uploadProfilePhoto` |
| `GET` | `/api/v1/customer/account/profile-photo` | Active Customer + consent | 120,1 | `Customer\AccountController@profilePhoto` |
| `DELETE` | `/api/v1/customer/account/profile-photo` | Active Customer + consent | 120,1 | `Customer\AccountController@removeProfilePhoto` |

## Customer / addresses

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/addresses` | Active Customer + consent | 120,1 | `Customer\AddressController@index` |
| `POST` | `/api/v1/customer/addresses` | Active Customer + consent | 120,1 | `Customer\AddressController@store` |
| `PATCH` | `/api/v1/customer/addresses/{address}` | Active Customer + consent | 120,1 | `Customer\AddressController@update` |
| `DELETE` | `/api/v1/customer/addresses/{address}` | Active Customer + consent | 120,1 | `Customer\AddressController@destroy` |

## Customer / auth

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/customer/auth/forgot-password` | Public | Controller limit if defined | `Customer\AuthController@forgotPassword` |
| `POST` | `/api/v1/customer/auth/login` | Public | Controller limit if defined | `Customer\AuthController@login` |
| `POST` | `/api/v1/customer/auth/logout` | Active Customer | Controller limit if defined | `Customer\AuthController@logout` |
| `GET` | `/api/v1/customer/auth/me` | Active Customer | Controller limit if defined | `Customer\AuthController@show` |
| `POST` | `/api/v1/customer/auth/register` | Public | Controller limit if defined | `Customer\AuthController@register` |
| `POST` | `/api/v1/customer/auth/reset-password` | Public | Controller limit if defined | `Customer\AuthController@resetPassword` |

## Customer / cart

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/cart` | Active Customer + consent | 120,1 | `Customer\CartController@show` |
| `POST` | `/api/v1/customer/cart/items` | Active Customer + consent | 120,1 | `Customer\CartController@store` |
| `PATCH` | `/api/v1/customer/cart/items/{item}` | Active Customer + consent | 120,1 | `Customer\CartController@update` |
| `DELETE` | `/api/v1/customer/cart/items/{item}` | Active Customer + consent | 120,1 | `Customer\CartController@destroy` |

## Customer / checkout

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/customer/checkout/place` | Active Customer + consent | 120,1 | `Customer\CheckoutController@place` |
| `POST` | `/api/v1/customer/checkout/quote` | Active Customer + consent | 120,1 | `Customer\CheckoutController@quote` |
| `GET` | `/api/v1/customer/checkout/{batch}` | Active Customer + consent | 120,1 | `Customer\CheckoutController@show` |

## Customer / conversations

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/conversations` | Active Customer + consent | 120,1 | `Customer\ConversationController@index` |
| `POST` | `/api/v1/customer/conversations` | Active Customer + consent | 120,1, 15,1 | `Customer\ConversationController@start` |
| `GET` | `/api/v1/customer/conversations/unread-count` | Active Customer + consent | 120,1 | `Customer\ConversationController@unreadCount` |
| `GET` | `/api/v1/customer/conversations/{conversation}` | Active Customer + consent | 120,1 | `Customer\ConversationController@show` |
| `GET` | `/api/v1/customer/conversations/{conversation}/messages` | Active Customer + consent | 120,1 | `Customer\ConversationController@messages` |
| `POST` | `/api/v1/customer/conversations/{conversation}/messages` | Active Customer + consent | 120,1, 30,1 | `Customer\ConversationController@send` |
| `POST` | `/api/v1/customer/conversations/{conversation}/read` | Active Customer + consent | 120,1 | `Customer\ConversationController@read` |

## Customer / courier-conversations

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/courier-conversations` | Active Customer + consent | 120,1 | `Customer\CourierConversationController@index` |
| `POST` | `/api/v1/customer/courier-conversations` | Active Customer + consent | 120,1, 15,1 | `Customer\CourierConversationController@start` |
| `GET` | `/api/v1/customer/courier-conversations/order-context/{order}` | Active Customer + consent | 120,1 | `Customer\CourierConversationController@orderContext` |
| `GET` | `/api/v1/customer/courier-conversations/{conversation}` | Active Customer + consent | 120,1 | `Customer\CourierConversationController@show` |
| `GET` | `/api/v1/customer/courier-conversations/{conversation}/messages` | Active Customer + consent | 120,1 | `Customer\CourierConversationController@messages` |
| `POST` | `/api/v1/customer/courier-conversations/{conversation}/messages` | Active Customer + consent | 120,1, 30,1 | `Customer\CourierConversationController@send` |
| `POST` | `/api/v1/customer/courier-conversations/{conversation}/read` | Active Customer + consent | 120,1 | `Customer\CourierConversationController@read` |

## Customer / home

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/home` | Public/optional identity | 120,1 | `Customer\HomepageController@show` |
| `GET` | `/api/v1/customer/home/recommendations` | Public/optional identity | 120,1 | `Customer\HomepageController@recommendations` |

## Customer / logistics-conversations

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/logistics-conversations` | Active Customer + consent | 120,1 | `Customer\LogisticsConversationController@index` |
| `POST` | `/api/v1/customer/logistics-conversations` | Active Customer + consent | 120,1, 15,1 | `Customer\LogisticsConversationController@start` |
| `GET` | `/api/v1/customer/logistics-conversations/{conversation}` | Active Customer + consent | 120,1 | `Customer\LogisticsConversationController@show` |
| `GET` | `/api/v1/customer/logistics-conversations/{conversation}/messages` | Active Customer + consent | 120,1 | `Customer\LogisticsConversationController@messages` |
| `POST` | `/api/v1/customer/logistics-conversations/{conversation}/messages` | Active Customer + consent | 120,1, 30,1 | `Customer\LogisticsConversationController@send` |
| `POST` | `/api/v1/customer/logistics-conversations/{conversation}/read` | Active Customer + consent | 120,1 | `Customer\LogisticsConversationController@read` |

## Customer / notifications

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/notifications` | Active Customer + consent | 120,1 | `Customer\NotificationController@index` |
| `GET` | `/api/v1/customer/notifications/{notification}` | Active Customer + consent | 120,1 | `Customer\NotificationController@show` |
| `POST` | `/api/v1/customer/notifications/{notification}/read` | Active Customer + consent | 120,1 | `Customer\NotificationController@markRead` |

## Customer / order-items

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/customer/order-items/{orderItem}/review` | Active Customer + consent | 120,1, customer-product-reviews | `Customer\ProductReviewController@store` |

## Customer / orders

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/orders` | Active Customer + consent | 120,1 | `Customer\OrderController@index` |
| `GET` | `/api/v1/customer/orders/{order}` | Active Customer + consent | 120,1 | `Customer\OrderController@show` |
| `POST` | `/api/v1/customer/orders/{order}/cancel` | Active Customer + consent | 120,1 | `Customer\OrderController@cancel` |
| `PATCH` | `/api/v1/customer/orders/{order}/modification` | Active Customer + consent | 120,1 | `Customer\OrderController@modify` |
| `GET` | `/api/v1/customer/orders/{order}/tracking` | Active Customer + consent | 120,1 | `Customer\OrderController@tracking` |

## Customer / products

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/customer/products/resolve` | Public | 120,1 | `Customer\RecentlyViewedController@resolve` |
| `GET` | `/api/v1/customer/products/search` | Public | 120,1 | `Customer\ProductSearchController` |

## Customer / recently-viewed

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/recently-viewed` | Active Customer + consent | 120,1 | `Customer\RecentlyViewedController@index` |
| `DELETE` | `/api/v1/customer/recently-viewed` | Active Customer + consent | 120,1 | `Customer\RecentlyViewedController@clear` |
| `POST` | `/api/v1/customer/recently-viewed/merge` | Active Customer + consent | 120,1 | `Customer\RecentlyViewedController@merge` |
| `PUT` | `/api/v1/customer/recently-viewed/{product}` | Active Customer + consent | 120,1 | `Customer\RecentlyViewedController@store` |
| `DELETE` | `/api/v1/customer/recently-viewed/{product}` | Active Customer + consent | 120,1 | `Customer\RecentlyViewedController@destroy` |

## Customer / reviews

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/customer/reviews/{review}/images` | Active Customer + consent | 120,1, customer-product-review-images | `Customer\ProductReviewController@uploadImage` |

## Customer / search

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/search/shops` | Public | 120,1 | `Customer\ShopSearchController` |

## Customer / shops

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/shops` | Public | 120,1 | `Customer\ShopBrowseController@index` |
| `GET` | `/api/v1/customer/shops/{slug}` | Public | 120,1 | `Customer\ShopBrowseController@show` |
| `GET` | `/api/v1/customer/shops/{slug}/products` | Public | 120,1 | `Customer\ShopBrowseController@products` |

## Customer / support-tickets

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/support-tickets` | Active Customer + consent | 120,1 | `Support\RequesterSupportTicketController@index` |
| `POST` | `/api/v1/customer/support-tickets` | Active Customer + consent | 120,1, 10,1 | `Support\RequesterSupportTicketController@store` |
| `GET` | `/api/v1/customer/support-tickets/{ticket}` | Active Customer + consent | 120,1 | `Support\RequesterSupportTicketController@show` |
| `POST` | `/api/v1/customer/support-tickets/{ticket}/read` | Active Customer + consent | 120,1 | `Support\RequesterSupportTicketController@read` |
| `POST` | `/api/v1/customer/support-tickets/{ticket}/replies` | Active Customer + consent | 120,1, 30,1 | `Support\RequesterSupportTicketController@reply` |

## Customer / wishlist

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/customer/wishlist` | Active Customer + consent | 120,1 | `Customer\WishlistController@index` |
| `GET` | `/api/v1/customer/wishlist/status` | Active Customer + consent | 120,1 | `Customer\WishlistController@status` |
| `PUT` | `/api/v1/customer/wishlist/{product}` | Active Customer + consent | 120,1 | `Customer\WishlistController@store` |
| `DELETE` | `/api/v1/customer/wishlist/{product}` | Active Customer + consent | 120,1 | `Customer\WishlistController@destroy` |

## homepage-advertisement-images

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/homepage-advertisement-images/{campaign}/{variant}` | Public | 120,1 | `HomepageAdvertisementImageController` |

## platform

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/platform/announcements` | Public | 120,1 | `PlatformContentController@announcements` |
| `GET` | `/api/v1/platform/policies/{type}` | Public | 120,1 | `PlatformContentController@policy` |
| `GET` | `/api/v1/platform/policies/{type}/history` | Public | 120,1 | `PlatformContentController@policyHistory` |
| `GET` | `/api/v1/platform/policies/{type}/history/{version}` | Public | 120,1 | `PlatformContentController@policyHistoryVersion` |

## policy-consent

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/policy-consent/status` | Active policy actor | policy-consent-status | `PolicyConsentController@status` |
| `POST` | `/api/v1/policy-consent/{type}/versions/{version}/accept` | Active policy actor | policy-consent-acceptance | `PolicyConsentController@accept` |

## product-description-assets

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/product-description-assets/{asset}` | Public | 120,1 | `ProductDescriptionAssetController` |

## product-media

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/product-media/{media}` | Public | 120,1 | `ProductMediaController` |

## product-review-images

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/product-review-images/{image}` | Public | 120,1 | `ProductReviewImageController` |

## products

| Method | Existing path | Access | Throttle | Controller/action |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/products/{id}` | Public | 120,1 | `Customer\ProductDetailController@show` |
| `GET` | `/api/v1/products/{product}/questions` | Public | 120,1 | `Customer\ProductQAController@index` |
| `POST` | `/api/v1/products/{product}/questions` | Active Customer + consent | customer-product-questions | `Customer\ProductQAController@store` |
| `GET` | `/api/v1/products/{product}/reviews` | Public | 120,1 | `Customer\ProductReviewController@index` |

## Inventory limits

- Public media routes still check current owning Product/review/campaign visibility; route-public does not make hidden assets public. Private avatar requires authenticated Customer bytes and current consent.
- Generic address-options routes are auxiliary upstream APIs; current Customer dropdowns use bundled PSGC data. See the Dart asset plan.
- Platform policies expose only public Terms/Privacy and published/superseded history; Internal Rules are scoped unavailable.
- There is no Buyer push-device registration, notification unread-count/read-all, voucher wallet/claim/code-entry, native-reset-link, applicant-status, live-location, delivery-POD, online-payment, returns/refunds or arbitrary-user messaging API promised by this inventory.
- Customer methods differ from other roles: account password is PATCH, avatar part is photo, review part image, Q&A part question, support description part body, Shop read sequence versus operational read last_read_sequence.
