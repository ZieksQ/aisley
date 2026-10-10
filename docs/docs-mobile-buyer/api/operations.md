# Requests, responses and replay contracts

Current inspected checkout `22b0a48f9575ead182d03c35ab87345711c23b90`; reported external client adoption `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50` (G25); examples synthetic, not live captures.

Use [wire types](field-index.md), [schema](dto-schema.json), [examples](examples/README.md), [errors](errors.md) and [feature error codes](error-codes.json) together.
JSON uses Accept/Content-Type application/json; multipart sets its own boundary. GET has no body. Private bearer is restricted to the trusted API origin.
Address-options retry notes preserve historical generic fallback advice. Current Buyer locality forms require explicit hierarchical selections and failed assets block Save with Retry; those notes do not authorize custom locality text.
Named types define all nested fields locally. Status201 replay semantics vary: Shop/Q&A/Support retain201; operational chat and Review creation replay200.

## op-001

`POST /api/v1/customer/auth/register`

- Access: Public.
- Request: Profile fields required: names string≤255, middle_name nullable ≤255, contact_number≤32, sex male|female|non_binary|prefer_not_to_say, birth_date before today; email≤255 normalized lowercase/trim; confirmed password≥8 mixed case + digit. role/status prohibited.
- Response: HTTP 201; `{message:string,customer:RegistrationCustomer}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/customer-auth.json).

## op-002

`POST /api/v1/customer/auth/login`

- Access: Public.
- Request: email valid≤255 normalized; password string required; device_name string required for Flutter≤255; remember optional boolean for cookie path only.
- Response: HTTP 200; `{message:string,customer:Navigation,token:string}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/customer-auth.json).

## op-003

`POST /api/v1/customer/auth/forgot-password`

- Access: Public.
- Request: email string valid≤255 normalized; max 5 attempts with default 60-second decay.
- Response: HTTP 200; `{message:string}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/customer-auth.json).

## op-004

`POST /api/v1/customer/auth/reset-password`

- Access: Public.
- Request: email valid≤255; token string; password confirmed≥8 mixed case + digit. No native link contract; use trusted storefront link unless native handoff approved.
- Response: HTTP 200; `{message:string}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/customer-auth.json).

## op-005

`POST /api/v1/customer/auth/logout`

- Access: Active Customer.
- Request: No body; current bearer required.
- Response: HTTP 200; `{message:string}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/customer-auth.json).

## op-006

`GET /api/v1/customer/auth/me`

- Access: Active Customer.
- Request: No parameters.
- Response: HTTP 200; `{customer:Navigation}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/customer_verify_auth.json).

## op-007

`GET /api/v1/customer/account`

- Access: Active Customer + consent.
- Request: No parameters.
- Response: HTTP 200; `{account:Account}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/account-management.json).

## op-008

`PATCH /api/v1/customer/account/profile`

- Access: Active Customer + consent.
- Request: Complete profile fields as registration; middle_name nullable. Reject id/user_id/email/role/status/password/photo storage fields.
- Response: HTTP 200; `{message:string,account:Account,customer:Navigation}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/account-management.json).

## op-009

`PATCH /api/v1/customer/account/password`

- Access: Active Customer + consent.
- Request: current_password required and matches server hash; new password confirmed≥8 mixed case + digit; identity/email/role/status prohibited.
- Response: HTTP 200; `{message:string}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/account-management.json).

## op-010

`GET /api/v1/customer/account/profile-photo`

- Access: Active Customer + consent.
- Request: POST multipart photo: JPEG/PNG/WebP, strictly<10485760 bytes, one matching extension; GET/DELETE no body.
- Response: HTTP 200; `image bytes (private)`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: GET Content-Type image MIME, private/no-store; missing photo 404. Binary fixture represented by metadata only.
- [Synthetic examples](examples/account-management.json).

## op-011

`POST /api/v1/customer/account/profile-photo`

- Access: Active Customer + consent.
- Request: Multipart photo: JPEG/PNG/WebP, strictly<10485760 bytes, one matching extension; ≤8000 pixels per edge and ≤40000000 total pixels.
- Response: HTTP 200; `{message:string,account:Account,customer:Navigation}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Audit B04 (2026-10-10): isolated full decode/rewrite rejects malformed images/decoder warnings and processing failures with `422` errors on `photo`; prior photo survives rejection. Stored rewrite retains format/transparency, removes metadata and is strictly under 10 MiB. GET remains private/no-store. External client/live acceptance is pending.
- [Synthetic examples](examples/account-management.json).

## op-012

