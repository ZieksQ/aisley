# Seller Create Product

## WHAT

- Give an approved Seller a guided, Shop-scoped form for creating a product draft.
- Capture the catalog data consumed by Customer product cards and the `/products/{id}` detail page:
  - name, category, short description, Markdown description, specifications, media, and pricing;
  - zero or more option groups and values;
  - one SKU-backed variant for each valid option combination, with stock and optional price overrides.
- Save incomplete work as a draft, then allow a separate publish action after catalog and compliance checks pass.
- Product prices are seller-entered regular selling prices. A variant may override the parent price and original price; when omitted, it inherits the parent value.
- The form lives in `src/seller` (React/Vite). `src/webapp` remains the Customer read-only renderer and must not expose Seller creation controls.
- Non-goals: order fulfillment, promotions/vouchers, payment, direct inventory ledger edits, hard deletion, product bundles, video, or arbitrary HTML/MDX execution.

## MUST

### Access, ownership, and lifecycle

- Require an authenticated, active, Admin-approved Seller; derive the Seller's authoritative Shop from the session.
- Scope every product, option, variant, SKU, gallery asset, and description asset query to that Shop. Never accept client-supplied seller or shop ownership.
- Create products as `draft`; drafts are visible to their Seller only and never appear in Customer listing/detail APIs.
- Preserve the existing lifecycle: Seller saves draft, edits draft, explicitly publishes, or archives. Archive is recoverable and does not delete catalog history.
- Use `401` for unauthenticated, `403` for role/approval failure, `404` for an out-of-scope product, `422` for validation, and `409` for stale or invalid lifecycle transitions.

### Product and variant data

- Require a product name, active category belonging to the Shop's canonical Shop Category, base SKU, and positive base price; short description is optional and bounded.
- Store fixed-precision monetary values with an explicit currency. `original_price`, including a variant override, is optional but cannot be lower than its effective selling price.
- Support no variants (the base SKU is purchasable) or ordered option groups such as Color and Size.
- Require each variant to select exactly one value from every option group; reject duplicates, partial combinations, duplicate combinations, and SKUs reused anywhere the API forbids them.
- Each variant has an SKU, active/inactive state, and authoritative inventory SKU. Opening stock may be supplied once while creating each SKU through the Inventory service; persisted stock is read-only in Product UI and is adjusted only through Inventory.
- Expose effective variant price/original price as `variant value ?? product value`; the Customer detail contract must show the selected variant's price, SKU, and availability.
- Prevent publishing when required product data, valid combinations, required media, compliance state, or any later configured shipping/dimension requirement is incomplete.

### Markdown description and images

- Use `@mdxeditor/editor` as a controlled Seller `ProductDescriptionEditor` bound to `description_markdown`.
- Initialize only the required editor plugins: headings, lists, quote, links/link dialog, thematic break, Markdown shortcuts, image, and toolbar; include `InsertImage`.
- Support image add, paste, and drag/drop using MDXEditor's `imagePlugin({ imageUploadHandler })`; each file is uploaded immediately to the authorized Laravel endpoint and the returned canonical URL is inserted into Markdown.
- Do not store Base64, `blob:` URLs, browser paths, expiring signed URLs, arbitrary external image URLs, raw HTML, JSX, or executable MDX in the description.
- Keep inline description assets separate from Product gallery/variant media. A description image must never alter Customer gallery ordering or become a variant primary image.
- Apply `docs/references/file-upload-requirements.md`: server-inspect and decode JPEG/JPG/PNG/WebP only, under 10 MiB, with generated object keys, metadata, ownership, scan state, and safe delivery.
- Block insertion/publication for pending, failed, malformed, oversized, cross-Product, or unapproved assets; show truthful upload progress, retry, and field-addressable errors.
- Bound Markdown length, image count, alt text, links, and allowed nodes server-side. Buyer rendering remains GFM-safe with `react-markdown` and `remark-gfm`, without `rehype-raw`.

### Frontend initialization and UX

