# Typed wire models

Current inspected checkout `22b0a48f9575ead182d03c35ab87345711c23b90`; reported client adoption `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50` (G25); synthetic examples, no live captures.

Every named type below is an immutable DTO definition. Fields are required unless marked `~`; `?` permits JSON null.
`UUID` = UUID string; `timestamp` = ISO-8601 UTC string; `date` = YYYY-MM-DD string.
`money` = nonnegative fixed-precision decimal string; `number` = JSON int/double; `coordinate` = numeric string or number, normalize and validate range.
`URL` = relative or absolute string: validate origin/path before navigation or authenticated fetch.
`json` preserves a stored JSON object/list; validate recognized presentation entries and ignore malformed legacy entries.
`int` never accepts a fractional value; `bool` never accepts 0/1 or a string. Lists may be empty.
An absent required key or wrong nested type is a decode error. Unknown enum values show a safe label and disable unsupported actions.
Use [operation contracts](operations.md) for envelopes and [machine-readable definitions](dto-schema.json) for fixtures.

## Enum and serializer notes

- Persisted role/token ability: `customer`. Account states: `pending`, `active`, `rejected`, `suspended`, `deactivated`.
- Sex: `male`, `female`, `non_binary`, `prefer_not_to_say`; Address type: `shipping`, `billing`, `both`; payment method supported for placement: `cod`.
- Order groups: `to_pay`, `to_prepare`, `to_ship`, `out_for_delivery`, `completed`, `cancelled_issue`; server labels/actions own display.
- Voucher issuer: `shop` or `app`; benefit: `discount` or `shipping`; value: `fixed` or `percent`.
- Shipping route status: `local`, `planned`, `unplanned`; successful quotation does not prove operational readiness. Provider projection may be null for legacy Orders.
- Policy route types: `terms_of_service`, `privacy_policy`; never expose `internal_rules`.
- Tracking `location` is an empty JSON array when both labels are absent (PHP array serialization), otherwise an object with optional `hub`/`city` strings. Normalize only this documented union.
- Product specifications retain stored JSON; recognize safe key/value or name/value entries if present. Unexpected legacy shapes show unavailable specifications rather than fail the whole Product.
- Registration `profile_photo_path` is serialized by the current Resource but normally null on creation; discard it and never treat it as a delivery URL.
- Home `viewer.cartItemCount` is a current zero placeholder; use the Cart read for an authoritative badge.
- Home fallback Campaign IDs can be `default-primary` rather than UUIDs; fallback entries omit placement/start/end/priority.
- Wishlist Product adds `requiresVariantSelection`; Product card has no such field.
- Page and cursor metadata are Laravel envelopes; extra framework metadata can be ignored. Do not synthesize a cursor from IDs.

## Navigation

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `displayName` | `string` | null allowed; required |
| `avatarUrl` | `URL` | null allowed; required |
| `role` | `string` | non-null; required |
| `status` | `string` | non-null; required |

## RegistrationCustomer

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `email` | `string` | non-null; required |
| `role` | `string` | non-null; required |
| `status` | `string` | non-null; required |
| `profile` | `RegistrationProfile` | non-null; required |

## RegistrationProfile

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `first_name` | `string` | null allowed; required |
| `last_name` | `string` | null allowed; required |
| `middle_name` | `string` | null allowed; required |
| `contact_number` | `string` | null allowed; required |
| `sex` | `string` | null allowed; required |
| `birth_date` | `date` | null allowed; required |
| `profile_photo_path` | `string` | null allowed; required |

## Account

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `email` | `string` | non-null; required |
| `role` | `string` | non-null; required |
| `status` | `string` | non-null; required |
| `profile` | `Profile` | non-null; required |
| `security` | `Security` | non-null; required |

## Profile

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `firstName` | `string` | null allowed; required |
| `middleName` | `string` | null allowed; required |
| `lastName` | `string` | null allowed; required |
| `contactNumber` | `string` | null allowed; required |
| `sex` | `string` | null allowed; required |
| `birthDate` | `date` | null allowed; required |
| `age` | `int` | null allowed; required |
| `profilePhotoUrl` | `URL` | null allowed; required |

## Security

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `emailEditable` | `bool` | non-null; required |
| `passwordChangeRequiresCurrentPassword` | `bool` | non-null; required |

## Preference

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `promotional_in_app_opted_in` | `bool` | non-null; required |
| `promotional_in_app_opted_in_at` | `timestamp` | null allowed; required |

## ShopIdentity

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `slug` | `string` | non-null; required |
| `name` | `string` | non-null; required |

## OrderShop

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `slug` | `string` | non-null; required |
| `name` | `string` | non-null; required |
| `logoUrl` | `URL` | null allowed; required |

## QuoteShop

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `name` | `string` | non-null; required |

