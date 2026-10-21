# Regional postal snapshot

Researched 2026-10-22. `postal-codes.csv` is the offline input for the regional demo seeder: 2,136 locality rows grouped into 1,992 exact, four-digit codes across the 18 fixture regions. Repeated code rows describe shared postal localities; they produce one supported-code record and one physical lane per hub. Leading zeroes are retained. No network lookup runs during seeding.

Sources:

- `phlpost`: [PHLPost ZIP Code Locator](https://phlpost.gov.ph/zip-code-locator/), the postal operator's current public table. Its 959 rows (958 distinct codes) do not cover all regions. Its code/locality entries take precedence over the supplementary directory for the same code.
- `directory`: [List of ZIP codes in the Philippines](https://zip.ph.neps.dev/), a supplementary nationwide locality directory, used for codes absent from the current PHLPost table. This includes postal districts, special institutions and PO boxes as well as municipalities. Supporting a postal code in this demo fixture is not a live carrier serviceability guarantee.
- Region/province assignments use the repository's `packages/psgc-address-data/data` (PSGC second quarter 2026). [PSA's NIR update](https://psa.gov.ph/content/second-quarter-2024-psgc-updates-creation-negros-island-region-and-correction-names-two) places Negros Occidental, Negros Oriental and Siquijor in NIR. [PSA's regional notes](https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2E__LP__PDN/0052E4FPCT0.px/) record Sulu's transfer to Region IX. Isabela City remains under Region IX, while other Basilan localities belong to BARMM. Former Maguindanao entries are assigned to the current two provinces using PSGC locality names.

Reviewed source corrections: PHLPost's rows for T'boli (9513), Kiamba (9514), Lantapan (8722) and Kitaotao (8716) mistakenly label the province as Agusan del Norte; their own region labels and PSGC put them in South Cotabato, Sarangani and Bukidnon respectively. Normalized obvious locality spellings (Bataraza, Paluan, Polillo, Calauan, Cortes, Trece Martires, Talugtug, Libjo, Pinukpuk), expanded Sta./Sto., and retained the current Lambayong name. Lake Sebu uses PHLPost's 9518; 9514 names Kiamba. Malixi is retained as a postal locality of Tagbina. The `source` column identifies the postal source; province/name normalization does not imply that the source table itself was corrected.

| Fixture region | Supported codes |
| --- | ---: |
| NCR | 284 |
| CAR | 79 |
| Region I | 124 |
| Region II | 93 |
| Region III | 146 |
| Region IV-A | 205 |
| MIMAROPA | 75 |
| Region V | 117 |
| Region VI | 101 |
| NIR | 64 |
| Region VII | 102 |
| Region VIII | 143 |
| Region IX | 88 |
| Region X | 93 |
| Region XI | 62 |
| Region XII | 49 |
| Region XIII | 74 |
| BARMM | 93 |
| Total | 1,992 |

`RegionalPostalCatalog` derives locality names ending in `Lane` (maximum 80 characters) and uppercase abbreviated codes suffixed with their postal code. The requested Santa Cruz, Laguna example is explicitly `Santa Cruz Lane`, `STC-01`, `4009`. Multiple localities sharing one postal code share a lane, with names joined within the length limit. Unknown operator-added supported codes retain the `POSTAL-<code>` fallback. Existing dedicated mappings and legacy `LOCAL` / `POSTAL-<code>` physical lanes are reused without renaming operator data. When an existing lane is shared by different destinations, repair leaves that physical lane intact and allocates separate lanes, using `POSTAL-<code>` and a numeric suffix when its preferred code is already shared.

To refresh, review the source rows and current PSGC boundaries, update the CSV and this provenance/count record together, then run `RegionalPostalCatalogTest`, `RegionalPostalCoverageTest` and `PhilippinesLogisticsSeederTest`. Do not generate numeric ranges or assume that postal prefixes define current administrative regions.
