---
feature: bulk-product-import-export
title: Seller Bulk Product Import / Export
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Bulk Product Import / Export
## WHAT
- **Purpose:** Let Sellers download their catalog to CSV/XLSX, edit it offline, then safely create/update many Products through a validated bulk import.
- **Canonical role:** `SELLER`.
- `Seller.md` defines this as a high-volume catalog tool for downloading the Seller's current catalog, editing it in CSV/Excel, and synchronizing the changes back through resilient parsing and row-level validation. fileciteturn67file0
- **Source-defined flow:**
```text
EXPORT
Seller chooses scope/format
→ Laravel generates Seller-only rows
→ stable Product/SKU identifiers
→ current template version
→ CSV/XLSX download

IMPORT
Seller uploads CSV/XLSX
→ validate file + template
→ normalize/validate rows
→ DRY RUN
→ creates / updates / unchanged / warnings / errors
→ Seller confirms
→ queued controlled batches
→ result file with every row outcome
→ ordinary Product/Inventory events
```
- **Core boundary:** Bulk Import/Export is an orchestration tool, not a second Product or Inventory domain.
  - Product/catalog fields reuse Order Management/Product Management rules.
  - Stock changes reuse Seller Inventory movements and invariants.
  - Promotions reuse Promotion rules if supported in the template.
- **Recommended routes:**
```text
/seller/products/bulk
/seller/products/bulk/imports/{import}
```
- **Architecture:**
  - Next.js/React: template download, upload UI, dry-run preview, confirmation, progress, result download.
  - Laravel: Seller scoping, upload validation, parser, template/version validation, row normalization, dry-run classification, import jobs, Product/Inventory domain calls, result generation.
  - Queues: large import/export processing and progress.
  - Object/file storage: private uploaded source files and generated result/export files.
- **Supported source-required formats:** `CSV`, `XLSX`.
- **Non-goals:**
  - bypassing normal Product validation
  - directly writing Inventory balances
  - changing another Seller's Product using supplied IDs
  - rewriting historical Order snapshots
  - importing arbitrary workbook macros/formulas as business logic
  - inventing extra spreadsheet formats unless explicitly added
## MUST
### Authentication and Seller scope
- Import/export requires authenticated `SELLER`.
- Every exported/imported Product/SKU belongs to the authenticated Seller/shop.
- Never trust client-supplied `seller_id`.
- A Seller-supplied Product/SKU ID must resolve inside that Seller's scope.
- An ID belonging to another Seller must never update that record.
- Use `401`, `403`, `404`, `422`, and `409` according to shared AISLEY rules. fileciteturn69file6
### Export
- Seller can export only their own catalog.
- Export may support:
  - all Seller Products
  - allow-listed current filters/scope
- Exact export scope options are Open.
- Export rows should contain stable immutable Product/SKU identifiers for safe later updates.
- Do not use product names as the only update key.
- Export must include a template/schema version.
- Exact placement of the template version is Open:
  - dedicated column
  - metadata sheet for XLSX
  - documented header/metadata row
### Exported fields
- Export only fields the Seller is allowed to view/edit through this feature.
- Likely Product-domain fields include:
  - Product ID
  - SKU/variant ID
  - name/title
  - description
  - category reference
  - variant attributes
  - price
  - publish/archive-related editable state where allowed
  - stock-adjustment intent when supported
- Exact columns must match the actual Product/Inventory schema.
- Never export:
  - another Seller's data
  - Buyer/order PII
  - internal compliance notes
  - secrets
  - payout data
  - password/auth/session fields
### Historical Order integrity
- Exported/imported Product edits apply to current catalog state.
- They must not rewrite historical Order Item snapshots:
  - historical unit price
  - Product/variant description snapshot
  - quantity
  - discount/totals