## Category

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `slug` | `string` | non-null; required |
| `name` | `string` | non-null; required |

## Shop

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `slug` | `string` | non-null; required |
| `name` | `string` | non-null; required |
| `description` | `string` | null allowed; required |
| `logoUrl` | `URL` | null allowed; required |
| `bannerUrl` | `URL` | null allowed; required |
| `category` | `Category` | null allowed; required |

## Product

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `slug` | `string` | non-null; required |
| `title` | `string` | non-null; required |
| `thumbnailUrl` | `URL` | null allowed; required |
| `price` | `number` | non-null; required |
| `originalPrice` | `number` | null allowed; required |
| `minPrice` | `number` | null allowed; required |
| `maxPrice` | `number` | null allowed; required |
| `discountPercent` | `int` | null allowed; required |
| `averageRating` | `number` | null allowed; required |
| `reviewCount` | `int` | non-null; required |
| `soldCount` | `int` | non-null; required |
| `stockStatus` | `string` | non-null; required |
| `shop` | `ShopIdentity` | non-null; required |
| `badges` | `string[]` | non-null; required |
| `deal` | `Deal` | non-null; may be absent |

## Deal

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `stock` | `int` | non-null; required |
| `soldCount` | `int` | non-null; required |
| `remainingStock` | `int` | non-null; required |
| `progressPercent` | `int` | non-null; required |

## WishlistProduct

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `slug` | `string` | non-null; required |
| `title` | `string` | non-null; required |
| `thumbnailUrl` | `URL` | null allowed; required |
| `price` | `number` | non-null; required |
| `originalPrice` | `number` | null allowed; required |
| `minPrice` | `number` | null allowed; required |
| `maxPrice` | `number` | null allowed; required |
| `discountPercent` | `int` | null allowed; required |
| `averageRating` | `number` | null allowed; required |
| `reviewCount` | `int` | non-null; required |
| `soldCount` | `int` | non-null; required |
| `stockStatus` | `string` | non-null; required |
| `shop` | `ShopIdentity` | non-null; required |
| `badges` | `string[]` | non-null; required |
| `requiresVariantSelection` | `bool` | non-null; required |

## ProductDetail

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `slug` | `string` | non-null; required |
| `title` | `string` | non-null; required |
| `shortDescription` | `string` | null allowed; required |
| `descriptionMarkdown` | `string` | null allowed; required |
| `specifications` | `json` | null allowed; required |
| `price` | `number` | non-null; required |
| `originalPrice` | `number` | null allowed; required |
| `discountPercent` | `int` | null allowed; required |
| `badges` | `string[]` | non-null; required |
| `averageRating` | `number` | null allowed; required |
| `reviewCount` | `int` | non-null; required |
| `soldCount` | `int` | non-null; required |
| `availability` | `ProductAvailability` | non-null; required |
| `media` | `ProductMedia[]` | non-null; required |
| `optionGroups` | `OptionGroup[]` | non-null; required |
| `variants` | `Variant[]` | non-null; required |
| `shop` | `ProductShop` | non-null; required |

## Specification

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `name` | `string` | non-null; required |
| `value` | `string` | non-null; required |

## ProductAvailability

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `inStock` | `bool` | non-null; required |
| `stockQuantity` | `int` | null allowed; required |
| `requiresVariantSelection` | `bool` | non-null; required |

## ProductMedia

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | null allowed; required |
| `url` | `URL` | non-null; required |
| `altText` | `string` | non-null; required |
| `position` | `int` | non-null; required |
| `variantId` | `UUID` | null allowed; required |

## OptionGroup

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `name` | `string` | non-null; required |
| `position` | `int` | non-null; required |
| `values` | `OptionValue[]` | non-null; required |

## OptionValue

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `value` | `string` | non-null; required |
| `position` | `int` | non-null; required |
| `swatch` | `Swatch` | non-null; required |

## Swatch

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `color` | `string` | null allowed; required |
| `imageUrl` | `URL` | null allowed; required |

## Variant

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `sku` | `string` | null allowed; required |
| `optionValueIds` | `UUID[]` | non-null; required |
| `price` | `number` | non-null; required |
| `originalPrice` | `number` | null allowed; required |
| `discountPercent` | `int` | null allowed; required |
| `stockQuantity` | `int` | non-null; required |
| `inStock` | `bool` | non-null; required |
| `primaryMediaId` | `UUID` | null allowed; required |

## ProductShop

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `slug` | `string` | non-null; required |
| `name` | `string` | non-null; required |
| `logoUrl` | `URL` | null allowed; required |
| `isOnVacation` | `bool` | non-null; required |
| `vacationMessage` | `string` | null allowed; required |
| `storefrontUrl` | `URL` | non-null; required |

