# Request and Resource source field index

Snapshot at the backend baseline in [provenance](../references/source-provenance.md). Names below are extracted from explicit array keys in inspected source files. Request names include **prohibited fields**, dynamic/inherited validators and nested keys; their presence here is not permission to send them. Resource names include nested keys and helper arrays, not a flat schema. Use [typed contracts](contracts.md), the owning feature and current Request/service for rules/types/envelopes. Inherited rules and controller-inline validators are documented in the contract and messaging guides.

## Customer/shared Request keys

| Upstream source | Explicit fields (including prohibited keys) |
| --- | --- |
| `src/api/app/Http/Requests/Customer/AddCartItemRequest.php` | `product_id`, `variant_id`, `quantity` |
| `src/api/app/Http/Requests/Customer/AskProductQuestionRequest.php` | `question` |
| `src/api/app/Http/Requests/Customer/CancelOrderRequest.php` | `reason` |
| `src/api/app/Http/Requests/Customer/CheckoutQuoteRequest.php` | `mode`, `cart_item_ids`, `cart_item_ids.*`, `buy_now`, `buy_now.product_id`, `buy_now.variant_id`, `buy_now.quantity`, `address_id`, `payment_method`, `vouchers`, `vouchers.*.voucher_id`, `vouchers.*.target_shop_id`, `customer_id`, `shop_id`, `shipping_fee`, `subtotal`, `total`, `status` |
| `src/api/app/Http/Requests/Customer/ForgotPasswordRequest.php` | `email` |
| `src/api/app/Http/Requests/Customer/HomepageRecommendationsRequest.php` | `cursor` |
| `src/api/app/Http/Requests/Customer/HomepageRequest.php` | `limit` |
| `src/api/app/Http/Requests/Customer/ListNotificationsRequest.php` | `status`, `per_page` |
| `src/api/app/Http/Requests/Customer/ListOrderTrackingRequest.php` | `page`, `per_page` |
| `src/api/app/Http/Requests/Customer/ListOrdersRequest.php` | `group`, `page`, `per_page` |
| `src/api/app/Http/Requests/Customer/ListProductQuestionsRequest.php` | `page`, `limit` |
| `src/api/app/Http/Requests/Customer/ListProductReviewsRequest.php` | `page`, `limit` |
| `src/api/app/Http/Requests/Customer/LoginRequest.php` | `email`, `password`, `remember`, `device_name` |
| `src/api/app/Http/Requests/Customer/ModifyOrderRequest.php` | `address_id`, `expected_revision` |
| `src/api/app/Http/Requests/Customer/PlaceCheckoutRequest.php` | `quote_id` |
| `src/api/app/Http/Requests/Customer/ProductSearchRequest.php` | `q`, `page`, `limit` |
| `src/api/app/Http/Requests/Customer/ProductSummaryResolveRequest.php` | `productIds`, `productIds.*` |
| `src/api/app/Http/Requests/Customer/RecentlyViewedListRequest.php` | `cursor`, `limit` |
| `src/api/app/Http/Requests/Customer/RecentlyViewedMergeRequest.php` | `items`, `items.*`, `items.*.productId`, `items.*.viewedAt` |
| `src/api/app/Http/Requests/Customer/RegisterRequest.php` | `first_name`, `last_name`, `middle_name`, `contact_number`, `sex`, `birth_date`, `email`, `password`, `role`, `status` |
| `src/api/app/Http/Requests/Customer/ResetPasswordRequest.php` | `email`, `token`, `password` |
| `src/api/app/Http/Requests/Customer/ShopDirectoryRequest.php` | `shop_category`, `page`, `limit` |
| `src/api/app/Http/Requests/Customer/ShopProductsRequest.php` | `q`, `category`, `page`, `limit` |
| `src/api/app/Http/Requests/Customer/ShopSearchRequest.php` | Inherited/dynamic rules; inspect parent and acceptedFields |
| `src/api/app/Http/Requests/Customer/StoreAddressRequest.php` | `type`, `label`, `recipient_name`, `contact_number`, `address_line_1`, `address_line_2`, `barangay`, `city_municipality`, `province`, `region`, `postal_code`, `country`, `latitude`, `longitude`, `is_default`, `user_id` |
| `src/api/app/Http/Requests/Customer/StoreProductReviewRequest.php` | `rating`, `body` |
| `src/api/app/Http/Requests/Customer/UpdateAccountPasswordRequest.php` | `current_password`, `password`, `id`, `user_id`, `email`, `role`, `status` |
| `src/api/app/Http/Requests/Customer/UpdateAccountProfileRequest.php` | `first_name`, `middle_name`, `last_name`, `contact_number`, `sex`, `birth_date`, `id`, `user_id`, `email`, `current_password`, `password`, `password_confirmation`, `role`, `status`, `profile_photo_path`, `profile_photo_url`, `profile_photo_disk`, `profile_photo_mime`, `profile_photo_size`, `profile_photo_width`, `profile_photo_height` |
| `src/api/app/Http/Requests/Customer/UpdateAddressRequest.php` | Inherited/dynamic rules; inspect parent and acceptedFields |
| `src/api/app/Http/Requests/Customer/UpdateCartItemRequest.php` | `variant_id`, `quantity` |
| `src/api/app/Http/Requests/Customer/UpdatePromotionPreferenceRequest.php` | `promotional_in_app_opted_in` |
| `src/api/app/Http/Requests/Customer/UploadAccountProfilePhotoRequest.php` | `photo`, `id`, `user_id`, `role`, `status`, `profile_photo_path`, `profile_photo_disk`, `profile_photo_mime`, `profile_photo_size`, `profile_photo_width`, `profile_photo_height` |
| `src/api/app/Http/Requests/Customer/UploadProductReviewImageRequest.php` | `image` |
| `src/api/app/Http/Requests/Customer/WishlistMutationRequest.php` | `*` |
| `src/api/app/Http/Requests/Customer/WishlistStatusRequest.php` | `product_ids`, `product_ids.*` |
| `src/api/app/Http/Requests/Messaging/StartConversationRequest.php` | `shop_id` |
| `src/api/app/Http/Requests/Messaging/SendConversationMessageRequest.php` | `body`, `context_type`, `context_id`, `sender_user_id`, `seller_user_id`, `user_id`, `sent_at`, `attachments` |
| `src/api/app/Http/Requests/Messaging/ListConversationsRequest.php` | `cursor` |
| `src/api/app/Http/Requests/Messaging/ReadConversationRequest.php` | `sequence` |
| `src/api/app/Http/Requests/Messaging/StartCustomerLogisticsConversationRequest.php` | `context_type`, `context_id` |
| `src/api/app/Http/Requests/Messaging/StartCourierCounterpartyConversationRequest.php` | `context_type`, `context_id` |
| `src/api/app/Http/Requests/Messaging/OperationalMessageRequest.php` | `body` |
| `src/api/app/Http/Requests/Support/CreateSupportTicketRequest.php` | `subject`, `category`, `body`, `context_type`, `context_id` |
| `src/api/app/Http/Requests/Support/ListSupportTicketsRequest.php` | `cursor`, `limit`, `status`, `category`, `assignee` |
| `src/api/app/Http/Requests/Support/ReplySupportTicketRequest.php` | `body`, `expected_revision` |
| `src/api/app/Http/Requests/Support/SupportTicketMutationRequest.php` | Inherited/dynamic rules; inspect parent and acceptedFields |
| `src/api/app/Http/Requests/Policy/AcceptPolicyRequest.php` | `confirmation`, `user_id`, `role`, `policy_id`, `accepted_at` |