- Archiving/updating a Product preserves historical references.
### CSV/XLSX generation
- Small exports may run synchronously; large exports should queue.
- Laravel supports background jobs/batches and streamed downloads. citeturn399998search1turn399998search0
- Queue threshold is Open.
### Spreadsheet export safety
- Product/store text is Seller-controlled and may begin with spreadsheet formula characters.
- CSV/XLSX export must prevent untrusted cells from becoming executable formulas when opened in spreadsheet software.
- OWASP documents CSV/formula injection risk for cells beginning with characters such as `=`, `+`, `-`, and `@`. citeturn568315search0
- Use a documented spreadsheet-safe escaping/typing strategy.
- For XLSX, write untrusted text cells explicitly as text where the chosen writer supports it.
- Formula behavior must never be used to calculate authoritative imported Product values.
### Import file upload
- Import accepts only configured CSV/XLSX files.
- Validate:
  - successful upload
  - allowed file type/content
  - maximum file size
  - maximum row count
  - expected worksheet when applicable
- Exact size/row limits are Open.
- Laravel file validation can inspect content-derived MIME/type and enforce size. citeturn542209search2turn542209search5
- Shared AISLEY rules additionally require malware scanning and private object/file storage for uploads. fileciteturn69file6
### Private file storage
- Import/result files are private artifacts stored through configured file/object storage.
- Store asset references, not server paths; downloads require authorization/signed access. fileciteturn69file6
- Retention is Open.
### Parser
- Parser must support CSV and XLSX.
- Exact library is Open.
- **Recommendation:** use PhpSpreadsheet or a maintained Laravel-compatible wrapper when one dependency is desired for both CSV/XLSX.
- PhpSpreadsheet officially supports CSV and XLSX readers/writers. citeturn399998search3turn399998search4
- Do not manually parse XLSX ZIP/XML structures.
### Large-file memory
- Do not assume a whole large workbook safely fits in PHP memory.
- PhpSpreadsheet holds spreadsheet data in memory and provides `setReadDataOnly()` and read filters for loading selected ranges/cells. citeturn542209search0turn542209search1
- Large imports should process bounded chunks/ranges rather than loading unnecessary styling/formulas/data.
- CSV may be streamed/iterated row-by-row when parser architecture allows.
- Exact chunk size is Open and must be configurable/profilable.
### CSV encoding
- Normalize CSV text to UTF-8; handle BOM/non-UTF-8 input explicitly.
- PhpSpreadsheet supports configurable/guessed CSV encoding. citeturn399998search3
- Encoding failure must report an error rather than corrupt text.
### Template version
- Import requires the current supported versioned template.
- Validate headers and version before row processing.
- Unknown/obsolete versions must not be silently interpreted as the latest schema.
- Exact backward-compatibility window is Open.
- Recommended:
  - reject unsupported major versions
  - provide a current template download link
- Template version should be stored on the import job for reproducibility.
### Headers
- Required headers must match the template contract; duplicate headers are invalid.
- Unknown columns may warn or reject according to policy.
- Prefer stable header names over positional mapping.
### Import modes
- Source flow requires Seller to choose create/update mode.
- Recommended explicit modes:
```text
CREATE
UPDATE
```
- Optional combined `UPSERT` is **not** source-required and remains Open.
- `CREATE` must not unexpectedly overwrite existing stable IDs.
- `UPDATE` requires Seller-owned stable Product/SKU identifiers.
- Exact handling of blank IDs in each mode must be documented.
### Dry run
- Import is a two-phase workflow:
```text
UPLOAD / VALIDATE
→ DRY RUN
→ CONFIRM
→ COMMIT
```
- Dry run must not mutate Product, Inventory, Promotion, search index, or Buyer-visible data.
- Dry-run result reports:
  - creates
  - updates
  - unchanged
  - warnings
  - errors
- Include row/line references.
- Seller must be able to review errors before confirming.
### Dry-run stability
- Confirmation must refer to the exact file/version that was dry-run.
- Recommended:
  - immutable stored upload
  - file hash/fingerprint
  - import job ID