`DELETE /api/v1/customer/account/profile-photo`

- Access: Active Customer + consent.
- Request: POST multipart photo: JPEG/PNG/WebP, strictly<10485760 bytes, one matching extension; GET/DELETE no body.
- Response: HTTP 200; `{message:string,account:Account,customer:Navigation}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: GET Content-Type image MIME, private/no-store; missing photo 404. Binary fixture represented by metadata only.
- [Synthetic examples](examples/account-management.json).

## op-013

`GET /api/v1/customer/account/notification-preferences`

- Access: Active Customer + consent.
- Request: PATCH promotional_in_app_opted_in required boolean; default off. GET no input.
- Response: HTTP 200; `{data:Preference}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/account-management.json).

## op-014

`PATCH /api/v1/customer/account/notification-preferences`

- Access: Active Customer + consent.
- Request: PATCH promotional_in_app_opted_in required boolean; default off. GET no input.
- Response: HTTP 200; `{data:Preference}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/account-management.json).

## op-015

`GET /api/v1/customer/addresses`

- Access: Active Customer + consent.
- Request: POST/PATCH complete fields: type shipping|billing|both; label nullable ≤80; recipient_name/address_line_1/barangay/city_municipality/province/region/country required strings≤255; contact_number≤32; postal_code≤10; address_line_2 nullable ≤255; coordinates nullable numeric pair latitude ±90/longitude ±180; is_default optional bool; user_id prohibited. GET/DELETE no body.
- Response: HTTP 200; `{data:Address[]}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/address-book.json).

## op-016

`POST /api/v1/customer/addresses`

- Access: Active Customer + consent.
- Request: POST/PATCH complete fields: type shipping|billing|both; label nullable ≤80; recipient_name/address_line_1/barangay/city_municipality/province/region/country required strings≤255; contact_number≤32; postal_code≤10; address_line_2 nullable ≤255; coordinates nullable numeric pair latitude ±90/longitude ±180; is_default optional bool; user_id prohibited. GET/DELETE no body.
- Response: HTTP 201; `{data:Address}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/address-book.json).

## op-017

`PATCH /api/v1/customer/addresses/{address}`

- Access: Active Customer + consent.
- Request: POST/PATCH complete fields: type shipping|billing|both; label nullable ≤80; recipient_name/address_line_1/barangay/city_municipality/province/region/country required strings≤255; contact_number≤32; postal_code≤10; address_line_2 nullable ≤255; coordinates nullable numeric pair latitude ±90/longitude ±180; is_default optional bool; user_id prohibited. GET/DELETE no body.
- Response: HTTP 200; `{data:Address}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/address-book.json).

## op-018

`DELETE /api/v1/customer/addresses/{address}`

- Access: Active Customer + consent.
- Request: POST/PATCH complete fields: type shipping|billing|both; label nullable ≤80; recipient_name/address_line_1/barangay/city_municipality/province/region/country required strings≤255; contact_number≤32; postal_code≤10; address_line_2 nullable ≤255; coordinates nullable numeric pair latitude ±90/longitude ±180; is_default optional bool; user_id prohibited. GET/DELETE no body.
- Response: HTTP 204; `No response body (204)`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/address-book.json).

## op-019

`GET /api/v1/customer/products/search`

- Access: Public.
- Request: q required trimmed scalar string 1–100; page optional int 1–10000; limit optional int 8–50 default 20; repeated/array query rejected.
- Response: HTTP 200; `{items:Product[],pagination:Pagination}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/search.json).

## op-020

`GET /api/v1/customer/search/shops`

- Access: Public.
- Request: q required trimmed scalar string 1–100; page optional int 1–10000; limit optional int 8–50 default 20; repeated/array query rejected.
- Response: HTTP 200; `{items:Shop[],pagination:Pagination}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/search.json).

## op-021

`GET /api/v1/customer/shops`

- Access: Public.
- Request: shop_category optional active business-category slug≤100; page 1–10000; limit 8–50 default 20; unknown query keys rejected.
- Response: HTTP 200; `{items:Shop[],pagination:Pagination,categories:Category[]}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/browse-shop.json).

## op-022

`GET /api/v1/customer/shops/{slug}/products`

- Access: Public.
- Request: q optional nullable trimmed string≤100; category optional scalar slug≤100, must belong to this Shop; page1–10000; limit8–50 default 20; unknown/repeated/array keys rejected.
- Response: HTTP 200; `{items:Product[],pagination:Pagination,categories:Category[],shop:Shop}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/browse-shop.json).

## op-023

`GET /api/v1/customer/shops/{slug}`

