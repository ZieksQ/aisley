# Bundled PSGC reference assets

These nineteen JSON files are byte-for-byte copies from AISLEY's @aisley/psgc-address-data package at checkout 57e9eb2. Attribution: Philippine Statistics Authority, Philippine Standard Geographic Code, Q2 2026 publication `PSGC-2Q-2026-Publication-Datafile.xlsx`. Retain attribution and the manifest when redistributing; no additional license grant or independently audited PSA publication match is asserted. [PSA PSGC](https://psa.gov.ph/classification/psgc)

[manifest.json](manifest.json) records source revision, byte lengths and SHA-256 checksums. The source package's README describes this dataset as PSA PSGC Q2 2026; this task validates copies against that package, not the original workbook. See [loading/cascade rules](../../maps-location-api.md) and [all asset entries](pubspec-assets.yaml).

Copy the index and eighteen referenced folders into assets/psgc/. Keep documentation/manifest outside runtime if preferred. Do not flatten folders, rewrite JSON, coerce code strings to integers, or turn supplemental population/correspondence metadata into address API fields. Files contain public administrative data, not user addresses.