- Seller cannot replace the file contents behind an existing dry-run result.
- If authoritative Product/Inventory data changed between dry run and commit, commit must revalidate and may produce conflicts.
### Row normalization
- Normalize text/nulls, fixed-precision money, allow-listed booleans/enums, and SKU/category identifiers.
- Do not silently coerce malformed values.
- Preserve original row number.
### Product validation
- Reuse Product Management validation for ownership, required fields, category, Product/variant relations, SKU uniqueness, price, and publish/archive constraints.
- Bulk import must not create a weaker validation path.
### Fixed-precision price
- Parse prices as fixed-precision decimal/minor-unit representation.
- Never use binary floating-point for authoritative money.
- Invalid numeric formats produce row errors.
- Imported price changes do not rewrite historical Order prices. fileciteturn69file6
### Product/SKU ownership
- UPDATE mode must resolve IDs through Seller scope:
```text
authenticated seller
→ seller-owned Product
→ seller-owned SKU
```
- A valid global ID belonging to another Seller is still forbidden.
- Do not leak whether another Seller owns the supplied ID beyond safe error semantics.
### Inventory integration
- Stock changes in an import must use the Seller Inventory domain.
- Never bulk-write:
```text
inventory_balances.on_hand = spreadsheet_value
```
outside Inventory rules.
- If spreadsheet represents an absolute physical count:
```text
desired_on_hand - current_on_hand = CORRECTION delta
```
and Inventory records a movement.
- Preserve `on_hand >= reserved` and other Inventory invariants.
- Every accepted stock change has an import/batch reference for audit/idempotency.
### Inventory concurrency
- Commit must re-load/lock current Inventory because stock may change after export/dry run.
- Reservation conflicts fail that row/group; exported stock is never current authority.
### Variants spanning rows
- If one Product has multiple SKU rows, validation must treat their relationship consistently.
- Avoid committing a Product into a partially invalid variant structure accidentally.
- Recommended transaction unit is a **Product aggregate** (Product + its related variant rows), not necessarily one spreadsheet row.
- Exact grouping depends on template structure.
### Atomicity
- Source explicitly says malformed rows should not necessarily fail unrelated valid rows and that atomicity mode must be explicit.
- Recommended MVP:
```text
partial success by Product aggregate
```
- Meaning:
  - invalid Product aggregate → no changes for that aggregate
  - unrelated valid aggregates may commit
- Whole-file all-or-nothing mode is optional/Open.
- Result file must make partial success obvious.
### Transactions
- Each chosen atomic unit commits/rolls back together.
- Inventory adjustments reuse Inventory locking/movement rules.
- Do not wrap a large entire import in one long transaction by default.
### Idempotency
- Confirmed imports require a stable import job/idempotency key.
- Reprocessing the same confirmed job must not duplicate:
  - Products
  - variants
  - Inventory movements
  - promotion effects
  - downstream events
- Row/Product operations should include import job + logical row/aggregate identity as appropriate.
- Duplicate queue retries must resolve to the same committed outcome.
### Queue processing
- Large confirmed imports run asynchronously; Laravel explicitly uses CSV parsing as a queue example and supports job-batch progress. citeturn399998search1
```text
parent import
→ partition
→ batched chunk jobs
→ final result/status
```
- Preserve source-row identity because batch jobs may complete out of order.
### Import job states
- Recommended:
```text
UPLOADED
VALIDATING
DRY_RUN_READY
READY_TO_CONFIRM
PROCESSING
COMPLETED
COMPLETED_WITH_ERRORS
FAILED
CANCELLED optional
```
- Exact names are implementation choices.
- Do not report `COMPLETED` while queue chunks are still running.
### Progress
- Seller can read/poll progress: total, processed, successful, failed, warnings.
- Laravel batches expose progress metadata. citeturn399998search1
- Final result file remains authoritative for row outcomes.
### Result file
- Every confirmed import produces a final result artifact when practical.
- Result columns should include:
  - original row number
  - Product/SKU identifier
  - requested action
  - outcome
  - warning/error code
  - human-readable message
  - created/updated identifier where safe