## Address

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `type` | `string` | non-null; required |
| `label` | `string` | null allowed; required |
| `recipientName` | `string` | non-null; required |
| `contactNumber` | `string` | non-null; required |
| `addressLine1` | `string` | non-null; required |
| `addressLine2` | `string` | null allowed; required |
| `barangay` | `string` | non-null; required |
| `cityMunicipality` | `string` | non-null; required |
| `province` | `string` | non-null; required |
| `region` | `string` | non-null; required |
| `postalCode` | `string` | non-null; required |
| `country` | `string` | non-null; required |
| `latitude` | `coordinate` | null allowed; required |
| `longitude` | `coordinate` | null allowed; required |
| `isDefault` | `bool` | non-null; required |

## AddressSnapshot

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `recipientName` | `string` | non-null; required |
| `contactNumber` | `string` | non-null; required |
| `addressLine1` | `string` | non-null; required |
| `addressLine2` | `string` | null allowed; required |
| `barangay` | `string` | non-null; required |
| `cityMunicipality` | `string` | non-null; required |
| `province` | `string` | non-null; required |
| `region` | `string` | non-null; required |
| `postalCode` | `string` | non-null; required |
| `country` | `string` | non-null; required |
| `latitude` | `coordinate` | null allowed; required |
| `longitude` | `coordinate` | null allowed; required |

## DeliveryAddress

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `version` | `int` | non-null; required |
| `recipientName` | `string` | non-null; required |
| `contactNumber` | `string` | non-null; required |
| `addressLine1` | `string` | non-null; required |
| `addressLine2` | `string` | null allowed; required |
| `barangay` | `string` | non-null; required |
| `cityMunicipality` | `string` | non-null; required |
| `province` | `string` | non-null; required |
| `region` | `string` | non-null; required |
| `postalCode` | `string` | non-null; required |
| `country` | `string` | non-null; required |

## Cart

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `itemCount` | `int` | non-null; required |
| `distinctItemCount` | `int` | non-null; required |
| `subtotal` | `number` | non-null; required |
| `availableSubtotal` | `number` | non-null; required |
| `items` | `CartItem[]` | non-null; required |

## CartItem

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `quantity` | `int` | non-null; required |
| `unitPrice` | `number` | non-null; required |
| `lineSubtotal` | `number` | non-null; required |
| `product` | `CartProduct` | non-null; required |
| `variant` | `CartVariant` | null allowed; required |
| `selectedOptions` | `SelectedOption[]` | non-null; required |
| `media` | `CartMedia` | non-null; required |
| `availability` | `CartAvailability` | non-null; required |

## CartProduct

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `slug` | `string` | non-null; required |
| `name` | `string` | non-null; required |
| `url` | `URL` | non-null; required |

## CartVariant

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `sku` | `string` | null allowed; required |

## SelectedOption

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `group` | `string` | non-null; required |
| `value` | `string` | non-null; required |

## CartMedia

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `url` | `URL` | null allowed; required |
| `altText` | `string` | non-null; required |

## CartAvailability

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `isAvailable` | `bool` | non-null; required |
| `reason` | `string` | null allowed; required |
| `availableQuantity` | `int` | non-null; required |

## WishlistItem

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `savedAt` | `timestamp` | non-null; required |
| `product` | `WishlistProduct` | non-null; required |

## RecentItem

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `lastViewedAt` | `timestamp` | non-null; required |
| `product` | `Product` | non-null; required |

## Pagination

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `currentPage` | `int` | non-null; required |
| `lastPage` | `int` | non-null; required |
| `perPage` | `int` | non-null; required |
| `total` | `int` | non-null; required |

## PageLinks

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `first` | `URL` | non-null; required |
| `last` | `URL` | non-null; required |
| `prev` | `URL` | null allowed; required |
| `next` | `URL` | null allowed; required |

## PageMeta

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `current_page` | `int` | non-null; required |
| `from` | `int` | null allowed; required |
| `last_page` | `int` | non-null; required |
| `links` | `PageLink[]` | non-null; required |
| `path` | `URL` | non-null; required |
| `per_page` | `int` | non-null; required |
| `to` | `int` | null allowed; required |
| `total` | `int` | non-null; required |

## PageLink

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `url` | `URL` | null allowed; required |
| `label` | `string` | non-null; required |
| `active` | `bool` | non-null; required |

## CursorLinks

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `first` | `URL` | null allowed; required |
| `last` | `URL` | null allowed; required |
| `prev` | `URL` | null allowed; required |
| `next` | `URL` | null allowed; required |

## CursorMeta

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `path` | `URL` | non-null; required |
| `per_page` | `int` | non-null; required |
| `next_cursor` | `string` | null allowed; required |
| `prev_cursor` | `string` | null allowed; required |

