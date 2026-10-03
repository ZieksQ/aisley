---
feature: bulk-product-import-export
title: Seller Bulk Product Import / Export
system: AISLEY
type: Feature Specification
version: 2.0
status: Draft; bounded CSV-first target contract; not implemented
role: Seller
scope: Seller React dashboard and Laravel catalog API
last_reconciled: 2026-10-03
---

# Seller Bulk Product Import / Export

## WHAT

- Let an approved active Seller export an editable catalog CSV, preview proposed changes, and explicitly confirm a bounded import.
- Persisted/API role is `seller`; derive exactly one Shop from the authenticated account.
- Product CRUD, categories, SKU-backed Inventory, media/Markdown, and Finance already exist; bulk catalog routes, jobs, tables, and Seller screens do not.
- Reuse Seller Product/Catalog ownership in `docs/features/seller/order-management/spec.md`; purchased-order fulfillment belongs to Prepare Orders.
- MVP supports CSV only, one simple Product/base SKU per row (no option groups or variants), and separate file-level `create` or `update` mode; no upsert.
- Create new Products as `draft` with a base SKU and zero opening stock. Update only existing simple, non-archived, unrestricted owned Products.
- Defer XLSX/Excel workbooks, variant/option matrices, Markdown/image changes, stock adjustments, thresholds, promotions, publication/archive/delete, cancellation, and large asynchronous exports.
- Broader CSV/XLSX domain wording describes later scope, not a requirement to implement XLSX in this MVP.
- Proposed Seller SPA routes are `/products/bulk` and `/products/bulk/imports/:importId`; keep access under the Shop/catalog navigation group.
- This revision defines reviewable MVP limits and behavior for later implementation; it does not deploy endpoints or certify acceptance criteria.

## MUST

### Ownership and domain boundaries

- Require `auth:sanctum`, `seller.active`, and current policy consent for template, export, upload, preview, confirmation, status, retry, and result reads; use existing web session/CSRF handling.
- Reauthorize the Seller/Shop when queued validation and each commit run; lost approval/access stops remaining writes without undoing committed rows.
- Resolve Product and base Inventory SKU UUIDs through the owning Shop; unknown and foreign IDs produce the same safe row error.
- Never accept ownership, publication, compliance, storage paths, Buyer PII, Order identifiers, or shipment/task fields from the CSV.
- Do not mutate `on_hand,reserved,available`, legacy stock quantities, low-stock thresholds, existing SKU codes, media, or Markdown descriptions.
- Zero-stock SKU initialization uses `InventoryService`; no opening-stock movement is created. Later replenishment uses the ordinary Inventory workflow.
- Preserve historical Order item/pricing/cost/address snapshots, Finance recognition, and fulfillment state; catalog changes affect only future/current catalog behavior.

### CSV policy and limits

- `docs/references/file-upload-requirements.md` covers images only; this section defines the feature-specific proposed CSV policy, not an exception to that image policy.
- Accept one successful `.csv` upload, at most 2 MiB (`2,097,152` bytes), containing 1–1,000 data records plus one header.
- Accept UTF-8 with optional leading BOM, comma delimiter, double-quoted fields with doubled quotes, and LF/CRLF record endings; quoted newlines are valid data.
- Reject XLS/XLSX, ZIP, PDF, executables, binary/NUL data, invalid UTF-8, malformed quoting, unsupported delimiters, and mismatched column counts.
- MIME/filename are hints; inspect bytes and grammar. Enforce at most 8 KiB per logical record and 4 KiB per decoded cell before application validation.
- Require every declared header exactly once, in any order; reject missing, duplicate, or unknown headers and mixed/unsupported template versions.
- Ignore entirely blank records while retaining their original record numbers; reject a file with no remaining data records.
- Parse incrementally and process at most 50 rows per queued chunk; never load an unbounded file or split quoted records on physical newlines.
- Limit uploads to 5/hour, confirmations/retries to 5/minute, and template/export reads to 30/minute per Seller; cap status/row polling at 60/minute.
- Allow at most one queued/processing import per Shop, enforced transactionally; another confirmation returns `409 BULK_IMPORT_BUSY`.