- Access: Public.
- Request: Visible Shop slug; no body.
- Response: HTTP 200; `{data:Shop}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/browse-shop.json).

## op-024

`GET /api/v1/products/{id}`

- Access: Public.
- Request: Product UUID route; currently published visible Product required.
- Response: HTTP 200; `{data:ProductDetail}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/view-product.json).

## op-025

`GET /api/v1/customer/cart`

- Access: Active Customer + consent.
- Request: No input.
- Response: HTTP 200; `{data:Cart}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: POST increments an existing configuration; PATCH may merge lines and change line IDs. Response status 200 for all four operations.
- [Synthetic examples](examples/view-cart.json).

## op-026

`POST /api/v1/customer/cart/items`

- Access: Active Customer + consent.
- Request: product_id UUID; variant_id present nullable UUID; quantity int 1–2147483647; server enforces visibility/complete variant/stock.
- Response: HTTP 200; `{data:Cart}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: POST increments an existing configuration; PATCH may merge lines and change line IDs. Response status 200 for all four operations.
- [Synthetic examples](examples/view-cart.json).

## op-027

`PATCH /api/v1/customer/cart/items/{item}`

- Access: Active Customer + consent.
- Request: quantity int 1–2147483647 and/or variant_id nullable UUID; at least one supported field; variant must belong to Product.
- Response: HTTP 200; `{data:Cart}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: POST increments an existing configuration; PATCH may merge lines and change line IDs. Response status 200 for all four operations.
- [Synthetic examples](examples/view-cart.json).

## op-028

`DELETE /api/v1/customer/cart/items/{item}`

- Access: Active Customer + consent.
- Request: Owned Cart Item UUID; no body.
- Response: HTTP 200; `{data:Cart}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: POST increments an existing configuration; PATCH may merge lines and change line IDs. Response status 200 for all four operations.
- [Synthetic examples](examples/view-cart.json).

## op-029

`POST /api/v1/customer/checkout/quote`

- Access: Active Customer + consent.
- Request: mode cart|buy_now; exactly cart_item_ids distinct UUID[] min1 OR buy_now product_id UUID, present nullable variant_id UUID, quantity1–2147483647; address_id owned UUID; payment_method cod; optional vouchers max20 {voucher_id distinct UUID,target_shop_id UUID}; optional logistics_selections max50 {shop_id distinct UUID,logistics_organization_id UUID}; no owner/prices/status.
- Response: HTTP 200; `{data:Quote}`.
- Retry: No idempotency key; each deliberate quote request creates a new expiring quote, never places or reserves.
- Notes: Current provider selection/DTO contract is not established as adopted by the imported client (G25). Selections participate in normalized quote and placement hashes.
- [Synthetic examples](examples/checkout-order.json); [shipping selection](shipping-selection.md).

## op-030

`POST /api/v1/customer/checkout/place`

- Access: Active Customer + consent.
- Request: mode cart|buy_now; exactly cart_item_ids distinct UUID[] min1 OR buy_now product_id UUID, present nullable variant_id UUID, quantity1–2147483647; address_id owned UUID; payment_method cod; optional vouchers max20 {voucher_id distinct UUID,target_shop_id UUID}; optional logistics_selections max50 {shop_id distinct UUID,logistics_organization_id UUID}; no owner/prices/status. quote_id UUID + UUID header.
- Response: HTTP 200; `{data:Batch}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Current provider selection/DTO contract is not established as adopted by the imported client (G25). Selections participate in normalized quote and placement hashes.
- [Synthetic examples](examples/checkout-order.json); [shipping selection](shipping-selection.md).

## op-031

`GET /api/v1/customer/checkout/{batch}`

- Access: Active Customer + consent.
- Request: Owned batch UUID; no body.
- Response: HTTP 200; `{data:Batch}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/checkout-order.json).

## op-032

`GET /api/v1/customer/orders`

- Access: Active Customer + consent.
- Request: group optional to_pay|to_prepare|to_ship|out_for_delivery|completed|cancelled_issue; page1–10000; per_page1–50 default 15.
- Response: HTTP 200; `{data:OrderSummary[],links:PageLinks,meta:PageMeta,filters:OrderFilters}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/order-status.json).

## op-033

`GET /api/v1/customer/orders/{order}`

- Access: Active Customer + consent.
- Request: Owned Order UUID; no input.
- Response: HTTP 200; `{data:Order}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/order-status.json).

## op-034

`GET /api/v1/customer/orders/{order}/tracking`

- Access: Active Customer + consent.
- Request: page1–10000; per_page1–50 default 25.
- Response: HTTP 200; `{data:Tracking[],links:PageLinks,meta:PageMeta}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/order-status.json).

## op-035

`POST /api/v1/customer/orders/{order}/cancel`

- Access: Active Customer + consent.
- Request: reason optional nullable string≤500; UUID header; placed COD only.
- Response: HTTP 200; `{data:Order}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/order-modification-cancellation.json).

## op-036

`PATCH /api/v1/customer/orders/{order}/modification`

- Access: Active Customer + consent.
- Request: address_id owned shipping UUID; expected_revision optional nullable int≥1 (send deliveryAddress.version); UUID header; placed COD only.
- Response: HTTP 200; `{data:Order}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Only recipient/contact may change at the same complete trimmed location and seven-decimal pin; absent pins must remain absent. `422 ADDRESS_LOCATION_CHANGE_NOT_ALLOWED` identifies `address_id`; `409 ADDRESS_UNCHANGED` means no contact change. The edited original Address Book row is allowed; frozen pricing/provider/route remain unchanged.
- [Synthetic examples](examples/order-modification-cancellation.json).

## op-037

`GET /api/v1/customer/wishlist`

- Access: Active Customer + consent.
- Request: cursor optional opaque string; fixed20 entries; no client limit contract.
- Response: HTTP 200; `{data:WishlistItem[],links:CursorLinks,meta:CursorMeta}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/wishlist.json).

## op-038

`GET /api/v1/customer/wishlist/status`

- Access: Active Customer + consent.
- Request: product_ids UUID[] distinct1–50 (encode product_ids[0], etc.).
- Response: HTTP 200; `{data:Map<UUID,bool>}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/wishlist.json).

## op-039

`PUT /api/v1/customer/wishlist/{product}`

- Access: Active Customer + consent.
- Request: UUID Product; empty body, all supplied fields prohibited.
- Response: HTTP 200; `{data:{productId:UUID,saved:bool,savedAt?:timestamp}}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/wishlist.json).

## op-040

`DELETE /api/v1/customer/wishlist/{product}`

- Access: Active Customer + consent.
- Request: UUID Product; empty body, all supplied fields prohibited.
- Response: HTTP 200; `{data:{productId:UUID,saved:bool,savedAt?:timestamp}}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/wishlist.json).

## op-041

`GET /api/v1/customer/recently-viewed`

- Access: Active Customer + consent.
- Request: cursor opaque≤2048; limit1–50 default 20; unknown keys rejected.
- Response: HTTP 200; `{data:RecentItem[],links:CursorLinks,meta:CursorMeta}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: PUT updates view time, not an exact-time replay guarantee. Merge uses newest eligible timestamps; unavailable Products omitted.
- [Synthetic examples](examples/recently-viewed-items.json).

## op-042

`PUT /api/v1/customer/recently-viewed/{product}`

- Access: Active Customer + consent.
- Request: No body; Product UUID when present.
- Response: HTTP 200; `{data:{productId:UUID,lastViewedAt:timestamp}}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: PUT updates view time, not an exact-time replay guarantee. Merge uses newest eligible timestamps; unavailable Products omitted.
- [Synthetic examples](examples/recently-viewed-items.json).

## op-043

`DELETE /api/v1/customer/recently-viewed/{product}`

- Access: Active Customer + consent.
- Request: No body; Product UUID when present.
- Response: HTTP 200; `{data:{productId:UUID,removed:bool}}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: PUT updates view time, not an exact-time replay guarantee. Merge uses newest eligible timestamps; unavailable Products omitted.
- [Synthetic examples](examples/recently-viewed-items.json).

## op-044

`DELETE /api/v1/customer/recently-viewed`

- Access: Active Customer + consent.
- Request: No body; Product UUID when present.
- Response: HTTP 200; `{data:{cleared:bool,removedCount:int}}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: PUT updates view time, not an exact-time replay guarantee. Merge uses newest eligible timestamps; unavailable Products omitted.
- [Synthetic examples](examples/recently-viewed-items.json).

## op-045

`POST /api/v1/customer/recently-viewed/merge`

- Access: Active Customer + consent.
- Request: items1–12 [{productId distinct UUID,viewedAt optional nullable ISO date≤now and≥now−365d}]; no unknown keys.
- Response: HTTP 200; `{data:{mergedProductIds:UUID[],mergedCount:int}}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: PUT updates view time, not an exact-time replay guarantee. Merge uses newest eligible timestamps; unavailable Products omitted.
- [Synthetic examples](examples/recently-viewed-items.json).

## op-046

`POST /api/v1/customer/products/resolve`

- Access: Public.
- Request: productIds distinct UUID[] 1–12; no unknown keys.
- Response: HTTP 200; `{items:Product[]}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: PUT updates view time, not an exact-time replay guarantee. Merge uses newest eligible timestamps; unavailable Products omitted.
- [Synthetic examples](examples/recently-viewed-items.json).

## op-047

`GET /api/v1/customer/home`

- Access: Public/optional identity.
- Request: limit int8–50 default 20; recommendations additionally cursor nullable opaque≤2048 with server validation.
- Response: HTTP 200; `Home (top-level)`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Any authenticated Home response private/no-store; guest explicitly credential-free. Never trust Home cartItemCount placeholder.
- [Synthetic examples](examples/customer-homepage.json).

## op-048

`GET /api/v1/customer/home/recommendations`

- Access: Public/optional identity.
- Request: limit int8–50 default 20; recommendations additionally cursor nullable opaque≤2048 with server validation.
- Response: HTTP 200; `{recommendations:Recommendations}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Any authenticated Home response private/no-store; guest explicitly credential-free. Never trust Home cartItemCount placeholder.
- [Synthetic examples](examples/customer-homepage.json).

## op-049

`GET /api/v1/products/{product}/questions`

- Access: Public.
- Request: page1–10000; limit1–50 default 10.
- Response: HTTP 200; `{data:Question[],links:PageLinks,meta:PageMeta}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/product-qa.json).

## op-050

`POST /api/v1/products/{product}/questions`

- Access: Active Customer + consent.
- Request: question required trimmed plain text≤1,000; rejects unsafe HTML/Markdown/control characters and extra fields; UUID header.
- Response: HTTP 201; `{data:Question}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/product-qa.json).

## op-051

`GET /api/v1/products/{product}/reviews`

- Access: Public.
- Request: page1–10000; limit1–50 default 10.
- Response: HTTP 200; `{data:Review[],links:PageLinks,meta:PageMeta,summary:{averageRating:number?,reviewCount:int,distribution:Map<string,int>}}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/product-review-ratings.json).

## op-052

`POST /api/v1/customer/order-items/{orderItem}/review`

- Access: Active Customer + consent.
- Request: rating int 1–5; body required trimmed plain text≤2,000; unsafe markup/control characters and extra fields rejected; delivered owned Order Item.
- Response: HTTP 201; `{data:Review}`.
- Retry: Same normalized rating/body for same Order Item returns same Review (200 replay/201 created); changed content conflicts. No header key required.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/product-review-ratings.json).

## op-053

`POST /api/v1/customer/reviews/{review}/images`

- Access: Active Customer + consent.
- Request: multipart image JPEG/PNG/WebP strictly <10 MiB; one matching extension; ≤8000 edge/40M pixels; maximum5 photos; owned Review.
- Response: HTTP 201; `{data:ReviewPhoto}`.
- Retry: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/product-review-ratings.json).

## op-054

`GET /api/v1/customer/notifications`

- Access: Active Customer + consent.
- Request: status nullable all|unread|read; per_page1–50 default 20; page uses framework paginator.
- Response: HTTP 200; `{data:Notification[],links:PageLinks,meta:PageMeta}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/notifications.json).

## op-055

`GET /api/v1/customer/notifications/{notification}`

- Access: Active Customer + consent.
- Request: Owned notification UUID; no body.
- Response: HTTP 200; `{data:Notification}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/notifications.json).

## op-056

`POST /api/v1/customer/notifications/{notification}/read`

- Access: Active Customer + consent.
- Request: Owned notification UUID; no body.
- Response: HTTP 200; `{data:Notification}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/notifications.json).

## op-057

`GET /api/v1/customer/conversations`

- Access: Active Customer + consent.
- Request: cursor opaque≤2048; fixed20 inbox/fixed30 history; no limit field.
- Response: HTTP 200; `{items:ShopConversation[],next_cursor:string?,unread_count:int}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/chat-messaging.json).

## op-058

`POST /api/v1/customer/conversations`

- Access: Active Customer + consent.
- Request: shop_id UUID; body trimmed string 1–2000; optional context_type product|order with context_id UUID; UUID header.
- Response: HTTP 201; `{conversation:ShopConversation,message:ShopMessage}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/chat-messaging.json).

## op-059

`GET /api/v1/customer/conversations/{conversation}`

- Access: Active Customer + consent.
- Request: No parameters.
- Response: HTTP 200; `{data:ShopConversation}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/chat-messaging.json).

## op-060

`GET /api/v1/customer/conversations/{conversation}/messages`

- Access: Active Customer + consent.
- Request: cursor opaque≤2048; fixed20 inbox/fixed30 history; no limit field.
- Response: HTTP 200; `{items:ShopMessage[],next_cursor:string?}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/chat-messaging.json).

## op-061

`POST /api/v1/customer/conversations/{conversation}/messages`

- Access: Active Customer + consent.
- Request: body trimmed1–2000; UUID header; Shop allows optional validated product|order context_type/context_id; operational sends body only.
- Response: HTTP 201; `{conversation:ShopConversation,message:ShopMessage}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/chat-messaging.json).

## op-062

`POST /api/v1/customer/conversations/{conversation}/read`

- Access: Active Customer + consent.
- Request: sequence required int≥1, cannot exceed committed history; monotonic.
- Response: HTTP 200; `{data:ShopConversation}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/chat-messaging.json).

## op-063

`GET /api/v1/customer/conversations/unread-count`

- Access: Active Customer + consent.
- Request: No parameters.
- Response: HTTP 200; `{unread_count:int}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/chat-messaging.json).

## op-064

`GET /api/v1/customer/logistics-conversations`

- Access: Active Customer + consent.
- Request: cursor opaque≤2048; limit1–50 default 20.
- Response: HTTP 200; `{data:LogisticsConversation[],meta:{next_cursor:string?,unread_count:int}}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/logistics-messaging.json).

## op-065

`POST /api/v1/customer/logistics-conversations`

- Access: Active Customer + consent.
- Request: context_type order; context_id owned Order UUID; body trimmed1–2000; UUID header; server resolves counterparty.
- Response: HTTP 201; `{conversation:LogisticsConversation,message:OperationalMessage}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/logistics-messaging.json).

## op-066

`GET /api/v1/customer/logistics-conversations/{conversation}`

- Access: Active Customer + consent.
- Request: No parameters.
- Response: HTTP 200; `{data:LogisticsConversation}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/logistics-messaging.json).

## op-067

`GET /api/v1/customer/logistics-conversations/{conversation}/messages`

- Access: Active Customer + consent.
- Request: cursor opaque≤2048; limit1–50 default 20.
- Response: HTTP 200; `{data:OperationalMessage[],meta:{next_cursor:string?}}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/logistics-messaging.json).

## op-068

`POST /api/v1/customer/logistics-conversations/{conversation}/messages`

- Access: Active Customer + consent.
- Request: body trimmed1–2000; UUID header; Shop allows optional validated product|order context_type/context_id; operational sends body only.
- Response: HTTP 201; `{conversation:LogisticsConversation,message:OperationalMessage}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/logistics-messaging.json).

## op-069

`POST /api/v1/customer/logistics-conversations/{conversation}/read`

- Access: Active Customer + consent.
- Request: last_read_sequence required int≥1, cannot exceed committed history; monotonic.
- Response: HTTP 200; `{data:LogisticsConversation}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/logistics-messaging.json).

## op-070

`GET /api/v1/customer/courier-conversations`

- Access: Active Customer + consent.
- Request: cursor opaque≤2048; limit1–50 default 20.
- Response: HTTP 200; `{data:CourierConversation[],meta:{next_cursor:string?,unread_count:int}}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/courier-messaging.json).

## op-071

`POST /api/v1/customer/courier-conversations`

- Access: Active Customer + consent.
- Request: context_type order; context_id owned Order UUID; body trimmed1–2000; UUID header; server resolves counterparty.
- Response: HTTP 201; `{conversation:CourierConversation,message:OperationalMessage}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/courier-messaging.json).

## op-072

`GET /api/v1/customer/courier-conversations/{conversation}`

- Access: Active Customer + consent.
- Request: No parameters.
- Response: HTTP 200; `{data:CourierConversation}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/courier-messaging.json).

## op-073

`GET /api/v1/customer/courier-conversations/{conversation}/messages`

- Access: Active Customer + consent.
- Request: cursor opaque≤2048; limit1–50 default 20.
- Response: HTTP 200; `{data:OperationalMessage[],meta:{next_cursor:string?}}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/courier-messaging.json).

## op-074

`POST /api/v1/customer/courier-conversations/{conversation}/messages`

- Access: Active Customer + consent.
- Request: body trimmed1–2000; UUID header; Shop allows optional validated product|order context_type/context_id; operational sends body only.
- Response: HTTP 201; `{conversation:CourierConversation,message:OperationalMessage}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/courier-messaging.json).

## op-075