## Quote

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `quoteId` | `UUID` | non-null; required |
| `expiresAt` | `timestamp` | non-null; required |
| `mode` | `string` | non-null; required |
| `paymentMethod` | `string` | non-null; required |
| `address` | `QuoteAddress` | non-null; required |
| `groups` | `QuoteGroup[]` | non-null; required |
| `summary` | `QuoteSummary` | non-null; required |

## QuoteAddress

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `recipientName` | `string` | non-null; required |
| `contactNumber` | `string` | non-null; required |
| `addressLine1` | `string` | non-null; required |
| `addressLine2` | `string` | null allowed; required |
| `barangay` | `string` | non-null; required |
| `cityMunicipality` | `string` | non-null; required |
| `province` | `string` | non-null; required |
| `region` | `string` | non-null; required |
| `postalCode` | `string` | non-null; required |
| `country` | `string` | non-null; required |
| `label` | `string` | null allowed; required |

## QuoteGroup

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `shop` | `QuoteShop` | non-null; required |
| `items` | `QuoteItem[]` | non-null; required |
| `availableVouchers` | `Voucher[]` | non-null; required |
| `appliedVouchers` | `AppliedVoucher[]` | non-null; required |
| `shippingQuote` | `ShippingQuote` | non-null; required |
| `totals` | `Totals` | non-null; required |

## QuoteItem

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `cartItemId` | `UUID` | null allowed; required |
| `productId` | `UUID` | non-null; required |
| `variantId` | `UUID` | null allowed; required |
| `productName` | `string` | non-null; required |
| `sku` | `string` | null allowed; required |
| `selectedOptions` | `SelectedOption[]` | non-null; required |
| `unitPrice` | `money` | non-null; required |
| `quantity` | `int` | non-null; required |
| `lineSubtotal` | `money` | non-null; required |

## Voucher

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `name` | `string` | non-null; required (2026-10-09 update) |
| `code` | `string` | non-null; required |
| `issuerType` | `string` | non-null; required |
| `benefitType` | `string` | non-null; required |
| `valueType` | `string` | non-null; required |
| `value` | `money` | non-null; required |
| `maximumDiscount` | `money` | null allowed; required |
| `minimumSpend` | `money` | non-null; required |
| `termsSummary` | `string` | non-null; required |
| `validFrom` | `timestamp` | non-null; required |
| `validUntil` | `timestamp` | non-null; required |
| `paymentMethod` | `string` | null allowed; required |
| `stackableWith` | `string[]` | non-null; required |
| `scope` | `VoucherScope` | non-null; required |
| `eligible` | `bool` | non-null; required |
| `reason` | `string` | null allowed; required |
| `saving` | `money` | non-null; required |

## VoucherScope

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `productIds` | `UUID[]` | non-null; required |
| `categoryIds` | `UUID[]` | non-null; required |
| `excludedProductIds` | `UUID[]` | non-null; required |
| `excludedCategoryIds` | `UUID[]` | non-null; required |

## AppliedVoucher

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `name` | `string` | non-null; required (2026-10-09 update) |
| `code` | `string` | non-null; required |
| `issuerType` | `string` | non-null; required |
| `benefitType` | `string` | non-null; required |
| `qualifyingBasis` | `money` | non-null; required |
| `discountAmount` | `money` | non-null; required |

## ShippingQuote

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `serviceable` | `bool` | non-null; required |
| `logisticsOrganizationId` | `UUID` | non-null; required |
| `logisticsBusinessName` | `string` | non-null; required |
| `routeStatus` | `string` | non-null; required |
| `shippingFee` | `money` | non-null; required |

## Totals

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `merchandiseSubtotal` | `money` | non-null; required |
| `shippingFee` | `money` | non-null; required |
| `discount` | `money` | non-null; required |
| `shippingDiscount` | `money` | non-null; required |
| `payable` | `money` | non-null; required |
| `currency` | `string` | non-null; required |

## QuoteSummary

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `orderCount` | `int` | non-null; required |
| `merchandiseSubtotal` | `money` | non-null; required |
| `shippingFee` | `money` | non-null; required |
| `discount` | `money` | non-null; required |
| `shippingDiscount` | `money` | non-null; required |
| `payable` | `money` | non-null; required |
| `currency` | `string` | non-null; required |

## Batch

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `currency` | `string` | non-null; required |
| `placedAt` | `timestamp` | non-null; required |
| `orders` | `BatchOrder[]` | non-null; required |