## Customer Resource keys (nested keys included)

| Upstream source | Serializer keys |
| --- | --- |
| `src/api/app/Http/Resources/Customer/AddressResource.php` | `id`, `type`, `label`, `recipientName`, `contactNumber`, `addressLine1`, `addressLine2`, `barangay`, `cityMunicipality`, `province`, `region`, `postalCode`, `country`, `latitude`, `longitude`, `isDefault` |
| `src/api/app/Http/Resources/Customer/CartItemResource.php` | `id`, `quantity`, `unitPrice`, `lineSubtotal`, `product`, `slug`, `name`, `url`, `variant`, `sku`, `selectedOptions`, `media`, `altText`, `availability`, `group`, `value`, `isAvailable`, `reason`, `availableQuantity` |
| `src/api/app/Http/Resources/Customer/CartResource.php` | `id`, `itemCount`, `distinctItemCount`, `subtotal`, `availableSubtotal`, `items` |
| `src/api/app/Http/Resources/Customer/CheckoutBatchResource.php` | `id`, `currency`, `placedAt`, `orders`, `reference`, `status`, `paymentMethod`, `paymentStatus`, `shop`, `name`, `items`, `productId`, `variantId`, `productName`, `variantName`, `sku`, `selectedOptions`, `unitPrice`, `quantity`, `lineSubtotal`, `address`, `recipientName`, `contactNumber`, `addressLine1`, `addressLine2`, `barangay`, `cityMunicipality`, `province`, `region`, `postalCode`, `country`, `latitude`, `longitude`, `vouchers`, `code`, `issuerType`, `benefitType`, `qualifyingBasis`, `discountAmount`, `termsSummary`, `shippingQuote`, `rateVersionId`, `rateVersion`, `billableWeightGrams`, `eligibleLogisticsCount`, `totals`, `merchandiseSubtotal`, `shippingFee`, `discount`, `shippingDiscount`, `payable`, `detailUrl` |
| `src/api/app/Http/Resources/Customer/CustomerAccountResource.php` | `id`, `email`, `role`, `status`, `profile`, `firstName`, `middleName`, `lastName`, `contactNumber`, `sex`, `birthDate`, `age`, `profilePhotoUrl`, `security`, `emailEditable`, `passwordChangeRequiresCurrentPassword` |
| `src/api/app/Http/Resources/Customer/CustomerNavigationResource.php` | `id`, `displayName`, `avatarUrl`, `role`, `status` |
| `src/api/app/Http/Resources/Customer/CustomerNotificationResource.php` | `id`, `type`, `title`, `summary`, `order_id`, `order_reference`, `status`, `read_at`, `created_at`, `resource_type`, `resource_id`, `product_id`, `destination`, `product`, `shop` |
| `src/api/app/Http/Resources/Customer/CustomerUserResource.php` | `id`, `email`, `role`, `status`, `profile`, `first_name`, `last_name`, `middle_name`, `contact_number`, `sex`, `birth_date`, `profile_photo_path` |
| `src/api/app/Http/Resources/Customer/HomepageCampaignResource.php` | `id`, `placement`, `title`, `description`, `slot`, `position`, `imageDesktopUrl`, `imageMobileUrl`, `altText`, `destinationUrl`, `startsAt`, `endsAt`, `priority`, `isActive` |
| `src/api/app/Http/Resources/Customer/HomepageCategoryResource.php` | `id`, `slug`, `name`, `imageUrl` |
| `src/api/app/Http/Resources/Customer/OrderResource.php` | `id`, `reference`, `checkoutBatchId`, `placedAt`, `latestTrackingAt`, `status`, `statusLabel`, `group`, `groupLabel`, `shop`, `slug`, `name`, `logoUrl`, `items`, `productId`, `variantId`, `productName`, `variantName`, `sku`, `selectedOptions`, `unitPrice`, `quantity`, `lineSubtotal`, `currency`, `canReview`, `reviewId`, `deliveryAddress`, `version`, `recipientName`, `contactNumber`, `addressLine1`, `addressLine2`, `barangay`, `cityMunicipality`, `province`, `region`, `postalCode`, `country`, `payment`, `method`, `vouchers`, `code`, `issuerType`, `benefitType`, `discountAmount`, `termsSummary`, `totals`, `merchandiseSubtotal`, `shippingFee`, `discount`, `shippingDiscount`, `payable`, `timeline`, `timelineCount`, `timelineHasMore`, `trackingUrl`, `delivery`, `courier`, `map`, `available`, `state`, `message`, `currentPosition`, `route`, `capturedAt`, `actions` |
| `src/api/app/Http/Resources/Customer/OrderSummaryResource.php` | `id`, `reference`, `shop`, `slug`, `name`, `logoUrl`, `itemPreview`, `productId`, `productName`, `variantName`, `quantity`, `lineCount`, `itemCount`, `status`, `statusLabel`, `group`, `groupLabel`, `latestTrackingAt`, `totals`, `merchandiseSubtotal`, `shippingFee`, `discount`, `shippingDiscount`, `payable`, `currency`, `actions`, `detailUrl` |
| `src/api/app/Http/Resources/Customer/OrderTrackingResource.php` | `id`, `status`, `label`, `eventType`, `location`, `hub`, `city`, `occurredAt` |
| `src/api/app/Http/Resources/Customer/ProductDetailResource.php` | `id`, `slug`, `title`, `shortDescription`, `descriptionMarkdown`, `specifications`, `price`, `originalPrice`, `discountPercent`, `badges`, `averageRating`, `reviewCount`, `soldCount`, `availability`, `inStock`, `stockQuantity`, `requiresVariantSelection`, `media`, `optionGroups`, `name`, `position`, `values`, `value`, `swatch`, `color`, `imageUrl`, `variants`, `shop`, `logoUrl`, `isOnVacation`, `vacationMessage`, `storefrontUrl`, `sku`, `optionValueIds`, `primaryMediaId`, `url`, `altText`, `variantId` |
| `src/api/app/Http/Resources/Customer/ProductQAResource.php` | `id`, `question`, `askedAt`, `answer`, `answeredAt`, `sellerLabel` |
| `src/api/app/Http/Resources/Customer/ProductReviewImageResource.php` | `id`, `url`, `mimeType`, `width`, `height` |
| `src/api/app/Http/Resources/Customer/ProductReviewResource.php` | `id`, `rating`, `body`, `verifiedPurchase`, `authorLabel`, `createdAt`, `photos`, `sellerResponse`, `shopName`, `publishedAt` |
| `src/api/app/Http/Resources/Customer/ProductSummaryResource.php` | `id`, `slug`, `title`, `thumbnailUrl`, `price`, `originalPrice`, `minPrice`, `maxPrice`, `discountPercent`, `averageRating`, `reviewCount`, `soldCount`, `stockStatus`, `shop`, `name`, `badges`, `deal`, `stock`, `remainingStock`, `progressPercent` |
| `src/api/app/Http/Resources/Customer/RecentlyViewedItemResource.php` | `id`, `lastViewedAt`, `product` |
| `src/api/app/Http/Resources/Customer/ShopCategorySummaryResource.php` | `id`, `slug`, `name` |
| `src/api/app/Http/Resources/Customer/ShopDetailResource.php` |  |
| `src/api/app/Http/Resources/Customer/ShopSummaryResource.php` | `id`, `slug`, `name`, `description`, `logoUrl`, `bannerUrl`, `category` |
| `src/api/app/Http/Resources/Customer/WishlistItemResource.php` | `id`, `savedAt`, `product`, `requiresVariantSelection` |
| `src/api/app/Http/Resources/Support/SupportTicketView.php` | `id`, `reference`, `subject`, `category`, `status`, `revision`, `requester_role`, `requester_name`, `assignee_name`, `assignee_id`, `unread_count`, `last_activity_at`, `created_at`, `resolved_at`, `sequence`, `type`, `actor_role`, `is_mine`, `body`, `from_status`, `to_status`, `assignment_changed` |

Messaging serializer keys are defined in ConversationService, CustomerLogisticsConversationService and CourierCounterpartyConversationService; policy/quote/Home DTOs also use service/controller arrays. See the semantic guides and provenance for these sources.
