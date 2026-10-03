# File & Image Upload Requirements

## WHAT

- This is the shared policy for image uploads across AISLEY.
- It applies to product gallery images, product-description images, shop logos and banners, profile photos, review media, registration evidence, and delivery proof when those features allow image uploads.
- Each feature spec must reference this policy instead of defining conflicting image format, size, validation, storage, or access rules.
- This policy covers images only. PDF, spreadsheet, video, and other file types require their own approved policies.
- **Terminology:** `WebP` is the intended standard image format for the requested “webimg” format.

## MUST

### Baseline image requirements

- An uploaded image must be **under 10 MiB** (`10,485,760` bytes).
- The UI may describe this limit as “10 MB maximum,” but Laravel must enforce the exact byte limit server-side.
- Allow only these image formats:
  - JPEG (`.jpeg`, `.jpg`, `image/jpeg`)
  - PNG (`.png`, `image/png`)
  - WebP (`.webp`, `image/webp`)
- Reject GIF, SVG, AVIF, HEIC/HEIF, TIFF, BMP, PDF, archives, executables, and every unlisted extension or media type.
- A browser-provided filename, extension, `Content-Type`, and file size are hints only; they are never proof that the upload is an allowed image.
- Laravel must independently inspect the file, verify its detected MIME type and signature, and successfully decode it as an image before accepting it.
- The server must reject files with mismatched extension and detected image type, malformed image data, or multiple/double extensions such as `image.jpg.php`.

### Authorization and ownership

- Every upload requires the feature’s authenticated role and server-side authorization for its owning resource.
- Sellers may upload only to their own Shop, Product, Product description, or account record.
- Customers may upload only to their own permitted review, profile, or registration flow.
- An upload endpoint must derive ownership from the authenticated user and route resource; it must never trust a client-supplied `seller_id`, `shop_id`, `user_id`, or storage path.
- A private asset is unavailable until its owning record and authorization policy permit access.
- Replacing or deleting an image must use the same ownership checks as upload.

### Storage and metadata

- Store file bytes on the configured filesystem/object storage, not in database columns or client-side Base64 strings.
- Generate a server-owned UUID/key and extension for the object path; never use the original filename as the storage filename.
- Keep the original filename only as non-authoritative metadata where the feature needs it.
- Store only the metadata needed by the owning model or asset record:
  - owner and optional parent-resource UUID
  - storage disk and generated path
  - detected MIME type and normalized extension
  - byte size
  - image width and height
  - optional checksum
  - scan/processing state and timestamps when scanning is enabled
- Do not store absolute server filesystem paths, storage credentials, browser blob URLs, data URIs, or expiring signed URLs in database content.
- The existing generic `documents` table remains for private registration evidence. Product gallery and inline-description images need feature-specific asset records so their visibility and lifecycle do not conflict.

### Access and visibility

- Registration evidence, identity documents, payout evidence, disputes, and delivery proof are private.
- Private images must be served only after authorization, through an application endpoint or a short-lived signed URL when supported by the configured disk.
- Buyer-visible product, shop, and review images may use stable public or authorized delivery URLs only after the owning content is eligible for Buyer visibility.
- Draft, rejected, pending-scan, archived, and cross-tenant images must not become publicly retrievable.
- API responses must return a safe delivery URL or asset identifier, never a raw disk path.

### Validation and processing

- Validate upload size before permanent storage and enforce request/rate limits to reduce abuse.
- Decode images in a resource-bounded process; reject invalid dimensions, decompression-bomb inputs, and processing failures.
- Strip or rewrite EXIF metadata before public delivery unless a feature has a documented reason to retain it.
- Do not trust client-side validation, preview, resizing, or MIME detection as a security boundary.
- If malware scanning is configured, store the asset as `pending` until it passes; failed or pending assets cannot be attached, published, or publicly delivered.
- Log safe operational metadata—asset ID, owner, feature, result, detected type, and size—without logging file contents, private URLs, or identity-document data.

### Error contract and user experience

- Return field-addressable `422` validation errors for unsupported format, file-too-large, invalid-image, or dimension failures.
- Return `401` for unauthenticated requests, `403` for forbidden ownership/action, and `429` for throttled uploads.
- The client must show the accepted formats and 10 MB limit before selection, upload progress while transferring, and a clear recoverable error when the server rejects a file.
- Never claim that a file was uploaded successfully until Laravel has completed required validation and persistence.
- If scanning or processing is asynchronous, show a truthful pending state and block the dependent action until the asset becomes usable.

### Acceptance criteria

- [ ] A valid JPEG, JPG, PNG, or WebP image under 10 MiB is accepted only when the caller owns the target resource.
- [ ] An image at or above 10 MiB, an invalid/corrupt image, or any unlisted type is rejected by Laravel.
- [ ] Renaming a non-image file to `.jpg`, `.png`, or `.webp` does not bypass validation.
- [ ] Seller and Customer uploads cannot be attached to another tenant’s resource.
- [ ] Private verification/proof images cannot be fetched without authorization.
- [ ] Public images never expose storage paths, credentials, or a draft/private asset.

## IMPROVEMENTS TO DECIDE

- Set per-purpose limits instead of using the global 10 MiB ceiling everywhere—for example, smaller limits for avatars and logos, while retaining 10 MiB for high-detail product images or evidence.
- Set maximum width, height, and total-pixel limits. A practical starting point is 8,000 pixels per edge and 40 megapixels, but this needs product/operations approval before enforcement.
- Create responsive derivatives (thumbnail, card, and detail sizes) from a validated original; serve modern optimized derivatives without replacing the approved source image.
- Decide whether to normalize public JPEG/PNG uploads into WebP/AVIF derivatives while preserving the original for review. Do not accept SVG until it has a dedicated sanitization policy.
- Define per-feature image-count limits, ordering, primary-image selection, alt-text requirements, and deletion/retention rules.
- Add content moderation and manual-review rules for public product/review images; keep this separate from malware scanning.
- Define malware-scan provider, timeout, retry, quarantine, and rejection-notification behavior before making scan state mandatory.
- Define lifecycle cleanup: when an unreferenced upload is deleted, how long it remains recoverable, and who may restore it.
- Add an audit event for sensitive document/proof access and mutation without copying the image itself into audit records.

## HOW

- Laravel Form Requests should enforce the baseline extension/MIME/size allowlist; a dedicated upload service should perform image decoding, generated naming, storage, metadata persistence, and optional scanning.
- Use Laravel’s configured filesystem disk. The schema rule is that database records keep paths and metadata while the file bytes live in blob storage.
- Feature-specific Policies must authorize the parent resource before any upload, preview, delete, or delivery URL is created.
- Keep public product gallery media separate from Seller inline description assets, registration documents, and other private evidence because each has different ownership and visibility rules.
- Add backend tests for accepted types, byte boundaries, spoofed MIME/extension, corrupt images, authorization, signed/private delivery, scan state, and cleanup.
- Add frontend tests for accepted-file messaging, early client feedback, upload progress, retry, server field errors, and accessible status announcements.
- Referencing specs should use this policy and may add stricter limits only when the feature explicitly documents why.
- **References:** [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) and [Laravel file validation](https://laravel.com/framework/docs/13.x/validation#validating-files).