## BatchOrder

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `reference` | `string` | non-null; required |
| `status` | `string` | non-null; required |
| `paymentMethod` | `string` | non-null; required |
| `paymentStatus` | `string` | non-null; required |
| `shop` | `QuoteShop` | non-null; required |
| `items` | `SnapshotItem[]` | non-null; required |
| `address` | `AddressSnapshot` | non-null; required |
| `vouchers` | `BatchVoucher[]` | non-null; required |
| `shippingQuote` | `BatchShipping` | null allowed; required |
| `totals` | `Totals` | non-null; required |
| `detailUrl` | `URL` | non-null; required |

## SnapshotItem

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `productId` | `UUID` | null allowed; required |
| `variantId` | `UUID` | null allowed; required |
| `productName` | `string` | non-null; required |
| `variantName` | `string` | null allowed; required |
| `sku` | `string` | null allowed; required |
| `selectedOptions` | `SelectedOption[]` | non-null; required |
| `unitPrice` | `money` | non-null; required |
| `quantity` | `int` | non-null; required |
| `lineSubtotal` | `money` | non-null; required |
| `currency` | `string` | non-null; required |

## ReviewableItem

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `productId` | `UUID` | null allowed; required |
| `variantId` | `UUID` | null allowed; required |
| `productName` | `string` | non-null; required |
| `variantName` | `string` | null allowed; required |
| `sku` | `string` | null allowed; required |
| `selectedOptions` | `SelectedOption[]` | non-null; required |
| `unitPrice` | `money` | non-null; required |
| `quantity` | `int` | non-null; required |
| `lineSubtotal` | `money` | non-null; required |
| `currency` | `string` | non-null; required |
| `canReview` | `bool` | non-null; required |
| `reviewId` | `UUID` | null allowed; required |

## BatchVoucher

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | null allowed; required |
| `name` | `string` | non-null; required (2026-10-09 update) |
| `code` | `string` | non-null; required |
| `issuerType` | `string` | non-null; required |
| `benefitType` | `string` | non-null; required |
| `qualifyingBasis` | `money` | non-null; required |
| `discountAmount` | `money` | non-null; required |
| `termsSummary` | `string` | non-null; required |

## OrderVoucher

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | null allowed; required |
| `code` | `string` | non-null; required |
| `issuerType` | `string` | non-null; required |
| `benefitType` | `string` | non-null; required |
| `discountAmount` | `money` | non-null; required |
| `currency` | `string` | non-null; required |
| `termsSummary` | `string` | non-null; required |

## BatchShipping

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `logisticsOrganizationId` | `UUID` | null allowed; required |
| `logisticsBusinessName` | `string` | null allowed; required |
| `routeStatus` | `string` | non-null; required |
| `shippingFee` | `money` | non-null; required |

## Order

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `reference` | `string` | non-null; required |
| `checkoutBatchId` | `UUID` | null allowed; required |
| `placedAt` | `timestamp` | non-null; required |
| `latestTrackingAt` | `timestamp` | non-null; required |
| `status` | `string` | non-null; required |
| `statusLabel` | `string` | non-null; required |
| `group` | `string` | non-null; required |
| `groupLabel` | `string` | non-null; required |
| `shop` | `OrderShop` | non-null; required |
| `items` | `ReviewableItem[]` | non-null; required |
| `deliveryAddress` | `DeliveryAddress` | non-null; required |
| `payment` | `Payment` | non-null; required |
| `vouchers` | `OrderVoucher[]` | non-null; required |
| `totals` | `Totals` | non-null; required |
| `timeline` | `Tracking[]` | non-null; required |
| `timelineCount` | `int` | non-null; required |
| `timelineHasMore` | `bool` | non-null; required |
| `trackingUrl` | `URL` | non-null; required |
| `delivery` | `Delivery` | null allowed; required |
| `map` | `UnavailableMap` | non-null; required |
| `actions` | `OrderActions` | non-null; required |
| `shippingProvider` | `ShippingProvider` | null allowed; required |

## Payment

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `method` | `string` | non-null; required |
| `status` | `string` | non-null; required |

## Delivery

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `status` | `string` | non-null; required |
| `courier` | `DeliveryCourier` | null allowed; required |

## DeliveryCourier

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `name` | `string` | non-null; required |
| `contactNumber` | `string` | null allowed; required |

## UnavailableMap

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `available` | `bool` | non-null; required |
| `state` | `string` | non-null; required |
| `message` | `string` | non-null; required |
| `currentPosition` | `null` | null allowed; required |
| `route` | `null` | null allowed; required |
| `capturedAt` | `null` | null allowed; required |

## OrderActions

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `canCancel` | `bool` | non-null; required |
| `canModify` | `bool` | non-null; required |
| `canReview` | `bool` | non-null; required |
| `modifiableFields` | `string[]` | non-null; required |

## OrderSummary

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `reference` | `string` | non-null; required |
| `shop` | `OrderShop` | non-null; required |
| `itemPreview` | `ItemPreview` | null allowed; required |
| `lineCount` | `int` | non-null; required |
| `itemCount` | `int` | non-null; required |
| `status` | `string` | non-null; required |
| `statusLabel` | `string` | non-null; required |
| `group` | `string` | non-null; required |
| `groupLabel` | `string` | non-null; required |
| `latestTrackingAt` | `timestamp` | non-null; required |
| `totals` | `Totals` | non-null; required |
| `actions` | `OrderActions` | non-null; required |
| `detailUrl` | `URL` | non-null; required |
| `shippingProvider` | `ShippingProvider` | null allowed; required |

## ItemPreview

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `productId` | `UUID` | null allowed; required |
| `productName` | `string` | non-null; required |
| `variantName` | `string` | null allowed; required |
| `quantity` | `int` | non-null; required |

## Tracking

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `status` | `string` | non-null; required |
| `label` | `string` | non-null; required |
| `eventType` | `string` | null allowed; required |
| `location` | `TrackingLocation` | non-null; required |
| `occurredAt` | `timestamp` | non-null; required |

## TrackingLocation

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `hub` | `string` | non-null; may be absent |
| `city` | `string` | non-null; may be absent |

## OrderFilters

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `selected` | `string` | null allowed; required |
| `tabs` | `OrderTab[]` | non-null; required |

## OrderTab

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `value` | `string` | null allowed; required |
| `label` | `string` | non-null; required |

## Question

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `question` | `string` | non-null; required |
| `askedAt` | `timestamp` | null allowed; required |
| `answer` | `string` | null allowed; required |
| `answeredAt` | `timestamp` | null allowed; required |
| `sellerLabel` | `string` | null allowed; required |

## Review

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `rating` | `int` | non-null; required |
| `body` | `string` | non-null; required |
| `verifiedPurchase` | `bool` | non-null; required |
| `authorLabel` | `string` | non-null; required |
| `createdAt` | `timestamp` | null allowed; required |
| `photos` | `ReviewPhoto[]` | non-null; required |
| `sellerResponse` | `SellerResponse` | null allowed; required |

## ReviewPhoto

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `url` | `URL` | non-null; required |
| `mimeType` | `string` | non-null; required |
| `width` | `int` | non-null; required |
| `height` | `int` | non-null; required |

## SellerResponse

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `shopName` | `string` | non-null; required |
| `body` | `string` | non-null; required |
| `publishedAt` | `timestamp` | null allowed; required |

## Notification

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `type` | `string` | non-null; required |
| `title` | `string` | non-null; required |
| `summary` | `string` | non-null; required |
| `order_id` | `UUID` | null allowed; required |
| `order_reference` | `string` | null allowed; required |
| `status` | `string` | null allowed; required |
| `read_at` | `timestamp` | null allowed; required |
| `created_at` | `timestamp` | null allowed; required |
| `resource_type` | `string` | null allowed; required |
| `resource_id` | `string` | null allowed; required |
| `product_id` | `UUID` | null allowed; required |
| `destination` | `URL` | non-null; required |

## ShopConversation

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `shop` | `ChatShop` | non-null; required |
| `customer_name` | `null` | null allowed; required |
| `last_message_preview` | `string` | null allowed; required |
| `last_message_at` | `timestamp` | null allowed; required |
| `last_sequence` | `int` | non-null; required |
| `last_read_sequence` | `int` | non-null; required |
| `unread_count` | `int` | non-null; required |
| `send_allowed` | `bool` | non-null; required |

## ChatShop

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `name` | `string` | non-null; required |
| `slug` | `string` | null allowed; required |

## ShopMessage

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `sequence` | `int` | non-null; required |
| `body` | `string` | non-null; required |
| `mine` | `bool` | non-null; required |
| `sender_role` | `string` | non-null; required |
| `context` | `MessageContext` | null allowed; required |
| `created_at` | `timestamp` | null allowed; required |
| `attachments` | `ChatAttachment[]` | non-null; may be absent on older deployments; empty for text |

## MessageContext

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `type` | `string` | non-null; required |
| `id` | `UUID` | null allowed; required |
| `label` | `string` | non-null; required |
| `url` | `URL` | null allowed; required |

## LogisticsConversation

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `kind` | `string` | non-null; required |
| `order_id` | `UUID` | null allowed; required |
| `order_reference` | `string` | null allowed; required |
| `counterparty_role` | `string` | non-null; required |
| `counterparty_label` | `string` | non-null; required |
| `last_message_preview` | `string` | null allowed; required |
| `last_message_at` | `timestamp` | null allowed; required |
| `last_sequence` | `int` | non-null; required |
| `last_read_sequence` | `int` | non-null; required |
| `unread_count` | `int` | non-null; required |
| `send_allowed` | `bool` | non-null; required |
| `read_only_reason` | `string` | null allowed; required |

## CourierConversation

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `kind` | `string` | non-null; required |
| `leg` | `string` | null allowed; required |
| `task_id` | `UUID` | null allowed; required |
| `task_reference` | `string` | null allowed; required |
| `order_id` | `UUID` | null allowed; required |
| `order_reference` | `string` | null allowed; required |
| `counterparty_role` | `string` | non-null; required |
| `counterparty_label` | `string` | non-null; required |
| `last_message_preview` | `string` | null allowed; required |
| `last_message_at` | `timestamp` | null allowed; required |
| `last_sequence` | `int` | non-null; required |
| `last_read_sequence` | `int` | non-null; required |
| `unread_count` | `int` | non-null; required |
| `send_allowed` | `bool` | non-null; required |
| `read_only_reason` | `string` | null allowed; required |

## OperationalMessage

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `conversation_id` | `UUID` | non-null; required |
| `sequence` | `int` | non-null; required |
| `sender_role` | `string` | non-null; required |
| `mine` | `bool` | non-null; required |
| `body` | `string` | non-null; required |
| `created_at` | `timestamp` | null allowed; required |
| `attachments` | `ChatAttachment[]` | non-null; may be absent on older deployments; empty for text |

## CourierOrderContext

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `order_id` | `UUID` | non-null; required |
| `order_reference` | `string` | non-null; required |
| `send_allowed` | `bool` | non-null; required |
| `conversation_id` | `UUID` | null allowed; required |

## Ticket

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `reference` | `string` | non-null; required |
| `subject` | `string` | non-null; required |
| `category` | `string` | non-null; required |
| `status` | `string` | non-null; required |
| `revision` | `int` | non-null; required |
| `requester_role` | `string` | non-null; required |
| `requester_name` | `null` | null allowed; required |
| `assignee_name` | `string` | null allowed; required |
| `assignee_id` | `null` | null allowed; required |
| `unread_count` | `int` | non-null; required |
| `last_activity_at` | `timestamp` | null allowed; required |
| `created_at` | `timestamp` | null allowed; required |
| `resolved_at` | `timestamp` | null allowed; required |

## TicketEvent

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `sequence` | `int` | non-null; required |
| `type` | `string` | non-null; required |
| `actor_role` | `string` | non-null; required |
| `is_mine` | `bool` | non-null; required |
| `body` | `string` | null allowed; required |
| `from_status` | `string` | null allowed; required |
| `to_status` | `string` | null allowed; required |
| `assignment_changed` | `bool` | non-null; required |
| `created_at` | `timestamp` | null allowed; required |

## PolicyVersion

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `version` | `int` | non-null; required |
| `title` | `string` | non-null; required |
| `content` | `string` | non-null; required |
| `status` | `string` | non-null; required |
| `change_summary` | `string` | null allowed; required |
| `requires_reconsent` | `bool` | non-null; required |
| `published_at` | `timestamp` | null allowed; required |

## PolicyVersionSummary

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `version` | `int` | non-null; required |
| `title` | `string` | non-null; required |
| `change_summary` | `string` | null allowed; required |
| `requires_reconsent` | `bool` | non-null; required |
| `published_at` | `timestamp` | null allowed; required |

## PolicyHistoryVersion

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `version` | `int` | non-null; required |
| `title` | `string` | non-null; required |
| `status` | `string` | non-null; required |
| `change_summary` | `string` | null allowed; required |
| `published_at` | `timestamp` | null allowed; required |

## AcceptedVersion

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `version` | `int` | non-null; required |
| `accepted_at` | `timestamp` | null allowed; required |

## PolicyStatus

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `type` | `string` | non-null; required |
| `label` | `string` | non-null; required |
| `required` | `bool` | non-null; required |
| `accepted` | `bool` | non-null; required |
| `accepted_at` | `timestamp` | null allowed; required |
| `current_version` | `PolicyVersionSummary` | null allowed; required |
| `accepted_version` | `AcceptedVersion` | null allowed; required |

## Consent

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `policies` | `PolicyStatus[]` | non-null; required |
| `all_required_accepted` | `bool` | non-null; required |

## PublicPolicy

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `type` | `string` | non-null; required |
| `label` | `string` | non-null; required |
| `version` | `PolicyVersion` | non-null; required |

## PolicyAcceptance

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `type` | `string` | non-null; required |
| `label` | `string` | non-null; required |
| `version` | `PolicyVersion` | non-null; required |
| `accepted_at` | `timestamp` | null allowed; required |

## PolicyHistory

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `type` | `string` | non-null; required |
| `label` | `string` | non-null; required |
| `versions` | `PolicyHistoryVersion[]` | non-null; required |