- Never include another Seller's data or secrets.
- Result download requires Seller ownership authorization.
### Row errors
- Errors must be line-specific/actionable, e.g. missing field, invalid category, duplicate SKU, wrong ownership, invalid price, stock conflict, unsupported template.
- Preserve row detail instead of only returning "Import failed".
### Warnings
- Warnings may allow commit; exact policy is Open.
- Warnings must never conceal validation failures.
### Unchanged rows
- Rows whose normalized values equal current authoritative state should be classified `UNCHANGED`.
- Do not issue unnecessary Product/Inventory updates/events for unchanged values.
- This reduces duplicate indexing and Inventory movements.
### Search/index/events
- Successful Product changes trigger the ordinary Product-domain events.
- Successful Inventory changes trigger ordinary Inventory events.
- Do not create special weaker synchronization just for bulk import.
- Downstream indexing/cache/alerts execute after the source transaction commits. fileciteturn69file6
### Export/import and Vacation Mode
- Vacation Mode does not prevent Seller from editing catalog offline/importing unless policy says otherwise.
- It still controls Buyer discovery/checkout.
- An import must not bypass Vacation Mode or compliance state when publishing Products.
### File security
- Treat spreadsheet contents as untrusted.
- Do not execute spreadsheet formulas/macros.
- Read values as data for the import contract.
- Reject/ignore unsupported workbook constructs according to parser policy.
- Do not expose local temporary file paths in API responses.
### Auditability
- Import job should record:
  - Seller
  - source file asset/reference
  - template version
  - mode
  - timestamps
  - file hash
  - dry-run summary
  - confirmed-by Seller
  - final counts/status
