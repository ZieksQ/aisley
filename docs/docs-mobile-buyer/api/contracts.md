# Typed API requests and DTOs

Backend inspected at the [recorded baseline](../references/source-provenance.md); all Dart models/parsers pending. [Endpoint inventory](endpoints.md) defines methods and gates; [request/Resource field index](field-index.md) records upstream field names.

Use immutable typed models with explicit JSON-key mapping. UUIDs and opaque cursors are strings; timestamps are ISO-8601 parsed as UTC then displayed locally; birth dates are date-only. Distinguish absent, null, empty and false. Validate required structures and tolerate additive optional fields; unknown statuses render safe text and disable unsupported actions. A malformed success body is a decode failure, never an empty success.

There is no universal casing/envelope. Account, catalog, Address and Order Resources mostly use camelCase; notification, preference, policy and operational messaging fields use snake_case. Auth returns `customer`, Shop chat/support collections use `items`, while operational chat uses `data` plus `meta`. Use per-endpoint decoders.

## Core payloads

| Contract | Fields and semantics |
| --- | --- |
| Navigation | `customer: {id, displayName?, avatarUrl?, role, status}`; optional private avatar URL requires authenticated bytes |
| Account | `data: {id,email,role,status,profile:{firstName,middleName,lastName,contactNumber,sex,birthDate,age,profilePhotoUrl},security:{emailEditable,passwordChangeRequiresCurrentPassword}}` |
| Home | Top-level `{viewer,advertisementLayer,campaigns,quickActions,categories,flashDeals,topProducts,recentlyViewed,recommendations}`; recommendations read returns `{recommendations:{items,nextCursor,pageSize}}`; no universal `data` wrapper |
| Product card | `id,slug,title,thumbnailUrl,price,originalPrice,minPrice,maxPrice,discountPercent,averageRating,reviewCount,soldCount,stockStatus,shop,badges`; numeric display prices; nullable original/range/rating |
| Product Detail | `data` Resource with `shortDescription`, `descriptionMarkdown`, `specifications`, numeric prices, `availability`, `media`, ordered `optionGroups`, `variants`, safe `shop`; variant `optionValueIds` defines combinations |
| Shop summary | `id,slug,name,description,logoUrl,bannerUrl,category`; category may be null; Seller PII excluded |
| Search/Shop pages | Search `{items,pagination}`; directory `{items,categories,pagination}`; Shop detail `{data}`; Shop Products `{shop,categories,items,pagination}`; pagination `currentPage,lastPage,perPage,total` |
| Address | `{id,type,label,recipientName,contactNumber,addressLine1,addressLine2,barangay,cityMunicipality,province,region,postalCode,country,latitude,longitude,isDefault}`; coordinates nullable; request keys snake_case |
| Cart | `data:{id,itemCount,distinctItemCount,subtotal,availableSubtotal,items}`; counts/quantity integers and totals numeric display values; line availability is server-derived |
| Wishlist/history | Cursor Resource collection `{data,links,meta}`; Wishlist items carry Product and saved time, history `{product,lastViewedAt}`. Guest resolver is `{items}`; merge result `{data:{mergedProductIds,mergedCount}}` |
| Quote | `data:{quoteId,expiresAt,mode,paymentMethod,address,groups,summary}`; groups include lines, server totals, `shippingQuote`, `availableVouchers`, `appliedVouchers` |
| Batch | `data:{id,currency,placedAt,orders}`; each Order has immutable items/address/vouchers/shipping/totals and its own reference/status/detailUrl |
| Order | `data` with reference/status/group labels, safe Shop, items/review hints, `deliveryAddress.version`, payment, snapshots/totals, timeline/count/hasMore, trackingUrl, safe delivery Courier, unavailable `map`, server actions |
| Q&A | Page collection `{data,links,meta}`; item `{id,question,askedAt,answer,answeredAt,sellerLabel}` with nullable unanswered fields |
| Review | `data` Resource includes `id,rating,body,verifiedPurchase,authorLabel,createdAt,photos,sellerResponse`; author is a safe label; Seller response read-only |
| Tracking | Page Resource collection `{data,links,meta}`; safe event keys are in OrderTrackingResource. Order list adds `filters:{selected,tabs}` alongside its Resource page |
| Notification | `data` Resources: `id,type,title,summary,order_id,order_reference,status,read_at,created_at,resource_type,resource_id,product_id,destination`; page list has Laravel `links/meta`, not cursor/chat envelopes |
| Preferences | `data:{promotional_in_app_opted_in,promotional_in_app_opted_in_at}`; update only the boolean; default off |
| Consent status | `data:{policies,all_required_accepted}`; each policy includes type/label/required/accepted/accepted_at/current_version/accepted_version |

