# Buyer documentation sync — 2026-10-09

Compared the local `docs/` with the user-supplied `cabigan/docs-mobile-buyer-from-webapp/`
handoff on branch `docs/sync-buyer-webapp-contracts-2026-10-09`. The handoff records
a Laravel source review at `0a6aaa8096196e2c26822ac0281d5d30675511a8`; its shipping
contract was inspected at `22b0a48f9575ead182d03c35ab87345711c23b90`, and the separate
chat-media addition is dated 2026-10-06. These upstream inspection/validation records
are supplied evidence, not backend source or runtime checks performed during this merge.

## Material updates

- Imported [per-Shop shipping selection](../api/shipping-selection.md): logistics-options,
  Seller-enabled provider choice/single-option fallback, frozen selections and hashes,
  current shipping projections, nullable legacy Order providers and quote failures.
- Imported [private chat media](../api/chat-media.md): runtime-gated image/MP4/document
  upload, processing/readiness, explicit ordered binding on Send, authenticated delivery,
  per-channel scope, supported upload/message replay and private account cleanup.
- Updated schemas, wire tables, operations, synthetic examples, feature index, matching
  checkout/voucher/Order/channel specs, requirements and release/adoption gates.
- Corrected inherited summaries: the inventory has 103 documented operations (95 original,
  logistics-options, seven media operations); Markdown now includes all media IDs and the
  six updated message request contracts. Per-operation retry notes distinguish reads,
  keyed uploads and unkeyed processing/removal. Profile/Review image rules remain separate.
- Reconciled selected-only PSGC and map guidance with the local implementation and recorded
  localhost provider evidence. Temporary background revalidation retains verified route state.

## Preservation and adoption

The local implementation still adopts `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`.
Read-only client inspection found the older required shipping fields in quote/Batch parsers;
provider selections and attachment DTOs/actions are absent. [G25/G26](integration-gaps.md)
remain open. Documentation changes implement no new Flutter actions or deployed backend behavior.

Root and bundled agent instructions, original progress entries/archive bytes, SDK/package
metadata, verification reports, screenshots and PSGC assets are preserved. The incoming auth
guide would remove local background revalidation behavior; that change was excluded. Incoming
external-project disclaimers and older SDK metadata do not replace original local evidence.
Only the current Progress status header and a new dated sync entry are updated.

## Local checks

Results are recorded in [the local validation record](webapp-docs-sync-validation-2026-10-09.json).
The check scope is documentation: portable links/anchors, JSON/schema/example consistency,
stable operation IDs and current supplied routes, all 22 Customer spec lengths, unchanged
evidence/assets/instructions and Git whitespace/scope. The existing bundle validator also
checks PSGC registrations and Android manifest boundaries.

No Flutter tests/builds, live account/provider exchanges, dependency changes, backend edits,
migrations, device checks or deployment operations ran during this documentation sync.
Earlier local evidence retains its dates and limits; installed Android/GPS/TalkBack, current
API deployment, real commerce/media acceptance and production signing remain open.
