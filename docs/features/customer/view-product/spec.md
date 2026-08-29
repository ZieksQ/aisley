# View Product

## WHAT

- A public storefront product-detail page for guests and signed-in buyers.
- Lets a buyer inspect a product, browse its media, choose a valid variant and quantity, then add it to cart or start Buy Now.
- Extends the current summary-only `products` model with detailed content, multiple images, variant options, and variant-level inventory.
- Supports the existing Aisley buyer flow: view product details, select variations and quantity, validate stock, add to cart, or buy immediately.
- Out of scope for this feature:
  - Cart/checkout persistence and payment processing; consume their APIs when available.
  - Product Q&A, wishlists, recommendations, delivery-fee estimation, and new review submission.
  - Video media, product bundles, subscriptions, and marketplace-wide product attributes.

## MUST

- Route and availability
  - [ ] Expose a canonical product route using the immutable UUID product id: `/products/{id}`.
  - [ ] Allow guests to view only `active` products from `active`, non-vacation shops.
  - [ ] Return a not-found response for draft, archived, missing, suspended-shop, or vacation-shop products; do not leak their media or inventory.
  - [ ] Fetch product detail fresh enough that displayed price and stock are reconciled by the cart/checkout request.

- Product presentation
  - [ ] Show name, current price, legitimate original price when higher than current price, discount/badges, aggregate rating, review count, sold count, and availability.
  - [ ] Show a gallery with one primary image and ordered thumbnails; clicking, keyboard navigation, and mobile swipe change the selected image.
  - [ ] Render image alt text and a stable fallback for missing/unloadable assets.
  - [ ] Show a shop summary with shop name, logo when available, vacation status/message, and a link to its storefront.
  - [ ] Render a full seller-authored Markdown description and optional structured specifications.
  - [ ] Markdown may support CommonMark plus GFM tables, lists, links, emphasis, and strikethrough; raw HTML and embedded media are not rendered.
  - [ ] External description links open safely with `rel="noopener noreferrer"`; unsafe URL schemes are rejected or omitted.

- Variants and inventory
  - [ ] Support zero or more ordered option groups (for example Color and Size) with ordered values.
  - [ ] Show the selected variant's price override, original-price override, SKU, available stock, and variant primary image when set; otherwise inherit product values/media.
  - [ ] Compute selectable values from server-supplied valid variant combinations, not from a client-side Cartesian product.
  - [ ] Disable unavailable combinations and all variants with zero stock; preserve their visible labels.
  - [ ] Require every option to be selected before purchase actions for a multi-variant product.
  - [ ] For a product without variants, use its existing product-level price and aggregate stock as the purchasable configuration.
  - [ ] Limit requested quantity to at least 1 and at most the selected configuration's available stock.
  - [ ] Disable Add to Cart and Buy Now when required selections are incomplete, stock is zero, or the shop/product is unavailable.
  - [ ] Revalidate product status, shop status, variant combination, price, and stock atomically in cart/Buy Now and checkout; the page is informational only and cannot reserve stock.

- Reviews and responsive behavior
  - [ ] Show the persisted rating/review summary now and a clear empty state when the count is zero.
  - [ ] Reserve a Reviews section for verified-purchase reviews, review media, and seller replies when that deferred feature is delivered.
  - [ ] Be usable by keyboard and screen readers: labeled gallery controls, visible focus, semantic option controls, announced validation messages, and meaningful image alt text.
  - [ ] Use responsive layout: gallery and purchasing panel stack on small screens without hiding variant, stock, or action controls.

## HOW