Product/Cart numeric prices are informational. Quote/batch/Order monetary values follow fixed-precision string conventions with currency, currently `PHP`. Parse amounts without floating-point arithmetic for exact display; use a decimal-safe integer minor-unit representation where needed. Never turn a formatted card price or client sum into the authoritative placement total. Latitude/longitude may be serialized as number/string depending on their Resource/model cast; normalize through a validated numeric adapter with range/pair checks.

## Checkout intent and result

For `buy_now`, send `mode`, `buy_now:{product_id,variant_id:null|UUID,quantity}`, `address_id`, `payment_method:"cod"`, and optional `vouchers:[{voucher_id,target_shop_id}]`. `variant_id` must be present, including null. For `cart`, replace `buy_now` with distinct owned `cart_item_ids`. Never mix modes or send computed prices/totals, shipping/provider IDs, status or owner.

Placement adds `quote_id` and UUID `Idempotency-Key`; success is `200 {data:CheckoutBatch}` including replay. Defaults currently make quote lifetime 15 minutes; honor returned `expiresAt`. Retain exact key, quote and normalized intent after uncertainty. `409 IDEMPOTENCY_KEY_REUSED` means changed payload under one key; `QUOTE_ALREADY_PLACED` prevents another key for an already placed quote. `QUOTE_EXPIRED`, `QUOTE_INPUT_CHANGED`, `QUOTE_STALE` require reviewed refresh. No GET-by-key endpoint exists.

Quote candidates contain voucher `id,code,issuerType,benefitType,valueType,value,maximumDiscount,minimumSpend,termsSummary,validFrom,validUntil,paymentMethod,stackableWith,scope,eligible,reason,saving`. Select UUIDs with target Shop, not typed voucher codes. Applied fields include qualifying basis and discount amount; placed snapshots retain terms. Zero-saving selected vouchers still redeem. Cancellation currently does not restore redemption capacity.

## Mutation details

| Intent | Existing request rules and replay boundary |
| --- | --- |
| Add Cart | `product_id,variant_id,quantity`; `variant_id` must be present, even when null; adding same configuration increments; no durable mutation idempotency contract |
| Update Cart | `quantity` and/or `variant_id`; server validates/merges and returns current projection |
| Wishlist save/remove | UUID route, no owner/pricing payload; PUT/DELETE are naturally idempotent |
| Guest resolver | `productIds:[UUID]`, at most 12; public read through POST, no private history |
| History merge | `items:[{productId,viewedAt?}]`, at most 12 by current config; timestamps not future and within configured age; malformed/duplicate input is validation, unavailable Products omitted |
| Cancel | optional `reason` ≤500; UUID key; owned eligible `placed` Order |
| Address correction | `address_id`, optional nullable integer `expected_revision` ≥1; UUID key; server state/serviceability lock |
| Q&A create | `question`, UUID key; visible Product; current maximum 1,000 characters |
| Review create | `rating` integer 1–5, `body` plain text ≤2,000; no UUID-header requirement; identical Order Item replay returns same Review, changed content conflicts |
| Profile photo | multipart `photo`; no upload idempotency promise; authenticated private reread/removal |
| Review image | multipart `image`; owner Review, configured maximum currently 5; no durable upload replay guarantee |
| Support create | `subject` 1–150, `category:general|account|order|delivery`, `body` 1–2,000; UUID key; no linked context |
| Support reply | `body` 1–2,000 and required `expected_revision` ≥1; UUID key |
| Support read | `last_read_sequence` ≥0, cannot exceed history |
| Policy accept | `confirmation:true`, current type/version route; replay safe through exact User/version acceptance |

Profile PATCH requires first_name, last_name, contact_number, sex and birth_date, with nullable middle_name; it is not an arbitrary partial profile patch. Address PATCH inherits the complete StoreAddressRequest fields. Password PATCH requires `current_password,password,password_confirmation`. Address defaults use create/update `is_default`; no separate default route. [Messaging](messaging.md) documents channel-specific start/body/read keys and envelopes.

Quote shippingQuote exposes serviceable, rateVersionId, rateVersion, billableWeightGrams, baseFee, additionalWeightFee, destinationSurcharge and eligibleLogisticsCount; it exposes a count rather than organization IDs. Keep provider selection outside Buyer checkout.

The field index is a source inventory, not a replacement for validators/services: dynamic rules, inherited validation, semantic ownership, upload inspection and server capabilities must also be applied. Before implementation refresh contract fixtures from a controlled development API and record changes. Existing source tests are references, not rerun evidence from this documentation task.