`POST /api/v1/customer/courier-conversations/{conversation}/read`

- Access: Active Customer + consent.
- Request: last_read_sequence required int≥1, cannot exceed committed history; monotonic.
- Response: HTTP 200; `{data:CourierConversation}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: Shop start/send201 including replay; operational201 created/200 replay. History page selected newest-first but returned ascending; merge by ID/sequence, retain older cursor gaps.
- [Synthetic examples](examples/courier-messaging.json).

## op-076

`GET /api/v1/customer/courier-conversations/order-context/{order}`

- Access: Active Customer + consent.
- Request: Owned Order UUID; read creates no thread.
- Response: HTTP 200; `{data:CourierOrderContext}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/courier-messaging.json).

## op-077

`GET /api/v1/customer/support-tickets`

- Access: Active Customer + consent.
- Request: cursor≤2048; limit1–50 default 20; status open|in_progress|waiting_for_requester|resolved, category general|account|order|delivery optional; omit Admin-only assignee.
- Response: HTTP 200; `{items:Ticket[],next_cursor:string?}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Write201 created/recorded201 replay. Customer replies reopen waiting_for_requester/resolved. Inbox/detail cursor paging uses Laravel request-bound resolver.
- [Synthetic examples](examples/support-tickets.json).

## op-078

`POST /api/v1/customer/support-tickets`

- Access: Active Customer + consent.
- Request: subject trimmed1–150, category general|account|order|delivery, body trimmed1–2000; UUID header; context/unknown keys rejected.
- Response: HTTP 201; `{data:Ticket,event:TicketEvent}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Write201 created/recorded201 replay. Customer replies reopen waiting_for_requester/resolved. Inbox/detail cursor paging uses Laravel request-bound resolver.
- [Synthetic examples](examples/support-tickets.json).

## op-079

`GET /api/v1/customer/support-tickets/{ticket}`

- Access: Active Customer + consent.
- Request: cursor≤2048 read by Laravel request resolver; limit1–50 default 30; owned ticket.
- Response: HTTP 200; `{data:Ticket,events:TicketEvent[],next_cursor:string?}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Write201 created/recorded201 replay. Customer replies reopen waiting_for_requester/resolved. Inbox/detail cursor paging uses Laravel request-bound resolver.
- [Synthetic examples](examples/support-tickets.json).

## op-080

`POST /api/v1/customer/support-tickets/{ticket}/replies`

- Access: Active Customer + consent.
- Request: body trimmed1–2000, expected_revision required int≥1; UUID header; no unknown keys.
- Response: HTTP 201; `{data:Ticket,event:TicketEvent}`.
- Retry: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- Notes: Write201 created/recorded201 replay. Customer replies reopen waiting_for_requester/resolved. Inbox/detail cursor paging uses Laravel request-bound resolver.
- [Synthetic examples](examples/support-tickets.json).

## op-081

`POST /api/v1/customer/support-tickets/{ticket}/read`

- Access: Active Customer + consent.
- Request: last_read_sequence required int≥0, ≤history; no key; monotonic.
- Response: HTTP 200; `{data:Ticket}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: Write201 created/recorded201 replay. Customer replies reopen waiting_for_requester/resolved. Inbox/detail cursor paging uses Laravel request-bound resolver.
- [Synthetic examples](examples/support-tickets.json).

## op-082

`GET /api/v1/policy-consent/status`

- Access: Active policy actor.
- Request: No query/body; policy types terms_of_service|privacy_policy; history version positive integer.
- Response: HTTP 200; `{data:Consent}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/policy-viewing-consent.json).

## op-083

`POST /api/v1/policy-consent/{type}/versions/{version}/accept`

- Access: Active policy actor.
- Request: confirmation required boolean true; type terms_of_service|privacy_policy; version current positive integer; no auto-accept.
- Response: HTTP 200; `{data:PolicyAcceptance}`.
- Retry: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/policy-viewing-consent.json).

## op-084

`GET /api/v1/platform/policies/{type}`

- Access: Public.
- Request: No query/body; policy types terms_of_service|privacy_policy; history version positive integer.
- Response: HTTP 200; `{data:PublicPolicy}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/policy-viewing-consent.json).

## op-085

`GET /api/v1/platform/policies/{type}/history`

- Access: Public.
- Request: No query/body; policy types terms_of_service|privacy_policy; history version positive integer.
- Response: HTTP 200; `{data:PolicyHistory}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/policy-viewing-consent.json).

## op-086

`GET /api/v1/platform/policies/{type}/history/{version}`

- Access: Public.
- Request: No query/body; policy types terms_of_service|privacy_policy; history version positive integer.
- Response: HTTP 200; `{data:PublicPolicy}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/policy-viewing-consent.json).

