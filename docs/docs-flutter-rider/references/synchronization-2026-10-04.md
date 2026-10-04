# Courier shared-context synchronization — 2026-10-04

Current [source inspection](current-source-inspection.json): Laravel `22b0a48f9575ead182d03c35ab87345711c23b90`. The imported Courier snapshot is unchanged against the pre-sync tracked files except the tracked-only agent guide. Shared provider selection/pickup/pricing context now follows source authority. No role-specific Courier endpoint change was found in the inspected sources.

Seller enables Shop providers; Customer selects/freezes one per Shop Order; pickup enforces it. Legacy recommendation rules cannot substitute a provider on snapshot-backed Orders. Unavailable frozen route/provider holds fulfillment and preserves Customer COD. Operational task eligibility, affiliation, evidence, COD acknowledgment and Logistics-confirmed delivery remain unchanged.

Courier implementation records, architecture, design, instructions, feature statuses and existing archives remain preserved. This bundle still contains documentation only. Imported client commands/results were not rerun. Current documentation checks and their limits are in [validation summary](sync-validation.json). No application/Flutter tests, dependencies/builds, authenticated API calls or installed-device acceptance ran.

[Snapshot hashes](imported-evidence.json) preserve the observed imported inputs independently of historical client adoption records.
