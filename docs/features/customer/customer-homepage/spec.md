# Aisley Customer / Buyer Marketplace Homepage Specification

**Document:** `spec.md`  
**Area:** Customer / Buyer Storefront  
**Page:** Marketplace Homepage  
**Status:** MVP Specification  
**Last Updated:** 2026-08-28

---

## 1. Purpose

This specification defines the customer-facing marketplace homepage for **Aisley**, a vertically integrated multi-vendor e-commerce platform.

The homepage is the primary product-discovery entry point for both guest visitors and authenticated buyers. It should help users quickly:

1. Search for a product.
2. Discover current campaigns, vouchers, and limited-time deals.
3. Browse marketplace categories.
4. Discover popular and relevant products.
5. Resume products they recently viewed.
6. Navigate to buyer actions such as orders, wishlist, messages, account, and cart.

The homepage should feel like a modern Philippine marketplace similar in discovery density to Shopee and Lazada, while using a cleaner content hierarchy and personalization ideas inspired by Amazon.

---

## 2. Aisley Product Context

Aisley is a multi-vendor marketplace where independent sellers maintain their own shops, products, and inventory while Aisley operates the marketplace and its own logistics infrastructure.

Relevant existing Buyer capabilities:

- Search products.
- View product details and variants.
- Add products to cart and buy.
- Apply vouchers and discounts during checkout.
- View order status.
- Buyer-to-seller messaging.
- Account management.
- Browse individual seller shops.
- Wishlist / favorites.
- Product ratings and reviews.
- Address book.
- Product Q&A.
- Recently viewed products.
- Order cancellation / modification during permitted states.

Relevant platform behavior:

- Guest customers may browse products without signing in.
- Web storefront uses Next.js / React and Laravel session-cookie authentication.
- Aisley has a separate storefront mobile application.
- Admin can create platform-wide vouchers.
- Aisley controls its own logistics workflow.

---

## 3. Competitive Research Summary

Research was performed against the current Philippine Shopee and Lazada storefronts and Amazon's current documented homepage direction.

### 3.1 Shopee Patterns Worth Adopting

Shopee currently emphasizes:

- Persistent marketplace search.
- Campaign shortcuts directly from the homepage.
- Free-shipping and voucher discovery.
- Flash Deals.
- Top Products / high-sales discovery.
- Category browsing.
- Large continuous product discovery feed (`Daily Discover`).
- High campaign visibility throughout the homepage.

**Aisley decision:** adopt the strong campaign/deal discovery model, but reduce visual clutter and avoid putting every marketplace feature above the fold.

### 3.2 Lazada Patterns Worth Adopting

Lazada currently emphasizes:

- Utility navigation for customer care, order tracking, login, and signup.
- Flash Sale with an active countdown.
- Category discovery.
- A large `Just For You` product feed.
- Promotional campaigns and free-shipping/value messaging.

**Aisley decision:** adopt the clear Flash Deals countdown and the large recommendation/discovery feed as the main long-scroll product surface.

### 3.3 Amazon Patterns Worth Adopting

Amazon's enhanced homepage direction emphasizes:

- Personalized homepage recommendations.
- A top-of-page `Window Display` containing relevant deals, recent interests, and seasonal content.
- Grouping related products into horizontal browsing modules.
- Trending products, new releases, best sellers, and deals.
- Resuming previous shopping interests.
- `Buy Again` for frequently purchased items.

**Aisley decision:** use the window-display idea for the hero advertising area and use modular recommendation groups. `Buy Again` is not required for MVP because it is not part of the existing Buyer feature set.

### 3.4 Features Deliberately Not Included in MVP

The following competitor features are useful but should not be required for the first homepage release:

- Live shopping / livestream commerce.
- Coins / gamified rewards.
- Marketplace games.
- AI shopping assistant.
- `Buy Again` / recurring purchase hub.
- Complex behavior-based ML recommendations.
- Sponsored-product auction system.

These may be added after the basic marketplace funnel is stable.

---

## 4. Homepage Goals

### 4.1 Primary Goals

- Make search the fastest path to a known product.
- Make browsing easy for users without a specific product in mind.
- Surface time-sensitive marketplace promotions prominently.
- Give sellers exposure through fair product discovery.
- Encourage product-detail visits, not homepage complexity.
- Support guests without forcing authentication too early.

### 4.2 Secondary Goals

- Encourage buyers to claim/use Aisley-wide vouchers.
- Re-engage authenticated users with recently viewed items.
- Use delivery location as useful storefront context.
- Promote trustworthy marketplace behavior using ratings, sold counts, and clear seller/product information.

### 4.3 Non-Goals

The homepage does not perform:

- Checkout.
- Product variation selection.
- Full order tracking.
- Seller shop management.
- Logistics management.
- Product review submission.
- Complex product comparison.

Those actions belong to their dedicated flows.

---

## 5. Page Information Architecture

Recommended desktop homepage order:

```text
1. Utility Bar
2. Main Marketplace Header / Navbar
3. Secondary Marketplace Navigation
4. Hero Campaign Window
   ├── Main Carousel Advertisement
   └── Two Secondary Advertisement Windows
5. Marketplace Quick Actions
6. Categories
7. Flash Deals
8. Top Products
9. Recently Viewed            [conditional]
10. Featured Shops            [optional MVP / feature flag]
11. Just For You / Discover — continuous infinite-scroll feed with a configurable client cap
```