- Stock movements reference the import job.
- Exact retention is Open.
### Frontend states
- Export: idle/generating/ready/failed.
- Upload: idle/uploading/parsing/invalid.
- Dry run: loading/ready/warnings/errors/no-valid-rows.
- Import: queued/processing/progress/completed/completed-with-errors/failed.
- Result: ready/download-failure; confirmation requires a valid dry run.
### Accessibility
- Label upload/format/mode/confirm/progress/result controls.
- Dry-run/error tables must be keyboard readable; errors and progress need textual equivalents.
### Acceptance criteria
- [ ] Seller exports only their own catalog.
- [ ] Export includes stable Product/SKU identifiers and template version.
- [ ] CSV/XLSX are the supported source-required formats.
- [ ] Import validates file, headers, version, ownership, Product fields, price, Inventory, category, and variants.
- [ ] Dry run mutates nothing and reports creates/updates/unchanged/warnings/errors by row.
- [ ] Confirmation is bound to the exact dry-run file/import.
- [ ] Another Seller's ID cannot be updated.
- [ ] Invalid rows do not silently change data.
- [ ] Valid unrelated Product aggregates may succeed under the selected partial-success mode.
- [ ] Inventory updates reuse Inventory movements/invariants.
- [ ] Historical Order snapshots never change.
- [ ] Large confirmed jobs run asynchronously with progress/final status.
- [ ] Retrying the same confirmed job does not duplicate Product/Inventory effects.
- [ ] Final result artifact explains every row outcome.
- [ ] Successful changes trigger ordinary Product/Inventory after-commit events.
- [ ] Spreadsheet export handles formula-injection risk.
## HOW
### Project findings
- `Seller.md` requires bulk CSV/Excel upload/download, offline edits, synchronization back to the catalog, resilient parsing, strict validation, and malformed-row reporting without necessarily failing the whole batch. fileciteturn67file0
- The Seller system flow adds stable Product/SKU IDs, template versions, create/update mode, dry run, Seller confirmation, controlled batches, row result files, idempotency, and asynchronous progress.
- Shared AISLEY architecture requires Seller scoping, Laravel-authoritative mutations, private file storage, transactions, idempotency, after-commit events, and signed/authorized private exports. fileciteturn69file6turn69file9
### Recommended data model
```text
product_import_jobs
- id, seller_id, source_asset_id, source_hash
- template_version, mode, status
- dry_run_summary, queue_batch_id, result_asset_id
- total/processed/succeeded/failed/warnings counts
- confirmed_at, created_at, updated_at

product_import_rows
- import_job_id, source_row, aggregate_key
- action, status, product_id, sku_id
- error_code, message
```
- Persist row records or materialize them into a result artifact according to scale/retention.
### Recommended API
```http
GET  /api/seller/product-bulk/template
POST /api/seller/product-bulk/exports
POST /api/seller/product-bulk/imports
GET  /api/seller/product-bulk/imports/{import}
POST /api/seller/product-bulk/imports/{import}/confirm
GET  /api/seller/product-bulk/imports/{import}/result
```
- Use Seller-scoped Policies/relations, upload Form Requests, and safe Resources.
### Recommended actions/jobs
```text
ExportSellerCatalog
CreateProductImport
ValidateProductImport
BuildImportDryRun
ConfirmProductImport
ProcessProductImportChunk
FinalizeProductImport
GenerateProductImportResult
```
- Product mutations call existing Product domain actions.
- Inventory columns call `AdjustSellerInventory`/equivalent.
### Parsing recommendation
- For this school-project stack, one maintained parser supporting both required formats is simpler than two unrelated implementations.
- PhpSpreadsheet supports CSV/XLSX, read-data-only mode, encoding controls, readers/writers, and read filters. citeturn399998search3turn542209search0
- Exact dependency remains an implementation decision.
### Async recommendation
- Laravel's Queue documentation specifically uses CSV importing as a background-job example and provides job batching with progress callbacks/metadata. citeturn399998search1
- Use batching only when file/job size warrants it; small dry runs can still execute synchronously if bounded.
### Tests
- **Laravel:** Seller isolation; CSV/XLSX/template errors; CREATE/UPDATE; cross-Seller IDs; dry-run no mutation; Product/variant/price/Inventory validation; partial success; idempotent retry; progress/result ownership; Order-history preservation.
- **Security:** formula-like exports are neutralized/typed as text; imported formulas are never executed.
- **Frontend:** upload/mode/dry-run/confirm/progress/result/errors/accessibility.
### Risks
- **Tenant/partial corruption:** weak ownership or row grouping can overwrite other Sellers or leave invalid Product variants.
- **Inventory/duplicate drift:** direct stock writes or non-idempotent retries can corrupt balances.
- **Resource/security:** whole-workbook loading can exhaust memory; spreadsheet exports can trigger formula injection.
- **Staleness/template drift:** data may change after dry run and old templates may map incorrectly.
### Open questions
- Exact columns/template version and Product/variant row grouping.
- File/row/chunk limits.
- CREATE/UPDATE vs optional UPSERT.
- Product-aggregate partial success vs optional whole-file atomicity.
- Bulk-editable Product states/fields and Promotions inclusion.
- Absolute stock vs delta design.
- File/result retention, queued-export threshold, parser/package.
- Cancellation/retry UX and older-template compatibility.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller source: `Seller.md`
- Seller flow: `feature-system-flows/seller/bulk-product-import-export.md`
- Laravel Queues / Job Batching: https://laravel.com/docs/12.x/queues
- Laravel Responses / Streamed Downloads: https://laravel.com/docs/12.x/responses
- Laravel File Validation: https://laravel.com/docs/12.x/validation
- PhpSpreadsheet Reading/Writing: https://phpspreadsheet.readthedocs.io/en/master/topics/reading-and-writing-to-file/
- OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection
