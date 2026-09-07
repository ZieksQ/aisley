---
feature: order-management
title: Seller Order Management
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented catalog management
role: Seller
scope: Seller Web Application
---

# Seller Order Management

## WHAT

- **Actual ownership:** this Seller feature is the Product/Catalog workspace despite its historical name. It manages Product drafts, variants, prices, media, descriptions, publication, archive/unarchive, and deletion retention.
- **Fulfillment pointer:** purchased-order approval belongs to Seller Order Approval; packing, package labels, and `ready_for_pickup` belong to Seller Prepare Orders. Logistics waybills, Courier assignment, and delivery are downstream.
- **Routes:** Seller SPA `/products`, `/products/new`, `/products/:productId`, `/products/:productId/edit`; API `/api/v1/seller/products*` and product upload routes.
- **Ownership:** authenticated Seller → exactly one Shop → Products, SKUs/variants, gallery media, and inline description assets.
- **Editor:** use [MDXEditor — the Rich Text Markdown Editor React Component](https://mdxeditor.dev/editor/docs/overview) for controlled `description_markdown` authoring. Buyer viewing uses `react-markdown` with `remark-gfm` and no raw HTML.
- **Description image flow:** save a draft/upload token → upload an allowed picture → receive a Seller-authorized Aisley asset reference → insert standard Markdown image syntax → save Product → Laravel claims and validates Product-owned assets.
- **Non-goals:** direct stock-balance writes, arbitrary HTML/MDX execution, external image hotlinks, Buyer address changes, order-status transitions, Logistics selection, Courier assignment, or hard deletion that removes historical references.

## MUST

### Seller scope and lifecycle

- Require `auth:sanctum` and active Seller status. Derive the Shop from the session; never trust client `seller_id`, `shop_id`, ownership, status, or storage paths.
- Sellers may create, list, edit, publish, archive, unarchive, and delete only their own Products. Draft/archived Products remain owner-visible but not Buyer-discoverable.
- Publish is an explicit server action requiring a valid active category in the Shop's canonical Shop Category, complete catalog fields, at least one approved gallery image, and at least one active SKU with positive `available` stock. Admin compliance restrictions also block publication/unarchive.
- Archive/deletion preserves order/catalog history and retains media/description assets according to the configured recovery period; no historical Order snapshot is rewritten.
- Use safe scoped `401`, `403`, `404`, `409`, and field-addressable `422` responses. Resource DTOs must not serialize unrelated Eloquent graphs.

### Product, variant, and Inventory boundaries

- Validate title, short description, Markdown, category, prices/currency, SKU uniqueness, option combinations, variant status, media IDs, and publication readiness server-side.
- Product variants have Seller-scoped UUIDs and may inherit or override Product prices. Product-level and variant primary media remain distinct from inline description assets.
- Inventory owns authoritative `on_hand`, `reserved`, and `available = on_hand - reserved`; Product screens may show read-only summaries or create opening SKU stock through the Inventory service, never maintain a second balance.
- Low-stock state comes from the Low Stock Alert/Inventory domain. Promotions and vouchers own their own eligibility and mutations.

### MDXEditor authoring

- The Seller app includes `@mdxeditor/editor` and its stylesheet. Use one controlled editor bound to `description_markdown` with headings, lists, quotes, links, thematic breaks, Markdown shortcuts, image, and toolbar plugins.
- Show `InsertImage` and support toolbar, paste, and drop through the configured upload handler. The image handler calls `/api/v1/seller/product-uploads` and resolves only to an Aisley-owned canonical asset URL.
- Description pictures use JPEG/JPG, PNG, or WebP and the shared file-upload policy; Product upload processing also enforces its configured edge/pixel/image-count limits.
- Disable raw HTML/MDX execution and image-resizing output that would serialize unsafe HTML. Store standard Markdown such as `![alt](/api/v1/product-description-assets/{uuid})` only.
- Inline image insertion requires a persisted Product draft; temporary uploads are claimed on Product save and unreferenced temporary assets expire under the configured retention policy.
- Laravel parses the Markdown, rejects scripts/HTML/data/blob URLs and unapproved external images, and verifies every referenced asset belongs to the same Product and is scan-approved before save/publish.
- The Buyer renderer uses `react-markdown` + `remark-gfm` without `rehype-raw`; it exposes description assets only when the Product is Buyer-visible and keeps them separate from the gallery.

### Media and safety

- Uploads are Seller/Shop scoped, use server-generated UUID/object names, store bytes on configured object storage, and return safe application URLs rather than raw disk paths.
- Gallery remains bounded (currently ten Product-level images and one primary image per variant) and supports filename rows, deletion, and default selection without arbitrary external URLs.
- Product and description responses omit private drafts, rejected/pending assets, credentials, Buyer private data, and cross-tenant identifiers.
- Client validation is UX only; Laravel is authoritative for ownership, MIME/signature/decode, size, dimensions, Markdown, and publication.

### Acceptance

- [x] Seller Product CRUD and Shop/category scoping are enforced by API and Seller UI.
- [x] Draft, active, archived, unarchived, variant, price, gallery, and inventory-summary flows preserve Product history.
- [x] MDXEditor authoring supports safe Markdown and picture insertion by toolbar, paste, and drop.
- [x] Description assets are Product-owned, canonical, bounded, and rendered with `react-markdown`/`remark-gfm` without raw HTML.
- [x] Product gallery and inline description images use separate asset lifecycles and safe visibility rules.
- [x] Inventory, Admin compliance, Buyer storefront, and historical Order boundaries are not bypassed.
- [ ] Purchased-order queue/packing, Seller package labels, Logistics operational waybills, and delivery transitions are implemented in their owning features.

## HOW

- Current backend is `ProductController`, `ProductCatalogService`, `ProductAssetService`, Seller Form Requests/Policies, Product API payloads, and additive catalog/media migrations. Current routes include `/products`, `/products/{product}`, `/publish`, `/archive`, `/unarchive`, `/product-uploads`, `/product-description-assets/{asset}`, and `/product-media/{media}`.
- Current frontend is `ProductFormPage`, `ProductsPage`, `ProductDescriptionEditor`, and shared Seller API/media helpers. Keep the editor controlled and preserve upload progress, retry, unsaved-change, and field-error states.
- Keep enum-like migration columns as strings with PHP enum casts and never edit an executed migration. Description assets need their own UUID records and ownership relation, separate from `product_media`.
- Product writes, variant replacement, asset claiming, and publication checks are transactional. Queue search/cache refresh only after commit; retries must not duplicate mutations.
- Tests cover Seller isolation, category/variant/price rules, publish/compliance gates, media limits/defaults, Markdown asset ownership, spoofed/oversized/corrupt uploads, Buyer visibility, archive retention, and retry behavior. Run API tests on SQLite/PostgreSQL plus Seller/Webapp lint, TypeScript, and builds.
- Purchased-order links from this workspace must navigate to Order Approval or Prepare Orders; do not add fulfillment behavior here.

### Current API contract

- `GET /api/v1/seller/products` is paginated and supports Seller-owned search/status filters. `GET /products/{product}` returns Product, variants, inventory summaries, compliance state, gallery, and description-asset identifiers.
- `POST /products` creates a draft with a base SKU or complete variant matrix; `PATCH /products/{product}` updates allow-listed catalog fields and claims uploaded assets.
- `POST /products/{product}/publish`, `/archive`, `/unarchive`, and `DELETE /products/{product}` are explicit actions. An active Product must be archived before deletion; configured retention preserves media recoverability.
- `GET /products/options` returns the Shop-scoped active category list and configured media limits. `POST /product-uploads` creates temporary Seller-owned gallery/variant/description assets; Product save claims them.
- Seller asset preview routes are authorized and private. Public Product/description delivery remains gated by the shared storefront visibility rule.

### Markdown safety checklist

- Keep `description_markdown` bounded and parseable. Verify referenced asset UUIDs are unique, approved, attached to this Product, and not from another Shop.
- Reject HTML/JSX, scripts, iframes, `data:` and `blob:` URLs, unsafe link schemes, and arbitrary remote images. Do not store Base64 payloads or expiring signed URLs in Markdown.
- Preserve alt text and render description images responsively with a non-color-only failure state. A description image is never silently copied into the Product gallery.
- MDXEditor is an authoring aid; the API validator and Buyer `react-markdown` renderer remain the security boundary.

### Deferred boundary checks

- Do not add a Seller “confirm order,” package, pickup, waybill, Courier, or delivery button to Product pages. Link to the owning Order Approval/Prepare Orders screen instead.
- Catalog publication may be blocked by Admin compliance restrictions, but this feature does not create compliance cases or decide warnings/restrictions.
- Inventory mutations and low-stock evaluations are dispatched through their services, including opening stock for new SKUs; catalog UI displays returned committed values only.
- If a future Product field needs review/versioning, document the proposal/active-value model before adding it to the ordinary PATCH allow-list.

### Product lifecycle guardrails

- A newly created Product starts as `draft`; saving edits never silently publishes it. Publish and unarchive are explicit server actions and re-check current Shop, category, inventory, media, and compliance state.
- Archiving deactivates its Inventory SKUs for storefront purposes while retaining Product, Order, and movement history. Unarchive returns the Product to `draft`; it is not immediately Buyer-visible.
- Deleting an inactive Product retires its assets with configured retention. It must not remove an Order item snapshot, review reference, audit record, or historical movement.
- Variant edits preserve existing variant/SKU UUIDs and balances when possible. Removed variants become inactive/retained rather than reusing their identifiers.

### API and UI verification

- Test every Product route with an active owner, another Seller, a non-Seller, a restricted Product, and forged Shop/category/media IDs.
- Test Markdown parser rejection, exact image ownership, upload-token reuse, temporary-asset expiry, gallery count/default rules, variant combinations, price precision, publish prerequisites, archive/unarchive, and deletion retention.
- Test Buyer Product Detail/search only receives active, compliant, scan-approved Product data and safe description media. Test `react-markdown`/`remark-gfm` output with links, tables, images, and hostile HTML.
- Keep Order Approval and Prepare Orders links available from Seller navigation without coupling catalog writes to fulfillment status transitions.
- A Product save may occur while an Order is being prepared, but it cannot alter the immutable purchased snapshot or package label snapshot.
- A Product archive or compliance restriction must make its Buyer visibility change without deleting Inventory movement or historical Order references.
- Keep catalog route parameters UUID-constrained and do not expose sequential internal identifiers in image or Product URLs.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`, `docs/references/file-upload-requirements.md`, Seller Create Product tests, and Seller Prepare Orders.