The order is intentional:

- Search and campaigns appear immediately.
- Categories appear before the user enters a long product feed.
- Urgent deals are shown before evergreen products.
- Recently viewed appears only when useful.
- `Just For You` becomes the long-scroll discovery surface.

---

# 6. Detailed Component Specification

## 6.1 Utility Bar

A thin utility strip above the primary navbar.

### Desktop Content

**Left:**

- `Download Aisley App`
- `Sell on Aisley`

**Right:**

- `Help Center`
- `Track Order`
- Authentication state controls.

### Guest State

Show:

- `Log In`
- `Sign Up`

### Authenticated Buyer State

Replace login/signup with:

- Buyer display name or short account label.
- Link to `My Account`.

### Behavior

- `Sell on Aisley` opens the seller application/domain.
- `Track Order` routes authenticated users to Orders.
- If a guest selects `Track Order`, prompt them to sign in.
- Keep the utility bar visually secondary to the main marketplace header.

### Mobile

Do not render the full utility bar. Move non-shopping links into the account/menu surface.

---

## 6.2 Main Marketplace Header / Navbar

The header is the most persistent homepage UI.

### Desktop Layout

```text
[AISLEY Logo] [Deliver to / Location] [ Search Marketplace................ ] [Messages] [Wishlist] [Account] [Cart]
```

### Required Elements

#### A. Aisley Logo

- Clicking the logo always returns to `/`.
- Logo must remain visible on desktop and mobile.

#### B. Delivery Location

Display:

```text
Deliver to
[City / Municipality]
```

Authenticated buyer:

- Use the default shipping address when available.
- Clicking opens the address selector.

Guest:

- Show `Set delivery location`.
- Do not require location to browse.

MVP note:

- The homepage may display location context without filtering inventory unless product/location eligibility is implemented.

#### C. Search Bar

Search is the dominant header control.

Placeholder:

```text
Search products, brands, and shops
```

Required behavior:

- Submit with Enter.
- Submit with search button.
- Route to search results using encoded query parameters.
- Trim whitespace.
- Prevent empty searches.
- Preserve the submitted query on the search-results page.

Recommended suggestions:

- Matching product names.
- Product categories.
- Seller shops.
- Recent searches for logged-in buyers.
- Local-session recent searches for guests.

Autocomplete is **recommended but not required for first MVP cut** if backend support is unavailable.

#### D. Messages

- Authenticated users: route to buyer messaging.
- Guest: show sign-in prompt.
- Unread count may be displayed when messaging supports it.

#### E. Wishlist

- Authenticated users: route to Wishlist/Favorites.
- Guest: sign-in prompt.

#### F. Account

Guest:

```text
Hello, sign in
Account
```

Authenticated:

```text
Hello, {firstName}
Account
```

Account dropdown may include:

- My Account
- My Orders
- Addresses
- Wishlist
- Log Out

#### G. Cart

- Display cart icon.
- Authenticated users display cart item count.
- Clicking routes to the Cart page.

**MVP product decision:** persistent buyer cart is authenticated-only. Guest users may browse product pages, but cart mutations should request authentication unless a separate guest-cart feature is explicitly implemented.

---

## 6.3 Sticky Header Behavior

On desktop:

- Utility bar scrolls away.
- Main marketplace header becomes sticky.
- Secondary navigation may remain attached to the sticky header if height remains reasonable.

On mobile:

- Sticky top bar contains logo, search, and cart.
- Account and secondary actions move to mobile navigation/menu.

Avoid a sticky header taller than approximately 20% of the mobile viewport.

---

## 6.4 Secondary Marketplace Navigation

A compact row below the main header.

Recommended items:

- `Categories`
- `Flash Deals`
- `Vouchers`
- `Top Products`
- `New Arrivals`
- `Shops`

### Categories Item

On desktop:

- Hover/click may open a category mega-menu.

On mobile:

- Route to the dedicated category browser.

### Rules

- Keep this row to approximately 5-7 high-value links.
- Do not mirror every homepage section here.
- Campaign-specific links may temporarily replace `New Arrivals` when a major event is active.

---

# 7. Hero Campaign Window

This is the main advertisement / campaign surface requested for the homepage.

It combines the high-impact marketplace banner model with Amazon's `Window Display` idea.

## 7.1 Desktop Layout

```text
┌──────────────────────────────────────────────┬──────────────────────┐
│                                              │ Secondary Promo A    │
│          MAIN CAROUSEL ADVERTISEMENT         │                      │
│                                              ├──────────────────────┤
│                                              │ Secondary Promo B    │
└──────────────────────────────────────────────┴──────────────────────┘
```

Recommended proportions:

- Main carousel: ~65-70% width.
- Right-side campaign window: ~30-35% width.
- Right-side area contains two stacked cards.

## 7.2 Main Carousel

Supports:

- Major marketplace campaigns.
- Platform-wide vouchers.
- Payday / double-digit sales.
- Free-shipping campaigns.
- Category events.
- Seasonal sales.
- New-user campaigns.

Required behavior:

- Auto-rotate every 5-7 seconds.
- Manual previous/next controls.
- Pagination indicators.
- Pause rotation while pointer is over the carousel on desktop.
- Pause when browser tab is not visible.
- Respect `prefers-reduced-motion`.
- Entire banner may be clickable when it has one destination.
- Must support desktop and mobile image variants.

## 7.3 Secondary Advertisement Windows

Two smaller campaign cards placed beside the main carousel.

Examples:

- `Free Shipping Vouchers`
- `New Buyer Voucher`
- `Shop Electronics Week`
- `Aisley Payday Sale`
- `Top Shops`

These are **not** required to rotate.

## 7.4 Mobile Hero

Mobile uses only the main campaign carousel at the top.

The two secondary promo cards either:

1. Move into the Quick Actions row, or
2. Render as a horizontally scrollable promo-card row below the main carousel.

Do not shrink the three-window desktop composition into unreadable mobile cards.

## 7.5 Campaign Record

Suggested data contract:

```ts
interface HomepageCampaign {
  id: string;
  placement: 'hero' | 'hero_side';
  title: string;
  imageDesktopUrl: string;
  imageMobileUrl: string;
  altText: string;
  destinationUrl: string;
  startsAt: string;
  endsAt: string;
  priority: number;
  isActive: boolean;
}
```

### MVP Content Management Decision

The Buyer homepage depends on campaign/banner data, but Aisley's current project context only explicitly defines admin-managed platform vouchers, not an advertisement CMS.

Therefore:

- MVP may seed campaign banners through database/configuration managed by developers or authorized admin operations.
- A dedicated Admin Homepage Campaign Manager is a separate feature and should not block the buyer homepage implementation.

---

# 8. Marketplace Quick Actions

A compact icon/shortcut row immediately below the hero.

Recommended MVP shortcuts:

1. `Vouchers`
2. `Flash Deals`
3. `Free Shipping`
4. `Top Products`
5. `New Arrivals`
6. `Shops`
7. `Categories`

Optional campaign slot:

- One shortcut can be replaced by an active major campaign.

### UI

- Icon inside circular or rounded container.
- Short 1-2 line label.
- Desktop: single centered row.
- Mobile: horizontal scroll or compact grid.

### Rules

- Maximum 8 shortcuts.
- Do not create multiple shortcuts that lead to the same destination.
- A voucher shortcut may open the available marketplace-voucher page.

---

# 9. Categories Section

## 9.1 Purpose

Allow buyers to browse the marketplace without knowing a specific product name.

## 9.2 Layout

Header:

```text
Categories                                      [See All]
```

Desktop:

- 8-12 category cards visible per row depending on viewport.
- Up to two rows before `See All` becomes preferable.

Mobile:

- Horizontal scrolling category cards or compact 4-column grid.

## 9.3 Category Card

Contains:

- Category icon or representative image.
- Category name.

Examples:

- Women's Fashion
- Men's Fashion
- Electronics
- Mobile & Accessories
- Home & Living
- Beauty & Personal Care
- Grocery
- Baby & Kids
- Sports & Outdoors
- Automotive
- Pet Care
- Hobbies & Stationery

These names are examples only; actual categories must come from Aisley's category taxonomy.

## 9.4 Behavior

Clicking a category routes to the product listing page with that category selected.

Do not hardcode marketplace taxonomy into the frontend.

---

# 10. Flash Deals Section

Inspired by Shopee's Flash Deals and Lazada's Flash Sale.

## 10.1 Visibility

Render only when there is an active flash-deal window with eligible products.

If no active event exists, omit the entire section rather than rendering an empty placeholder.

## 10.2 Header

```text
Flash Deals     Ends in 02:17:43                        [See All Deals]
```

Required:

- Active countdown.
- Countdown must use server-provided end time.
- Do not use a client-generated fake duration.
- When countdown reaches zero, refresh/revalidate the section.

## 10.3 Product Layout

Desktop:

- Horizontal product carousel.
- 5-6 visible cards.

Mobile:

- 2-2.5 cards visible horizontally to indicate scrollability.

## 10.4 Flash Deal Card

Contains:

- Product image.
- Deal price.
- Original price when discounted.
- Discount percentage or amount.
- Sold/progress indicator when available.
- `Selling Fast` state when applicable.

Clicking the card routes to Product Detail.

---

# 11. Top Products Section

A social-proof discovery section inspired by Shopee's `Top Products` and marketplace best-seller patterns.

## 11.1 Purpose

Help buyers discover products that are already performing well without relying on personalization.

## 11.2 Ranking

Recommended MVP ranking uses a stable rolling window, for example:

```text
completed_order_quantity over previous 30 days
```

Tie-breakers may include:

1. Higher average rating.
2. Higher review count.
3. More recent valid sales.

Cancelled/refunded orders should not count toward bestseller ranking.

## 11.3 UI

Display horizontally scrollable cards with a strong social-proof label:

- `#1 in Home & Living`
- `1.2K sold`
- `Top Product`

Do not fabricate sales numbers.

---

# 12. Recently Viewed Section

This section directly implements the existing Buyer `Recently Viewed Items` feature.

## 12.1 Visibility

Render only when at least one valid recently viewed product exists.

Guest:

- Use local/session storage or a non-identifying browser mechanism.

Authenticated buyer:

- Use server-backed history when available.
- Merge local guest history after authentication only if that behavior is explicitly implemented.

## 12.2 Ordering