- Keep MDXEditor in a Seller client component and import its stylesheet once. The Vite `src/seller/src/main.tsx` bootstrap must mount the editor through the existing `StrictMode`, `BrowserRouter`, and `AuthProvider` tree without browser-global access during module initialization.
- If an MDXEditor component is ever imported into the Next.js `src/webapp`, wrap it in a client-only boundary and `next/dynamic(..., { ssr: false })`, and initialize its plugins in that client-only module. Do not put the editor in the server-rendered Customer product page.
- The Seller form must expose labeled controls, keyboard-operable toolbar/dialog/drop zone, visible focus, non-color upload states, unsaved-change protection, loading/error/empty states, and mobile-safe layout.
- Disable description-image upload until the draft has a persisted UUID; explain that the Seller must save the draft first.
- Generate variant rows from option selections, show each option group/value context, show inherited versus overridden prices, collect opening stock per new SKU, prevent duplicate combinations, and make persisted stock read-only except through Inventory management.

### Customer listing compatibility

- Keep `name`, `short_description`, effective base price, original price, stock, status, published timestamp, thumbnail, rating, sold count, and badges compatible with the existing Customer summary DTO.
- Customer discovery/detail must require an active published Product, active approved Seller, active Shop, non-vacation Shop, and positive availability where the existing listing contract requires it.
- Never expose draft form state, Seller-only costs, private asset paths, inactive variants, or unapproved description images in Customer responses.
- A product with variants must not advertise a misleading single price: the DTO may expose the configured base/range presentation, while a selected variant exposes its authoritative effective price.
- Show gallery files as an ordered filename list with per-file removal and a Seller-controlled `Set as default` action. The selected approved product-level gallery image is the Customer card thumbnail; if no selection is supplied, the first gallery image becomes the default.
- Product and variant price changes are authoritative at read/cart/checkout time; the form must not promise that a displayed price reserves stock.

### Data contract and validation edges

- Product detail responses must return stable UUIDs, ordered option groups/values, variant-to-value mappings, effective prices, SKU identifiers, availability, and media references without leaking Eloquent internals.
- The create/update payload must distinguish omitted nullable override prices from explicit values and must reject numeric strings that exceed the persisted decimal precision.
- Normalize SKU input consistently with current Seller behavior, preserve the canonical product slug policy, and keep category IDs as UUIDs.
- Validate option names/values after trimming, reject blank labels and duplicate case-insensitive labels where the product contract requires uniqueness, and preserve display positions deterministically.
- A zero-stock variant may remain in the Seller draft matrix but cannot satisfy Customer purchase availability or publish requirements if the product has no purchasable combination.
- Deleting an option group or value must either regenerate and validate the complete variant matrix in one transaction or be rejected with a repairable error; it must not silently orphan variants.
- Retrying a request must not create duplicate products, variants, assets, or inventory movements; use idempotency where an upload or multi-row mutation can be retried.
- Server validation is authoritative even when the UI has already generated a valid-looking matrix or accepted a browser-side image preview.

### Security and failure handling

- Reject path traversal, storage-disk injection, malformed UUIDs, unknown fields, unsafe Markdown links, and asset URLs that point outside the Aisley canonical route.
- Do not reveal whether an out-of-scope UUID exists; return the same scoped not-found behavior for another Shop's product or asset.
- On a failed multi-row save, return field paths such as `variants.2.price` and preserve the Seller's unsaved local form state for correction.
- If an asset is uploaded before the product save later fails, keep it unattached and eligible for the documented cleanup/retention process; do not silently attach it to another product.
- If a published product is edited, invalidate affected Customer caches only after the database transaction commits and keep existing order snapshots immutable.

## HOW

- Extend the existing Seller product endpoints or introduce product actions/resources while preserving `/api/v1/seller/products` conventions:
  - `POST /products` creates the draft and base SKU;
  - `PATCH /products/{product}` updates editable product fields;
  - nested create/update/delete endpoints persist option groups, values, variants, and media atomically;
  - `POST /products/{product}/description-assets` uploads one description image;
  - publish/archive remain explicit actions.