- Data model and migrations
  - [ ] Add `products.description_markdown TEXT NULL` and `products.specifications JSONB NULL`; retain `short_description` for cards/search.
  - [ ] Add `product_media`: UUID id, `product_id`, nullable `product_variant_id`, `disk`, `path`, `alt_text`, `position`, timestamps; unique `(product_id, position)` and index `(product_variant_id, position)`.
  - [ ] Add `product_option_groups`: UUID id, `product_id`, `name`, `position`; unique `(product_id, position)`.
  - [ ] Add `product_option_values`: UUID id, `option_group_id`, `value`, nullable visual swatch metadata, `position`; unique `(option_group_id, value)`.
  - [ ] Add `product_variants`: UUID id, `product_id`, unique SKU, nullable price/original-price overrides, `stock_quantity`, status, nullable primary-media reference, timestamps.
  - [ ] Add `product_variant_option_values`: variant/value UUID foreign keys; unique `(product_variant_id, product_option_value_id)`.
  - [ ] Enforce nonnegative prices and stock in request/service validation; ensure a variant contains exactly one value from every option group for its product.
  - [ ] Keep blob storage authoritative as disk/path/metadata, matching the existing thumbnail pattern; generate signed/public delivery URLs only in the API response.

- Backend — Laravel API
  - [ ] Add a public product-detail endpoint: `GET /api/v1/products/{id}`, where `id` is the UUID primary key.
  - [ ] Return a purpose-built DTO: product summary, Markdown description, specifications, ordered media, option groups/values, valid variants, selected-configuration pricing/stock fields, and shop summary.
  - [ ] Filter the endpoint by active product and active/non-vacation shop scopes.
  - [ ] Do not expose seller-only cost, internal status, private storage paths, or stock of unrelated variants.
  - [ ] Extend the existing cart/Buy Now contract to accept `product_id`, nullable `variant_id`, and quantity; resolve all price and inventory server-side inside a transaction.
  - [ ] Validate seller product writes so media order, option names/values, option combinations, SKU uniqueness, Markdown length, and allowed specification keys are bounded and well formed.

- Frontend — `src/webapp`
  - [ ] Create the `/products/{id}` product-detail route/page with isolated components for gallery, purchase panel, variant selector, shop summary, description, specifications, and rating summary.
  - [ ] Render the description using `react-markdown` and `remark-gfm`; configure safe URL transformation, do not use `rehype-raw`, and use custom link rendering for external-link attributes.
  - [ ] Fetch the product DTO server-side where appropriate; hydrate only interactive gallery, option selection, quantity, and action controls.
  - [ ] Keep configuration state keyed by option-group id/value id and derive the selected variant only from the API DTO.
  - [ ] Refresh/reconcile the purchase panel from cart/Buy Now validation errors and show a clear price/stock-change message.

- Testing and acceptance
  - [ ] API tests cover visibility scopes, media ordering, valid/invalid combinations, zero-stock variants, price inheritance/overrides, DTO privacy, and stale stock rejection.
  - [ ] Frontend tests cover gallery interaction, mobile layout, option disabling, required selection, quantity bounds, action states, Markdown links, and accessible keyboard flow.
  - [ ] End-to-end test: a guest opens an active product, selects an in-stock Color/Size combination, changes quantity within stock, and receives the same variant id/quantity in Add to Cart or Buy Now.
  - [ ] End-to-end test: a previously selected variant becomes out of stock before action; the server rejects it and the UI refreshes availability without adding an invalid item.

- Rollout and observability
  - [ ] Release migrations and seller management support before enabling variant detail pages for products using variants.
  - [ ] Monitor product-detail not-found rates, gallery asset failures, cart/Buy Now stock conflicts, and Markdown rendering errors by product id without recording description content.

- Open decisions
  - [ ] Confirm whether variant prices are optional overrides or mandatory per variant.
  - [ ] Confirm the category-specific specification schema and seller Markdown size limit.
  - [ ] Confirm whether a vacation shop should be fully hidden (recommended for MVP) or shown as unavailable.
  - [ ] Define the separate cart, checkout, and verified-review specs before their implementation begins.

- Sources
  - Existing Aisley requirements, storefront architecture, and deferred-schema boundaries in `project_sources`.
  - [react-markdown documentation](https://github.com/remarkjs/react-markdown): safe default rendering, GFM plugin support, element restrictions, and URL transformation.