- Most recently viewed first.
- Deduplicate repeated views.
- Suggested cap: 12-20 retained product IDs.

## 12.3 Product Availability

If a recently viewed product is unavailable:

- It may remain visible with `Out of Stock` if reopening it is useful.
- Do not show an invalid price or purchase CTA.

---

# 13. Featured Shops Section

**MVP status:** optional / feature-flagged.

Aisley already supports browsing individual seller shops, so homepage shop discovery is a natural marketplace extension.

## 13.1 Eligible Shops

Only include shops that are:

- Approved.
- Active.
- Not suspended.
- Have active products.

## 13.2 Ranking Options

MVP may use:

- Curated shops.
- Top-selling shops over a rolling period.
- Shops with strong ratings and sufficient completed orders.

Avoid presenting a new shop as `Top Rated` without enough data.

## 13.3 Card

Contains:

- Shop logo/avatar.
- Shop name.
- Shop rating when available.
- Small preview of 2-4 products.
- `Visit Shop` action.

---

# 14. Just For You / Discover Feed

This is the homepage's primary long-scroll product discovery area.

It combines Lazada's `Just For You`, Shopee's `Daily Discover`, and Amazon's personalized recommendation-group principle.

## 14.1 Header

Authenticated buyer:

```text
Just For You
```

Guest / insufficient profile data:

```text
Discover on Aisley
```

## 14.2 MVP Recommendation Strategy

Do **not** make machine-learning recommendations a requirement for MVP.

Use a rule-based ranking system.

Possible signals:

1. Product availability.
2. Approved seller status.
3. Recent valid sales.
4. Product rating.
5. Review count.
6. Product freshness.
7. Active promotions.
8. Category affinity from recently viewed products when available.
9. Search/category activity during the current session when available.

Guest fallback:

```text
trending + top-selling + recently added + promoted eligible products
```

Authenticated fallback when little behavior exists:

```text
trending + preferred/recently viewed categories + top-selling products
```

## 14.3 Diversity Rules

Avoid a feed dominated by one seller or one category.

Recommended rules:

- Limit consecutive products from the same shop.
- Mix categories when the user has no strong category intent.
- Do not rank out-of-stock products in the primary discovery feed.

## 14.4 Infinite Scroll Loading

The discovery feed uses **automatic infinite scrolling**. There is no `Load More` button and no homepage footer.

Required behavior:

- Fetch the next recommendation page automatically when the user approaches the end of the currently loaded grid.
- Use cursor-based pagination where possible.
- Preserve browser back-navigation position and the already loaded feed state when returning from Product Detail.
- Never request all remaining products in a single response.
- Only one next-page request may be active at a time.
- Stop requesting when the API returns `nextCursor = null`.
- Stop automatic loading when the frontend session reaches the configured maximum number of discovery products.
- Reaching the client cap must **not** render a site footer. The page may end with a compact feed status such as `You've reached the current discovery limit.`
- If a next-page request fails, keep already loaded products visible and provide an inline retry control at the end of the feed.

### 14.4.1 Frontend Environment Limits

The storefront must use environment configuration so the discovery-feed batch size and maximum rendered/fetched item count can be tuned without changing component logic.

Recommended variables:

```env
# Number of discovery products requested per pagination call.
NEXT_PUBLIC_HOMEPAGE_DISCOVERY_PAGE_SIZE=20

# Maximum discovery products kept/loaded in one homepage browsing session.
NEXT_PUBLIC_HOMEPAGE_DISCOVERY_MAX_ITEMS=120
```

Frontend behavior:

```ts
const PAGE_SIZE = clamp(
  Number(process.env.NEXT_PUBLIC_HOMEPAGE_DISCOVERY_PAGE_SIZE ?? 20),
  8,
  50,
);

const MAX_ITEMS = clamp(
  Number(process.env.NEXT_PUBLIC_HOMEPAGE_DISCOVERY_MAX_ITEMS ?? 120),
  PAGE_SIZE,
  500,
);
```

Rules:

- Environment values are deployment configuration, not trusted security limits.
- Invalid, missing, zero, or negative values fall back to safe defaults.
- `PAGE_SIZE` must not exceed the API's maximum allowed page size.
- `MAX_ITEMS` is a **per homepage browsing session/client render cap** intended to prevent an endlessly growing DOM and excessive browser memory use.
- Once `items.length >= MAX_ITEMS`, disconnect the infinite-scroll observer and stop automatic requests.
- If a page would exceed `MAX_ITEMS`, append only the number of products remaining before the cap.
- Changing the environment limit must not require edits to `DiscoveryFeed` component logic.

Example request:

```http
GET /api/storefront/home/recommendations?cursor={cursor}&limit={PAGE_SIZE}
```

The API should still enforce its own maximum `limit`; the frontend environment value exists primarily for UX and performance tuning.

---

# 15. Product Card Specification

Product cards should be reusable across homepage sections using the shared storefront component package.

## 15.1 Required Fields

```text
[Product Image]
[Optional badges]
Product title, maximum 2 lines
₱Current Price
₱Original Price       -XX%          [optional]
★ 4.8    1.2K sold
[Shipping / voucher badges optional]
```

## 15.2 Required Data

- Product ID / slug.
- Primary image.
- Product title.
- Current selling price or valid price range.
- Original/comparison price only when legitimate.
- Discount representation when applicable.
- Average rating when reviews exist.
- Sold count when available.
- Stock/availability state.
- Shop identifier.
- Relevant promo badges.

