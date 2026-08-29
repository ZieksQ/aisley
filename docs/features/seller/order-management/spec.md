---
feature: order-management
title: Seller Order Management
system: AISLEY
type: Feature Specification
version: 1.1
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Order Management

## WHAT

- **Purpose:** Give an active Seller one shop-scoped catalog surface for Product drafts, editing, publishing, archiving, variants, pricing, media, and stock summaries.
- **Naming boundary:** despite its name, this feature owns Product/Catalog management—not purchased-order fulfillment.
- **Fulfillment belongs to:** Seller Order Notifications, Prepare Orders, Confirm Delivery, Logistics, and Courier features.
- **Canonical ownership:** authenticated Seller → exactly one owned Shop → Products, options, variants, gallery media, and description assets.
- **Routes:** `/products`, `/products/new`, `/products/:productId`, and `/products/:productId/edit` within the Seller SPA.
- **Current schema:** Products support `description_markdown`; ProductMedia is the gallery/variant-media model; Product option/variant data is already UUID-based.
- **Product-description editor:** use [MDXEditor — the Rich Text Markdown Editor React Component](https://mdxeditor.dev/editor/docs/overview) in the Seller form.
- **Description images:** Sellers can insert, paste, or drop pictures into the Markdown description through MDXEditor's image plugin and an Aisley-authorized upload flow.
- **Core flow:**

```text
Seller creates/saves Product draft
→ opens ProductDescriptionEditor
→ types Markdown-rich description or inserts an image
→ Laravel authorizes, scans, stores, and returns a canonical description-asset URL
→ MDXEditor inserts standard Markdown image syntax
→ Seller saves Product
→ Laravel validates Markdown and referenced assets belong to that Product
→ Product publishes only after normal catalog/compliance checks
```

- **Architecture:** React/Vite owns the catalog UI and MDXEditor; Laravel owns Seller scope, storage, Markdown validation, publication, and API DTOs.
- **Feature boundaries:** Inventory owns stock movements; Promotions own voucher/discount rules; ProductMedia owns gallery/variant images; description assets are distinct inline-content assets.
- **Non-goals:** direct inventory overwrites, Product hard deletion, order fulfillment, arbitrary external image hotlinking, raw HTML/MDX execution, or storing Base64 images in Markdown.

## MUST

### Seller scope and catalog lifecycle

- Require authenticated active `SELLER`; derive Shop from the session and never trust `seller_id` or `shop_id` input.
- Every Product, variant, gallery media, description asset, and upload-session query must be constrained to the Seller's Shop.
- Use `401` unauthenticated, `403` forbidden/inactive, `404` Seller-scoped resource missing, `422` invalid input, and `409` stale publication/update conflicts.
- Sellers may create, list, edit, explicitly publish, and archive only their own Products.
- Draft/archived Products remain visible to the owner but never appear in Buyer discovery.
- Archive preserves the Product and future Order snapshots/history; it must not hard-delete Product records or referenced assets.
- Product updates must never rewrite historical Order item, price, description, or media snapshots once Orders exist.

### Product fields, variants, prices, and stock

- Laravel allow-lists mutable Product fields and validates category, title, summary, Markdown, prices, variants, media references, and publication readiness.
- Prices use fixed-precision decimals and explicit currency; client-calculated totals and negative values are rejected.
- Variants/SKUs are Seller-owned Product configurations with validated option combinations, server-enforced SKU uniqueness, and active/inactive state.
- Publishing is an explicit server action requiring complete catalog data, allowed Seller/Shop/compliance state, valid media, and any configured dimensions/weight.
- Promotions/vouchers validate Seller/Product scope, dates, limits, and final eligibility in their own domain.
- Inventory owns authoritative `on_hand`, `reserved`, and `available` balances; Product management may show summaries or request an Inventory action but never writes a second balance.
- Low-stock state comes from the Inventory/Low Stock Alert domain, not a duplicated Product calculation.

### MDXEditor Markdown authoring

- Add `@mdxeditor/editor` to `src/seller`; the user-requested library is the approved rich-text Markdown editor for Product descriptions.
- Import MDXEditor's stylesheet and render one controlled `ProductDescriptionEditor` bound to `description_markdown`.
- Enable only the needed plugins: headings, lists, quotes, links/link dialog, thematic breaks, Markdown shortcuts, image, and toolbar.
- Include the image toolbar control (`InsertImage`) and support image paste/drop through `imagePlugin({ imageUploadHandler })`.
- Disable image resizing and raw HTML output because MDXEditor can serialize resized images as HTML `<img>` tags while the storefront intentionally renders no raw HTML.
- Configure a custom image dialog that uploads/selects Aisley-owned description assets; do not permit arbitrary external image URLs.
- The editor may emit standard Markdown images only:

```markdown
![Accessible description](/api/v1/product-description-assets/{assetUuid})
```

- Description image insertion is enabled only after the Product draft has a persisted UUID; before then, prompt the Seller to save the draft.
- Maintain draft editor state, upload progress, retry/cancel, pasted/dropped-image failure, unsaved-change warning, and field-addressable save errors.
- MDXEditor output is input, not trusted HTML; Laravel is the final validator and stored Markdown authority.

### Description image upload and storage

- Add a Seller-scoped endpoint such as `POST /api/v1/seller/products/{product}/description-assets` accepting one multipart image field.
- The MDXEditor `imageUploadHandler` uploads the `File` with the credentialed API client and resolves only to the API-returned canonical asset URL.
- Validate authorization, image MIME by server inspection, extension, byte size, decoded dimensions, pixel count, checksum, and configured rate/upload limits.
- Scan uploads before making them usable; pending, rejected, or failed assets cannot be inserted or published.
- Store object metadata and a UUID asset record—never a browser file path, Base64 payload, raw data URI, or storage-provider secret in Markdown.
- Keep description assets separate from `product_media` so inline images do not alter the buyer gallery, gallery ordering, or variant primary-media rules.
- Canonical Markdown URLs must be stable; do not persist expiring signed URLs in `description_markdown`.
- Seller preview may resolve a separate authorized temporary URL, while public asset delivery resolves only when the Product is Buyer-visible.
- Deleting/replacing an inline image must verify Product ownership; unreferenced assets may be garbage-collected only after a retention policy is chosen.

### Markdown and storefront safety

- Validate a bounded Markdown length, image count, alt-text length, link count, and allowed Markdown node set server-side.
- Reject raw HTML, MDX/JSX, scriptable URLs, `data:`/`blob:` image URLs, embedded iframes, and image references outside the Product's canonical description-asset path.
- On Product save and publish, parse the Markdown and verify every image asset is scan-approved and belongs to that same Product.
- Buyer Product Detail continues to render Markdown with `react-markdown` and `remark-gfm`, without `rehype-raw`.
- The Buyer renderer must allow only safe normal links and the canonical Aisley description-asset image route; rendered images use Markdown alt text, responsive sizing, lazy loading, and an accessible failure fallback.
- Product descriptions may include GFM text constructs; tables, links, emphasis, lists, and images must not execute scripts or expose private draft assets.

### API, events, and user experience

- Provide Seller-scoped paginated Product list/detail/create/update/publish/archive endpoints and explicit API Resources; never serialize raw Eloquent graphs.
- Product multi-row changes use transactions; slow upload/scanning work occurs outside database locks.
- After committed Product/media/description changes, queue Buyer-search/cache/index refresh work; retries must not duplicate a Product mutation.
- Dashboard, Search, Browse Shop, Product Detail, Cart, and Checkout consume only the authoritative published Product state.
- Forms provide labeled fields, keyboard-operable MDXEditor toolbar/dialog, visible focus, text alternatives, and non-color-only validation/upload status.
- [ ] Seller cannot read, edit, upload to, or delete another Seller's Product or description asset.
- [ ] A Seller can author Markdown with MDXEditor and insert images by toolbar, paste, or drop after saving a draft.
- [ ] Stored Markdown contains only canonical Product-owned image references and no raw HTML, Base64, or unapproved external image URL.
- [ ] Unsafe, oversized, malformed, failed-scan, or cross-Product assets are rejected and cannot be published.
- [ ] Description pictures render safely on Buyer Product Detail without entering the gallery or exposing draft/private assets.
- [ ] Catalog, price, inventory, publish/archive, promotion, and historical-order boundaries remain intact.

## HOW

- Add Seller `ProductController`, Form Requests, Policies/scoped queries, Product API Resources, and product/domain actions under role-specific namespaces.
- Add a dedicated `ProductDescriptionAsset` model/table or equivalent asset relation with UUID, `product_id`, disk/path, MIME, size, dimensions, checksum, scan status, timestamps, and retention metadata.
- Keep enum-like columns as migration strings with PHP enum casts; do not modify existing migrations.
- Recommended APIs:

```http
GET    /api/v1/seller/products
POST   /api/v1/seller/products
PATCH  /api/v1/seller/products/{product}
POST   /api/v1/seller/products/{product}/publish
POST   /api/v1/seller/products/{product}/archive
POST   /api/v1/seller/products/{product}/description-assets
DELETE /api/v1/seller/products/{product}/description-assets/{asset}
```

- Implement `ProductDescriptionEditor` with MDXEditor plugins, a controlled `onChange`, the custom upload-only image dialog, `imageUploadHandler`, and an asset-preview resolver.
- Update the Buyer description component's image renderer and URL policy in the same implementation so its safe rendering contract matches uploaded Markdown.
- API tests cover Seller isolation, Markdown validation, upload type/size/dimension/scan states, canonical references, cross-Product assets, publish gating, and asset delivery visibility.
- Frontend tests cover editor initialization in Vite, toolbar/paste/drop insertion, progress/retry, unsaved changes, keyboard use, Markdown persistence, and Buyer image rendering/failure fallback.
- Run API tests on SQLite and PostgreSQL plus Seller/Webapp lint, TypeScript, and production builds.
- **Open questions:** exact file/pixel/count limits, scan provider and pending UX, description-asset retention/garbage collection, category/weight publish checklist, SKU scope, Promotion rules, and whether to rename this feature Catalog/Product Management.
- **References:** [MDXEditor Vite setup](https://mdxeditor.dev/editor/docs/getting-started), [MDXEditor image plugin](https://mdxeditor.dev/editor/docs/images), [Laravel 13 file storage](https://laravel.com/framework/docs/13.x/filesystem), `docs/schema.md`, and `docs/features/customer/view-product/spec.md`.