## op-087

`GET /api/v1/platform/announcements`

- Access: Public.
- Request: No query/body; policy types terms_of_service|privacy_policy; history version positive integer.
- Response: HTTP 200; `{data:Announcement[]}`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: Laravel rechecks current ownership and visibility.
- [Synthetic examples](examples/policy-viewing-consent.json).

## op-088

`GET /api/v1/product-media/{media}`

- Access: Public.
- Request: Use returned safe asset URL; campaign variant desktop|mobile; current owning visibility required.
- Response: HTTP 200; `image bytes with declared MIME; 404 when unavailable`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: No JSON success body. Synthetic fixture records response content type only.
- [Synthetic examples](examples/view-product.json).

## op-089

`GET /api/v1/product-description-assets/{asset}`

- Access: Public.
- Request: Use returned safe asset URL; campaign variant desktop|mobile; current owning visibility required.
- Response: HTTP 200; `image bytes with declared MIME; 404 when unavailable`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: No JSON success body. Synthetic fixture records response content type only.
- [Synthetic examples](examples/view-product.json).

## op-090

`GET /api/v1/product-review-images/{image}`

- Access: Public.
- Request: Use returned safe asset URL; campaign variant desktop|mobile; current owning visibility required.
- Response: HTTP 200; `image bytes with declared MIME; 404 when unavailable`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: No JSON success body. Synthetic fixture records response content type only.
- [Synthetic examples](examples/view-product.json).

## op-091

`GET /api/v1/homepage-advertisement-images/{campaign}/{variant}`

- Access: Public.
- Request: Use returned safe asset URL; campaign variant desktop|mobile; current owning visibility required.
- Response: HTTP 200; `image bytes with declared MIME; 404 when unavailable`.
- Retry: Read retry after bounded backoff; reject obsolete session/query generations.
- Notes: No JSON success body. Synthetic fixture records response content type only.
- [Synthetic examples](examples/view-product.json).


## op-092

`GET /api/v1/address-options/regions`

- Access: Public.
- Request: No query.
- Response: HTTP 200; `{options:AddressOption[]}`.
- Retry: Read retry; bundled/manual fallback on503.
- [Synthetic examples](examples/address-options.json).

## op-093

`GET /api/v1/address-options/provinces`

- Access: Public.
- Request: reg required ten-digit string; validate exact parent hierarchy.
- Response: HTTP 200; `{options:AddressOption[]}`.
- Retry: Read retry; bundled/manual fallback on503.
- [Synthetic examples](examples/address-options.json).

## op-094

`GET /api/v1/address-options/municipalities`

- Access: Public.
- Request: reg required ten-digit string; prv optional nullable ten-digit string; validate exact parent hierarchy.
- Response: HTTP 200; `{options:AddressOption[]}`.
- Retry: Read retry; bundled/manual fallback on503.
- [Synthetic examples](examples/address-options.json).

## op-095

`GET /api/v1/address-options/barangays`

- Access: Public.
- Request: reg required ten-digit string; mun required ten-digit string; prv optional nullable ten-digit string; validate exact parent hierarchy.
- Response: HTTP 200; `{options:AddressOption[]}`.
- Retry: Read retry; bundled/manual fallback on503.
- [Synthetic examples](examples/address-options.json).

## op-096

`POST /api/v1/customer/checkout/logistics-options`

- Access: Active Customer + consent.
- Request: mode cart|buy_now; exactly cart_item_ids distinct UUID[] min1 OR buy_now product_id UUID, present nullable variant_id UUID, quantity1–2147483647; address_id owned UUID; payment_method cod; optional vouchers max20 {voucher_id distinct UUID,target_shop_id UUID}; optional logistics_selections max50 {shop_id distinct UUID,logistics_organization_id UUID}; no owner/prices/status.
- Response: HTTP 200; `{data:LogisticsOptions}`.
- Retry: Read-only calculation via POST; no quote, reservation or durable key. Retry the same intent with bounded backoff and session/query guards.
- Notes: Runs owned address/item/stock validation. Provider and voucher selections are validated structurally but not applied in options-only calculation. Empty options are a successful read, not quote eligibility; G25 adoption pending.
- [Synthetic examples](examples/checkout-order.json); [shipping selection](shipping-selection.md).

Current shipping inspection: `22b0a48f9575ead182d03c35ab87345711c23b90`; imported client adoption remains `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50` (G25). Existing operation IDs are stable.