## 15.3 Optional Data

- Seller/shop name.
- Seller location.
- Free-shipping eligibility.
- Voucher label.
- `New` badge.
- `Top Product` badge.

## 15.4 Interaction Rules

- Entire card opens Product Detail.
- Wishlist heart may be displayed on hover/tap.
- Wishlist action requires authentication.
- Do not provide homepage `Add to Cart` for products that require variation selection.
- If quick-add is introduced later, enable it only when the product has a single purchasable configuration.

## 15.5 Product Title

- Maximum two visual lines.
- Use ellipsis after overflow.
- Full title should remain available to assistive technology and on the product page.

---

# 16. Voucher Presentation

Because Aisley Admin can create platform-wide vouchers, the buyer homepage should provide clear voucher entry points.

Voucher exposure may appear in:

- Hero campaign banner.
- Quick Actions `Vouchers` shortcut.
- Product-card voucher badges.
- Small voucher strip between homepage sections during major campaigns.

### Voucher Card / Strip May Show

- Voucher title.
- Discount.
- Minimum spend.
- Maximum discount if applicable.
- Expiry date/time.
- `Claim` action if vouchers require claiming.

### Rules

- Do not show expired vouchers.
- Do not label a voucher as usable when the buyer is ineligible.
- Guest attempting to claim a voucher should be prompted to sign in.

---

# 17. Major Campaign Mode

Aisley should support campaign-heavy periods without redesigning the page.

Examples:

- 9.9
- 10.10
- 11.11
- 12.12
- Payday Sale
- Christmas Sale
- Back to School

Campaign mode may change:

- Hero banners.
- One Quick Action shortcut.
- Section headers.
- Decorative campaign accents.

Campaign mode must **not**:

- Break the normal navigation hierarchy.
- Hide search.
- Move Cart/Account unexpectedly.
- Change product pricing independent of backend promotion data.

---

# 18. No Homepage Footer

The marketplace homepage intentionally has **no footer**. Product discovery is the terminal surface of the page.

Required behavior:

- Do not render a desktop footer or mobile footer after the discovery grid.
- Legal, help, seller, tracking, account, and app-download destinations must be reachable through the header, utility navigation, account/menu surfaces, or their dedicated pages instead of relying on a homepage footer.
- The absence of a footer must remain true when the discovery feed reaches its API end or its configured client limit.
- A small discovery-feed loading, retry, or end-state message is allowed; it is not a site footer.

---

# 19. Guest vs Authenticated Homepage

## 19.1 Guest

May:

- View homepage.
- Search products.
- Browse categories.
- Open product details.
- Open seller shops.
- View promotions and product discovery sections.
- Maintain local recently viewed history when implemented.

Requires sign-in for:

- Wishlist mutation.
- Messaging.
- Order tracking.
- Account pages.
- Voucher claiming.
- Persistent cart mutation in the MVP decision defined in this spec.

## 19.2 Authenticated Buyer

May additionally receive:

- Default delivery location.
- Cart count.
- Account shortcuts.
- Wishlist actions.
- Messages.
- Server-backed recently viewed products.
- More personalized `Just For You` ranking.

---

# 20. Responsive Behavior

## Desktop: >= 1024px

- Full utility bar.
- Full header.
- Hero uses main carousel + two side campaign windows.
- Product rows show 5-6 cards depending on container width.
- Categories may render as a multi-column grid.

## Tablet: 768px-1023px

- Utility links may collapse.
- Search remains prominent.
- Hero side cards may reduce width or move below carousel.
- Product modules remain horizontally scrollable where appropriate.

## Mobile: < 768px

Recommended order:

```text
Sticky Header
Search
Hero Carousel
Quick Actions
Categories
Flash Deals
Top Products
Recently Viewed [conditional]
Just For You grid
Continuous Just For You / Discover feed
```

Mobile rules:

- No tiny desktop side-ad windows.
- Product discovery grid uses 2 columns.
- Horizontal sections must provide visible partial next-card affordance.
- Cart remains immediately accessible.
- Search should remain near the top and easy to re-enter.

---

# 21. Loading, Empty, and Error States

## 21.1 Loading

Use skeletons for:

- Hero.
- Categories.
- Product rows.
- Product feed.

Avoid global blocking spinners for the whole homepage.

## 21.2 Partial API Failure

Homepage sections should fail independently.

Example:

- Hero fails -> categories/products can still render.
- Recommendations fail -> show fallback trending products.
- Flash Deals fails -> omit section and continue page.

## 21.3 Empty Sections

Do not render empty shells.

Examples:

- No Flash Deals -> omit Flash Deals.
- No Recently Viewed -> omit Recently Viewed.
- No Featured Shops -> omit Featured Shops.

## 21.4 Product Image Failure

Use a standard Aisley product-image placeholder.

---

# 22. Suggested Frontend Component Structure

Components should be reusable through the project's shared `packages/*` component architecture where appropriate.

Suggested structure:

```text
MarketplaceHomePage
├── UtilityBar
├── MarketplaceHeader
│   ├── DeliveryLocation
│   ├── MarketplaceSearch
│   ├── MessageButton
│   ├── WishlistButton
│   ├── AccountMenu
│   └── CartButton
├── MarketplaceNav
├── HeroCampaignWindow
│   ├── HeroCarousel
│   └── HeroSidePromos
├── QuickActions
├── CategorySection
│   └── CategoryCard
├── FlashDealsSection
│   └── ProductCard
├── TopProductsSection
│   └── ProductCard
├── RecentlyViewedSection
│   └── ProductCard
├── FeaturedShopsSection
│   └── ShopCard
└── DiscoveryFeed
    ├── ProductCard
    ├── InfiniteScrollSentinel
    └── DiscoveryFeedEndState
```

Reusable primitives:

```text
packages/ui
packages/storefront
```

Exact package naming may follow the repository's established workspace conventions.

---

# 23. Frontend Environment Configuration

The buyer storefront should expose homepage performance tuning through its frontend environment configuration.

Minimum recommended variables:

```env
NEXT_PUBLIC_HOMEPAGE_DISCOVERY_PAGE_SIZE=20
NEXT_PUBLIC_HOMEPAGE_DISCOVERY_MAX_ITEMS=120
```

Suggested frontend config module:

```ts
export const homepageConfig = {
  discoveryPageSize: parseBoundedInt(
    process.env.NEXT_PUBLIC_HOMEPAGE_DISCOVERY_PAGE_SIZE,
    { fallback: 20, min: 8, max: 50 },
  ),
  discoveryMaxItems: parseBoundedInt(
    process.env.NEXT_PUBLIC_HOMEPAGE_DISCOVERY_MAX_ITEMS,
    { fallback: 120, min: 20, max: 500 },
  ),
};
```

Rules:

- Read environment values in one config module rather than throughout components.
- Do not directly trust `Number(envValue)` without validation.
- Ensure `discoveryMaxItems >= discoveryPageSize`.
- Defaults must keep the homepage usable even when environment variables are absent.
- Because `NEXT_PUBLIC_*` values are included in the browser bundle, they must not contain secrets.
- These values control frontend behavior only; the Laravel API must keep independent server-side pagination limits.

---

# 24. Suggested Homepage API Contract

The exact endpoint names are implementation choices. A homepage aggregation endpoint is recommended to reduce frontend waterfall requests.

Example:

```http
GET /api/storefront/home
```

Possible response:

```json
{
  "campaigns": {
    "hero": [],
    "side": []
  },
  "quickActions": [],
  "categories": [],
  "flashDeals": {
    "startsAt": null,
    "endsAt": null,
    "products": []
  },
  "topProducts": [],
  "recentlyViewed": [],
  "featuredShops": [],
  "recommendations": {
    "items": [],
    "nextCursor": null,
    "pageSize": 20
  }
}
```

Alternative implementation:

- Return critical above-the-fold data from one endpoint.
- Load lower sections independently after initial render.

### Authentication

- Public homepage GET requests must work without authentication.
- Personalized fields may be returned when a valid Laravel web session exists.
- Public read endpoints do not need CSRF state-changing behavior.
- Mutations such as wishlist, voucher claim, or cart must use the existing authenticated web flow.

---

# 25. Home Product Summary DTO

Homepage product cards should use a lightweight summary DTO rather than loading the full Product Detail payload.

Suggested shape:

```ts
interface ProductSummaryDTO {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string;
  price: number;
  originalPrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  discountPercent?: number | null;
  averageRating?: number | null;
  reviewCount?: number;
  soldCount?: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  shop: {
    id: string;
    slug: string;
    name: string;
  };
  badges: string[];
}
```

Do not return product-detail-only data such as every variation, complete description, Q&A, and all review content in homepage DTOs.

---

# 26. Search Integration

The existing Buyer model requires marketplace product search.

Homepage search should support a lightweight search experience and route to a dedicated search-results page.

Suggested query:

```http
GET /api/products/search?q={query}&page={page}
```

Optional autocomplete:

```http
GET /api/search/suggestions?q={query}
```

Suggestion types:

```ts
type SearchSuggestion =
  | { type: 'query'; label: string }
  | { type: 'category'; id: string; label: string }
  | { type: 'shop'; id: string; label: string }
  | { type: 'product'; id: string; label: string; imageUrl?: string };
```

---

# 27. Recommendation Rules for MVP

A simple scoring model is sufficient initially.

Example conceptual scoring:

```text
score =
  sales_velocity_weight
+ rating_weight
+ review_confidence_weight
+ freshness_weight
+ promotion_weight
+ category_affinity_weight
```

Hard filters before scoring:

- Product is active.
- Seller/shop is active and approved.
- Product is not deleted.
- Product is eligible for storefront visibility.
- Product has purchasable stock for primary discovery sections.

The implementation must not expose the exact ranking formula publicly if it becomes susceptible to seller manipulation.

---

# 28. Advertisement / Campaign Selection Rules

For active campaigns:

1. Filter `isActive = true`.
2. Filter by `startsAt <= now < endsAt`.
3. Filter by correct placement.
4. Sort by campaign priority.
5. Apply optional targeting only if supported.
6. Limit the hero carousel to a manageable number.

Recommended:

- 3-6 active hero slides.
- Maximum 2 side promos on desktop.

Avoid 10+ rotating banners; users should be able to understand the campaign area before it changes repeatedly.

---

# 29. SEO

Homepage should be server-rendered or otherwise produce crawlable initial content.

Required:

- Unique `<title>`.
- Meta description.
- Canonical URL.
- Open Graph metadata.
- Organization/site identity metadata where appropriate.
- Search engine-friendly category links.

Recommended title example:

```text
Aisley | Shop Products, Deals & Local Marketplace Finds
```

Do not expose authenticated personalization in crawler-facing cached HTML.

---

# 30. Accessibility

Required:

- All interactive controls keyboard accessible.
- Visible focus states.
- Carousel controls have accessible labels.
- Carousel must not trap keyboard focus.
- Auto-rotation can be paused/stopped.
- Respect `prefers-reduced-motion`.
- Images have useful `alt` text or empty alt for decorative images.
- Text/interactive contrast must satisfy WCAG AA.
- Product price changes are not communicated by color alone.
- Countdown should not announce every second to screen readers.
- Icon-only actions require accessible names.

---

# 31. Performance Requirements

The homepage is image-heavy, so performance must be treated as a product requirement.

## Targets

- LCP target: <= 2.5s on a representative production connection/device.
- CLS target: < 0.1.
- INP target: <= 200ms where practical.

## Required Practices

- Enforce the configured discovery-feed `PAGE_SIZE` and `MAX_ITEMS` on the client.
- Disconnect the infinite-scroll observer as soon as `MAX_ITEMS` is reached or `nextCursor` becomes `null`.
- Avoid retaining duplicate product objects when appending recommendation pages.
- Keep the discovery DOM bounded by the configured maximum; if the configured cap is raised substantially, use list/grid virtualization or equivalent windowing to avoid rendering hundreds of off-screen cards at once.
- Optimize hero images.
- Provide responsive image sizes.
- Reserve image dimensions to prevent layout shift.
- Preload only the initial hero image, not the entire carousel.
- Lazy-load below-the-fold product images.
- Lazy-load lower homepage sections where appropriate.
- Cache public categories and campaign metadata.
- Do not fetch full Product Detail objects for cards.
- Avoid shipping carousel libraries significantly larger than the feature requires.

---

# 32. Analytics Events

Minimum recommended events:

```text
homepage_view
homepage_search_submit
homepage_search_suggestion_click
homepage_hero_impression
homepage_hero_click
homepage_side_promo_click
homepage_quick_action_click
homepage_category_click
homepage_section_impression
homepage_product_click
homepage_flash_deal_click
homepage_shop_click
homepage_wishlist_click
homepage_login_prompt
```

Common event properties:

```text
section
position
product_id
shop_id
campaign_id
category_id
query
is_authenticated
```

Analytics must not contain sensitive customer data or full shipping addresses.

---

# 33. Security and Trust Requirements

- Never trust campaign destination URLs from arbitrary sellers.
- Sanitize/validate any admin-managed text and destinations.
- Product price on the client is display-only; checkout recalculates authoritative totals server-side.
- Do not expose private inventory/seller fields in public DTOs.
- Do not expose buyer identifiers in analytics payloads unnecessarily.
- Authenticated controls rely on the existing Laravel session model.
- Wishlist/cart actions must handle expired sessions safely.

---

# 34. MVP Scope

## Required for MVP

- Utility navigation on desktop.
- Marketplace header.
- Search.
- Authentication-aware Account state.
- Cart entry point.
- Wishlist entry point.
- Delivery location display/set entry point.
- Secondary marketplace navigation.
- Hero main carousel.
- Two desktop secondary campaign windows.
- Quick Actions.
- Categories.
- Flash Deals with real countdown when active.
- Top Products.
- Recently Viewed when data exists.
- Discovery / `Just For You` feed with rule-based fallback ranking.
- Responsive mobile layout.
- Product card component.
- Loading/error/empty states.
- Basic analytics.
- Accessibility baseline.
- Performance optimization.

## Optional MVP / Feature Flag

- Featured Shops.
- Search autocomplete.
- Shop/product suggestions in search.
- Voucher claim directly from homepage.

## Post-MVP

- ML recommendation engine.
- `Buy Again`.
- Live shopping.
- Personalized campaign targeting.
- Sponsored product auction/ads.
- Advanced campaign CMS.
- AI shopping assistant.
- Gamified rewards/coins.

---

# 35. Acceptance Criteria

## Public / Guest

- [ ] A guest can open the homepage without authentication.
- [ ] A guest can search for products.
- [ ] A guest can browse categories and open product details.
- [ ] Guest-only controls do not produce authorization errors; they prompt for authentication when necessary.

## Header

- [ ] Logo routes to homepage.
- [ ] Search is visible on all supported viewport sizes.
- [ ] Cart is visible on desktop and mobile.
- [ ] Authenticated and guest account states render correctly.
- [ ] Delivery location does not block browsing if unset.

## Hero / Advertisements

- [ ] Desktop displays one main carousel and up to two side campaign windows.
- [ ] Mobile does not squeeze the desktop three-window layout.
- [ ] Carousel supports manual controls.
- [ ] Carousel honors reduced-motion preferences.
- [ ] Expired/inactive campaign slides do not render.
- [ ] Every campaign image has appropriate accessible text behavior.

## Categories

- [ ] Categories are loaded from backend taxonomy/configuration, not hardcoded as the source of truth.
- [ ] Category selection navigates to the correct listing/filter state.

## Flash Deals

- [ ] Flash Deals render only during an active promotion with eligible products.
- [ ] Countdown uses server-provided end time.
- [ ] Expired deal prices are not retained on screen after expiry/revalidation.

## Products

- [ ] Homepage cards use a summary DTO.
- [ ] Product cards route to Product Detail.
- [ ] Primary recommendation sections do not promote unavailable products as purchasable.
- [ ] Discount, sold-count, and rating labels come from real backend data.

## Recently Viewed

- [ ] Section is hidden when there is no history.
- [ ] Repeated product views are deduplicated.

## Discovery Feed

- [ ] Guests receive a meaningful fallback feed.
- [ ] Authenticated buyers can receive category/history-aware ranking when data exists.
- [ ] Feed avoids excessive consecutive products from one seller when possible.
- [ ] Additional products load automatically as the user approaches the end of the grid.
- [ ] Infinite-scroll requests use a bounded page size.
- [ ] The feed stops automatic requests when `nextCursor = null`.
- [ ] The feed stops automatic requests when `NEXT_PUBLIC_HOMEPAGE_DISCOVERY_MAX_ITEMS` is reached.
- [ ] Invalid or missing discovery environment values fall back to safe defaults.
- [ ] Reaching the discovery cap does not reveal or render a footer.
- [ ] Returning from Product Detail restores the buyer's prior feed/scroll position when feasible.

## Reliability

- [ ] Failure of one non-critical section does not make the whole homepage unusable.
- [ ] Empty optional sections are omitted.
- [ ] Product image failures use a standard placeholder.

## Responsive

- [ ] Desktop, tablet, and mobile layouts are usable without horizontal page overflow.
- [ ] Mobile product grid uses a readable two-column layout.
- [ ] Horizontal carousels visibly indicate additional content.

## Accessibility

- [ ] All header and carousel actions are keyboard accessible.
- [ ] Focus states are visible.
- [ ] Icon-only buttons have accessible names.
- [ ] Countdown does not generate a screen-reader announcement every second.

## Performance

- [ ] Initial hero image is optimized and appropriately prioritized.
- [ ] Below-the-fold images are lazy-loaded.
- [ ] Image dimensions are reserved to minimize layout shift.
- [ ] Discovery items never grow beyond the configured client maximum in one homepage session.
- [ ] Only one infinite-scroll next-page request is active at a time.
- [ ] The intersection observer/sentinel is disconnected after reaching the final page or configured cap.

---

# 36. Recommended Build Order

```text
Phase 1
Header + Search

Phase 2
Hero Campaign Window + Quick Actions

Phase 3
Categories + reusable ProductCard

Phase 4
Flash Deals + Top Products

Phase 5
Recently Viewed + Discover Feed

Phase 6
Responsive polish + accessibility + analytics + performance

Phase 7
Optional Featured Shops + autocomplete
```

---

# 37. Final Homepage Content Decision

The Aisley customer homepage should launch with this core content hierarchy:

```text
UTILITY BAR
  Download App | Sell on Aisley | Help | Track Order | Login/Account

MAIN HEADER
  Aisley | Delivery Location | Search | Messages | Wishlist | Account | Cart

SECONDARY NAV
  Categories | Flash Deals | Vouchers | Top Products | New Arrivals | Shops

HERO CAMPAIGN WINDOW
  Large rotating campaign advertisement
  + two smaller desktop campaign cards

QUICK ACTIONS
  Vouchers | Flash Deals | Free Shipping | Top Products | New Arrivals | Shops | Categories

CATEGORIES
  Dynamic marketplace category grid/carousel

FLASH DEALS
  Countdown + horizontal product deals

TOP PRODUCTS
  Popular / best-selling product row

RECENTLY VIEWED
  Conditional resume-shopping row

FEATURED SHOPS
  Optional / feature flagged

JUST FOR YOU / DISCOVER
  Continuous infinite-scroll rule-based recommendation feed
  Auto-loads by cursor/page until the API ends or the configurable client cap is reached
  No homepage footer
```

This structure combines Shopee's campaign-led discovery, Lazada's flash-sale and recommendation emphasis, and Amazon's cleaner personalized window/grouping model while remaining aligned with the Buyer capabilities already defined for Aisley.

---

# 38. Research Sources

Research basis used for this specification:

1. **Shopee Philippines homepage**, reviewed 2026-08-28: current storefront exposes search, promotional shortcuts, Flash Deals, Top Products, Categories, Shopee Mall, Shopee Live, and Daily Discover.
2. **Shopee Help Center — Promotions / Flash Deals / Vouchers**, reviewed 2026-08-28: confirms homepage campaign shortcuts, vouchers, recurring flash-deal discovery, and promotion-oriented buyer flows.
3. **Lazada Philippines homepage**, reviewed 2026-08-28: current storefront exposes utility navigation, Flash Sale with countdown, Categories, and Just For You discovery.
4. **Amazon — enhanced homepage features**, current documented design direction: personalized recommendations, Window Display, horizontal related-product groupings, trending/new/best-selling/deal content, and Buy Again.

Research-derived ideas are used as design inspiration only. Aisley-specific behaviors in this document are product decisions based on Aisley's existing Buyer and platform requirements rather than assumptions that competitor behavior must be copied exactly.