## Announcement

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `title` | `string` | non-null; required |
| `body` | `string` | non-null; required |
| `published_at` | `timestamp` | null allowed; required |
| `expires_at` | `timestamp` | null allowed; required |

## Home

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `viewer` | `Viewer` | non-null; required |
| `advertisementLayer` | `Advertisement` | null allowed; required |
| `campaigns` | `CampaignGroups` | non-null; required |
| `quickActions` | `QuickAction[]` | non-null; required |
| `categories` | `HomeCategory[]` | non-null; required |
| `flashDeals` | `FlashDeals` | null allowed; required |
| `topProducts` | `Product[]` | non-null; required |
| `recentlyViewed` | `Product[]` | non-null; required |
| `recommendations` | `Recommendations` | non-null; required |

## Viewer

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `isAuthenticated` | `bool` | non-null; required |
| `displayName` | `string` | null allowed; required |
| `email` | `string` | null allowed; required |
| `deliveryLocation` | `DeliveryLocation` | null allowed; required |
| `cartItemCount` | `int` | non-null; required |

## DeliveryLocation

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `label` | `string` | null allowed; required |
| `cityMunicipality` | `string` | non-null; required |
| `province` | `string` | non-null; required |

## Advertisement

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `layout` | `string` | non-null; required |
| `rotationIntervalSeconds` | `int` | non-null; required |
| `primary` | `Campaign[]` | non-null; required |
| `secondaryTop` | `Campaign` | null allowed; required |
| `secondaryBottom` | `Campaign` | null allowed; required |

## CampaignGroups

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `hero` | `Campaign[]` | non-null; required |
| `side` | `Campaign[]` | non-null; required |

## Campaign

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `string` | non-null; required |
| `placement` | `string` | non-null; may be absent |
| `title` | `string` | non-null; required |
| `description` | `string` | null allowed; required |
| `slot` | `string` | null allowed; required |
| `position` | `int` | non-null; required |
| `imageDesktopUrl` | `URL` | null allowed; required |
| `imageMobileUrl` | `URL` | null allowed; required |
| `altText` | `string` | non-null; required |
| `destinationUrl` | `URL` | non-null; required |
| `startsAt` | `timestamp` | null allowed; may be absent |
| `endsAt` | `timestamp` | null allowed; may be absent |
| `priority` | `int` | non-null; may be absent |
| `isActive` | `bool` | non-null; required |

## QuickAction

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `key` | `string` | non-null; required |
| `label` | `string` | non-null; required |
| `destinationUrl` | `URL` | non-null; required |

## HomeCategory

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `slug` | `string` | non-null; required |
| `name` | `string` | non-null; required |
| `imageUrl` | `URL` | null allowed; required |

## Recommendations

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `items` | `Product[]` | non-null; required |
| `nextCursor` | `string` | null allowed; required |
| `pageSize` | `int` | non-null; required |

## FlashDeals

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `title` | `string` | non-null; required |
| `startsAt` | `timestamp` | non-null; required |
| `endsAt` | `timestamp` | non-null; required |
| `products` | `Product[]` | non-null; required |

## AddressOption

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `code` | `string` | non-null; required |
| `name` | `string` | non-null; required |

## ShippingProvider

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `businessName` | `string` | non-null; required |


## LogisticsOptions

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `address` | `QuoteAddress` | non-null; required |
| `groups` | `LogisticsOptionGroup[]` | non-null; required |


## LogisticsOptionGroup

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `shop` | `QuoteShop` | non-null; required |
| `options` | `LogisticsOption[]` | non-null; required |


## LogisticsOption

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `organizationId` | `UUID` | non-null; required |
| `businessName` | `string` | non-null; required |
| `shippingFee` | `money` | non-null; required |
| `routeStatus` | `string` | non-null; required |

Voucher/AppliedVoucher/BatchVoucher `name` fields reflect the [2026-10-09 contract delta](voucher-selection-update.md), after the historical inspection. External Flutter parsing/display adoption remains unverified (G26).

## ChatAttachment

2026-10-06 addition; external Flutter adoption remains pending.

| Wire field | Type | Null / omission |
| --- | --- | --- |
| `id` | `UUID` | non-null; required |
| `kind` | `image|video|document` | non-null; required |
| `filename` | `string` | non-null; required |
| `mime_type` | `string` | non-null; required |
| `byte_size` | `int` | non-null; required |
| `state` | `pending|ready|rejected|failed|deleted` | non-null; required |
| `error_code` | `string` | null allowed; required |
| `width` | `int` | null allowed; required |
| `height` | `int` | null allowed; required |
| `duration_seconds` | `number` | null allowed; required |
| `content_url` | `URL` | null allowed; required |
| `preview_url` | `URL` | null allowed; required |

See [private media](chat-media.md) for lifecycle, authorization and transport.