- Add Form Requests, policies, scoped queries, and API Resources. Recheck Shop ownership and category membership server-side for every nested write.
- Use additive migrations only. Keep enum-like columns as migration strings with PHP enum casts. Add a feature-specific description-asset record containing UUID, product, disk/path, detected MIME, size, dimensions, checksum, scan status, and timestamps.
- Persist files on the configured filesystem/blob disk and metadata in PostgreSQL. Return asset identifiers or safe delivery URLs, never raw storage paths.
- Implement product writes in a transaction; perform image validation/storage/scanning outside long database locks, then attach only approved assets. Queue cache/search refresh after commit.
- Update `src/seller` types, API client, routes, form components, editor, variant matrix, and tests. Keep `src/webapp`'s existing product-detail Markdown renderer initialized with `react-markdown`/`remark-gfm` and add the canonical description-image URL policy there.
- Test API role/approval/tenant isolation, price inheritance and overrides, valid-combination enforcement, SKU uniqueness, draft/publish gates, upload spoofing and 10 MiB boundary, scan state, and safe asset delivery.
- Test Seller UI editor initialization, toolbar/paste/drop insertion, progress/retry, draft gating, variant price editing, accessibility, persistence, and stale-save errors; run API tests plus Seller and Webapp lint, TypeScript, and production builds.
- Add acceptance tests for these user-visible outcomes:
  - [ ] An approved Seller creates a draft with no variants and sees its base SKU and price in the Seller list.
  - [ ] A Seller creates Color × Size combinations; each combination has one SKU, stock identity, and either an override price or inherited product price.
  - [ ] Duplicate, incomplete, cross-Shop, negative, or invalid-price combinations receive field-specific errors and do not partially persist.
  - [ ] Toolbar insertion, paste, and drag/drop each upload a valid image, insert the canonical reference, and render it in authorized Seller preview.
  - [ ] A rejected upload never appears in Markdown and an interrupted upload can be retried without duplicating the image reference.
  - [ ] A published product is returned by Customer listing/detail only when every existing visibility predicate passes.
- Observe upload success/failure, scan latency, rejected MIME/size reasons, product-save conflicts, publish failures, and Customer image-delivery failures using asset/product IDs only; never log Markdown, file contents, private URLs, or credentials.
- Roll out additive schema/API changes first, then the Seller editor and variant matrix, then enable publish gating and Customer asset delivery. Existing base products must remain readable and retain their current summary behavior.

### Resolved implementation decisions (2026-09-02)

- Variant `price` and `original_price` are nullable overrides. A missing value inherits its Product parent value.
- A Product gallery defaults to 10 images. Each Variant may have one separate primary image; Variant images do not consume the gallery allowance. The limit is environment-backed now so a future Admin global setting can become authoritative without changing the upload contract.
- The Seller gallery renders filenames rather than image previews. Sellers may remove temporary gallery uploads and select one product-level gallery image as the default cover; new Products default to the first gallery image when no selection is made.
- Accepted images remain under 10 MiB and are additionally limited to 8,000 pixels per edge and 40 megapixels. This follows OWASP's resource-limit guidance and stays below ImageMagick's documented 8,192-pixel security-policy example.
- Pre-save MDXEditor/gallery/Variant uploads use a Shop-owned `product-assets/temp` prefix and expire after 24 hours. Saving the Product moves claimed blobs into the Product folder. Replaced gallery, Variant, or description revisions have a 24-hour grace period. Deleted Products retain image blobs for 30 days by default, configurable from 7 through 30 days.
- `products:cleanup-assets` runs hourly through Laravel's scheduler and removes expired temporary uploads and retention-expired blobs. Product rows remain soft-deleted tombstones so Order/catalog history is not coupled to blob deletion.
- Base and Variant SKUs are unique within a Shop, not across the marketplace.
- Category-specific specification keys and an external malware-scan provider remain separate future decisions; the current synchronous approval step performs signature/type checks, bounded decoding, and image rewriting before an asset becomes usable.

### Sources

- Existing contracts: `docs/features/customer/view-product/spec.md`, `docs/features/seller/order-management/spec.md`, `docs/schema.md`, and `docs/references/file-upload-requirements.md`.
- [MDXEditor getting started](https://mdxeditor.dev/editor/docs/getting-started) — client-only initialization and stylesheet setup.
- [MDXEditor image plugin](https://mdxeditor.dev/editor/docs/images) — upload handler for inserted, pasted, and dropped images.
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — client boundary for browser-dependent third-party components.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — allow-listing, generated filenames, bounded uploads, authorization, and safe storage.
- [ImageMagick architecture and resource limits](https://imagemagick.org/architecture/) — decoded pixel-cache cost and the documented 8,192-pixel edge security-policy example.