### Versioned template columns

All headers below are required. Blank-cell behavior is explicit; these are the only importable fields.

| Header(s) | Version 1 meaning and validation |
| --- | --- |
| `template_version` | Literal `1` in every data record; unrelated to this specification's version. |
| `product_id,inventory_sku_id,expected_revision` | Empty for create; owned Product/base-SKU UUIDs and opaque exported catalog fingerprint required for update. |
| `text_encoding` | `raw` for manually entered template data; `apostrophe_v1` for generated spreadsheet-safe text. |
| `name` | Required trimmed Product name, 1–160 characters. |
| `category_id` | Required active Category UUID belonging to the Shop's canonical Shop Category; resolve through Product options. |
| `sku` | Create: uppercase trimmed alpha-dash code, 1–80 characters, Shop-unique; update: must match the existing base SKU, never rename. |
| `short_description` | Optional text, at most 500 characters; blank clears it on update. |
| `price,original_price` | PHP decimal strings with at most two places; price `0.01–99999999.99`; blank original price clears it, otherwise at least price. |
| `currency` | Required `PHP`; no currency conversion or client-calculated money. |
| `shipping_weight_grams` | Nullable integer `1–100000000`; blank clears it. |
| `shipping_length_mm,shipping_width_mm,shipping_height_mm` | Nullable integers `1–100000` each; blank clears the corresponding field. |
| `unit_cost_cents,cost_currency` | Nullable integer centavos `0–9999999999`; known cost requires `PHP`; unknown cost requires both cells blank, never assumed zero. |

- Create/update use the same headers; update is a complete replacement of these editable values, not an ambiguous blank-means-unchanged patch.
- Missing shipping/cost data may remain on a draft; reject an active-Product update that removes shipping data required by current publication/Checkout rules.
- Do not import category names as identifiers, localized currency separators, scientific notation, formulas as numeric values, or silently rounded prices.
- Export uses the same columns, `product_id ASC`, and update-mode identifiers/fingerprint; exclude option-group/variant Products and soft-deleted/archived Products.
- Export accepts `status=all|draft|active` (`all` means draft plus active), or 1–1,000 explicit owned `product_ids`, never both; reject unsupported filters.
- Export must fit the same byte/record ceilings; reject an oversized selection before download rather than silently truncating it.

### Spreadsheet safety and private artifacts

- Treat imported cells as literal data; never evaluate formulas, execute macros, follow file paths, or fetch URLs.
- Generated catalog CSV prefixes every nonempty `name,sku,short_description` cell with one apostrophe and sets `text_encoding=apostrophe_v1`; ordinary CSV quoting also applies.
- Import removes exactly one required prefix from those fields only in `apostrophe_v1`; `raw` does not strip prefixes. This preserves a genuine leading apostrophe on round-trip.
- Spreadsheet applications can rewrite protections; reject missing encoded prefixes and verify supported-client save/reopen behavior before release, not universal formula safety. [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection).
- Apply spreadsheet-safe output to result/error CSV too; never echo an untrusted cell as an executable formula or include another Shop's identifiers.
- Store immutable source/result bytes privately on the configured disk using generated UUID keys and SHA-256; download through owner-authorized no-store attachment endpoints.
- Delete source/result artifacts 7 days after terminal completion or preview expiry; retain safe job/row outcome metadata for 30 days, then prune. Never purge active work.
- Expire unconfirmed previews 24 hours after validation. Expired records cannot confirm; artifact cleanup never deletes Products or Inventory/history.

### Dry run, row outcomes, and retries

- Upload/validation may persist private import records, but dry run must not create or change Products, SKUs, balances, media, counters, events, or Buyer visibility.
- Structural/header/size/encoding errors reject the entire file; semantic errors belong to rows. Duplicate Product IDs or normalized create SKUs invalidate all conflicting rows.
- Record logical `record_number` (header is 1), field, stable code, safe message, proposed action, normalized values, differences, and current catalog fingerprint.
- Preview totals report `total,creates,updates,unchanged,invalid,warnings`; paginate rows at 50, maximum 100. Warnings are informational, not suppressed validation failures.
- Row codes include `REQUIRED_FIELD,INVALID_VALUE,INVALID_CATEGORY,DUPLICATE_SKU,DUPLICATE_PRODUCT,PRODUCT_NOT_FOUND,UNSUPPORTED_PRODUCT,STALE_PRODUCT`.
- Bind confirmation to import UUID, immutable source hash, template version, mode, preview revision, and the exact eligible-row set.
- Require explicit `confirm_valid_rows=true` after showing all counts; invalid rows are skipped, unchanged rows have no mutation/events, and zero eligible mutations cannot confirm.
- Partial success is per Product row: each valid row commits or rolls back atomically; errors never leave half-created Product/SKU records.
- Commit rechecks category, ownership, simple-Product shape, SKU uniqueness, active shipping requirements, restrictions, and exported/preview fingerprint under locks.
- A changed Product produces a row `STALE_PRODUCT` conflict without overwrite; unrelated valid rows may succeed. Do not lock inventory quantities for catalog edits.
- Upload, confirm, and retry require a UUID `Idempotency-Key`, scoped to Seller/Shop/action with a payload hash; same key/body returns the same import/projection, changed body returns 409. Retain request keys at least 30 days; never reuse a key for new intent.
- Persist each successful row's Product ID and outcome in the same transaction as its catalog changes, unique by `(import_id,record_number)`; worker retries skip committed rows.
- Retry transient infrastructure failures up to three attempts with 5/30-second backoff; exhausted work is `failed` with accurate already-committed counts, never described as full rollback.
- Explicit retry resumes only infrastructure-failed/unprocessed rows of the same confirmed import; validation/conflict rows require a corrected file and new dry run. Resume requires retained source/row records and current authorization; expired artifacts return 410.
- Proposed job states are `validating,dry_run_ready,queued,processing,completed,completed_with_errors,failed,expired`; they are import states, not Order/Shipment states.
- Every processed row ends `created,updated,unchanged,invalid,conflict`; infrastructure-failed/unprocessed rows remain visible for resume. Final counts must reconcile.
- After-commit cache/index refresh or notification failure cannot undo a committed catalog row or cause its replay.

### Seller UI and acceptance

- Follow `docs/design.md`: download template/export → choose mode/upload → review paginated preview/errors → explicit valid-row confirmation → progress/results.
- Show limits, excluded features, create-as-draft/zero-stock warning, replacement/blank semantics, row errors, and partial-success counts before confirmation.
- Provide keyboard-accessible light/dark mobile layouts, contained tables, upload/validation/queue progress, empty/error/retry/expired states, and clear return to Product editing.
- Poll at most every 5 seconds while foregrounded; stop on terminal status/logout. Preserve uncertain mutation keys, refetch status, and never imply offline commit.
- Clear private previews on account/approval/consent loss; request timeouts, forbidden reads, and failed downloads must not appear as success.
- [ ] CSV/template/encoding/byte/record/cell/header boundaries and spreadsheet-safe round-trips are tested.
- [ ] Every source, Product/SKU/category, preview, confirmation, result, and retry is role/Shop-scoped; no private paths or cross-tenant data leak.
- [ ] Dry run changes only import metadata, and confirmation is bound to the reviewed immutable payload/row set.
- [ ] Draft creation and allowed updates reuse catalog validation while preserving media, stock/reservations, historical Order/Finance snapshots, and publication/compliance boundaries.
- [ ] Invalid/conflicting rows are isolated, partial outcomes reconcile, and concurrent/retried processing never duplicates Products, SKUs, events, or committed rows.
- [ ] Busy/expired/infrastructure/authorization changes, cleanup, status recovery, and after-commit failures are covered on SQLite/PostgreSQL.
- [ ] Seller responsive/theme/keyboard states, preview confirmation, retry, downloads, and current Buyer catalog visibility are verified.

## HOW

### Proposed APIs — unavailable until implementation

All paths below are relative to `/api/v1/seller/product-bulk`; none exists in current routes.

| Method/path | Proposed request → result |
| --- | --- |
| `GET /template` | Version 1 header-only CSV plus documented field instructions; examples are not extra import records. |
| `POST /exports` | Allow-listed status or Product IDs → bounded synchronous CSV attachment, private/no-store. |
| `POST /imports` | Multipart `file,mode` (`create` or `update`), UUID header → 202 `{data: Import}`; queued dry run only. |
| `GET /imports/{import}` | Owned UUID → `{data: Import}` with state, mode, hashes/revision, expiry, counts, safe failure, and retry eligibility. |
| `GET /imports/{import}/rows` | `page,per_page` → paginated safe preview/outcomes; never raw storage metadata. |
| `POST /imports/{import}/confirm` | UUID header; `{source_hash,preview_revision,confirm_valid_rows:true}` → 202 current queued/processing/result projection. |
| `POST /imports/{import}/retry` | UUID header; no replacement file → 202 same import resumed, or original projection for identical replay. |
| `GET /imports/{import}/result` | Available owned result → safe CSV with record number, action/outcome, Product ID, field/code/message. |

- Import projection uses `id,template_version,mode,state,source_hash,preview_revision,expires_at,counts,can_confirm,can_retry,error`; all capability flags are server-derived.
- Row DTOs use `record_number,action,normalized_values,proposed_changes,outcome,errors,warnings`; field/code/message errors are safe plain text. Category choices reuse `GET /api/v1/seller/products/options`.
- Planned errors: 401 unauthenticated; 403 role/status/consent; scoped 404; 409 busy/stale/idempotency/not-ready; 410 expired preview/artifact; 422 file/request errors; 429 throttling; retryable 503 infrastructure failure.
- Add focused Seller controllers, Form Requests, Policies, Resources, parser/preview/commit services, and queued chunks; keep existing Product pages/services modular.
- Add UUID `product_import_jobs`, `product_import_rows`, and `product_import_requests` through new migrations: ownership, mode/state, source hash/path, preview revision/expiry, confirmation, counts, normalized row/fingerprint, outcomes/attempts, result reference, and scoped action/key/payload-hash replay records.
- Use string-backed enums and unique mutation/row constraints; transactionally persist Shop processing eligibility and worker progress so job locks alone are not correctness guarantees.
- Reuse `ProductCatalogService`, active Shop-category checks, and shared Product field validators; make their validation reusable rather than sending synthetic HTTP requests to CRUD controllers.
- CSV-first needs no spreadsheet dependency: use bounded PHP CSV readers/writers with an explicit empty escape argument and strict grammar checks. [PHP CSV parsing](https://www.php.net/manual/en/function.fgetcsv.php).
- Queue validation/confirmation work after durable commit; dispatch refresh effects after row commit and keep retry timeouts below queue reservation lifetime. [Laravel queues](https://laravel.com/framework/docs/13.x/queues#jobs-and-database-transactions).
- Catalog fingerprints cover editable values, identity, shape, and relevant lifecycle/compliance state, not stock balances; recheck authorization and category eligibility independently.
- Verify byte boundaries, malformed quotes/newlines/BOM, price/cost precision, category/IDOR, SKU collisions, changed preview, concurrent creates/retries, worker crash-after-commit, and retained partial outcomes.
- Enable proposed routes/UI only after additive migrations, worker recovery, private cleanup, API tests, and Seller/Buyer regressions pass; update schema/domain/progress implementation claims then.
