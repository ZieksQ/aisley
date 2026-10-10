# Philippines regional logistics development fixtures

Researched on 2026-10-08. `PhilippinesLogisticsSeeder` replaces the Luzon-only fixture in the default `DatabaseSeeder`. It reuses the eight existing `logistics.luzonNN` identities and adds ten regional organizations, including Negros Island Region. The standalone `LuzonLogisticsSeeder` remains available for its older, smaller fixture tests.

Run from the repository root:

```sh
(cd src/api && php artisan db:seed --class=PhilippinesLogisticsSeeder)
```

The seeder is blocked in production and runs in one database transaction. It adds missing records without resetting existing passwords, suspended accounts, Courier reviews/capabilities, manually cleared pins, disabled connections/coverage, published plan history, rate-card history, or trucks already traveling. Active plans receive a successor when supported postal codes need dedicated lanes, as described below. A missing regional fixture plan is published separately but stays inactive when other plans exist, with a review warning before manual activation. Newly inserted records have active accounts and approved Courier affiliations strictly as development fixtures. They do not contain fabricated licenses, vehicle registration documents, company registration evidence, or policy-consent acceptances. Couriers authenticate through the existing mobile bearer-token API; no Courier web UI is added.

## Regional hubs, research and pins

The [PSA region list](https://psa.gov.ph/classification/psgc/regions?vcode=62) and bundled `@aisley/psgc-address-data` identify all 18 regions. The table links real operator branch, warehouse, or port evidence used to choose a freight district. A branch listing proves a logistics presence, not that the location is a regional sorting warehouse. Each Aisley business is fictional, independent, and operates one hub.

Pins are manually chosen **representative district coordinates**, not surveyed or operator-confirmed premises. Street descriptions are areas, not copied private warehouse addresses. Source URLs and reference descriptions are retained in the fixture catalogue. Existing pins are preserved, including older Luzon defaults; use Logistics Account Settings to confirm/correct them with the normal revision/history workflow. No third-party credentials, branding, telephone numbers, or affiliation are impersonated.

| Region | Hub district | Postal coverage | Latitude, longitude | Location evidence |
| --- | --- | --- | --- | --- |
| National Capital Region (NCR) | City of Manila, Port Area | 1018 | 14.5896, 120.9692 | [PPA South Harbor Port Area freight gateway](https://www.ppa.com.ph/ppa_contactus) |
| Cordillera Administrative Region (CAR) | City of Baguio, Kagitingan | 2600 | 16.416, 120.5955 | [LBC Baguio Center Mall branch area](https://www.lbcexpress.com/branches-philippines/BENGUET) |
| Region I (Ilocos Region) | City of San Fernando, Catbangen | 2500 | 16.605, 120.315 | [LBC San Fernando La Union branch city](https://www.lbcexpress.com/us/branch-holiday-schedule) |
| Region II (Cagayan Valley) | Tuguegarao City, Carig | 3500 | 17.656, 121.752 | [LBC Carig Regional Center branch area](https://www.lbcexpress.com/branches-philippines/CAGAYAN) |
| Region III (Central Luzon) | City of San Fernando, San Isidro | 2000 | 15.05, 120.689 | [LBC Pampanga distribution operations](https://www.lbcexpressholdings.com/files/2020/11/23/1269/LBC_2019_Annual_Report.pdf) |
| Region IV-A (CALABARZON) | City of Calamba, Paciano Rizal | 4027 | 14.2117, 121.1653 | [RLX Calamba SPX warehouse complexes](https://rlxlogistics.ph/) |
| MIMAROPA Region | City of Calapan, Tawiran | 5200 | 13.4117, 121.1803 | [PPA Calapan / Batangas RoRo gateway](https://starliteferries.com/) |
| Region V (Bicol Region) | City of Legazpi, Bgy. 36 - Kapantawan | 4500 | 13.146, 123.752 | [LBC Legazpi branches](https://www.lbcexpress.com/branches-philippines/ALBAY) |
| Region VI (Western Visayas) | City of Iloilo, Obrero-Lapuz | 5000 | 10.711, 122.582 | [FAST Iloilo Lapuz logistics office](https://fast.com.ph/contact-us/) |
| Negros Island Region (NIR) | City of Bacolod, Singcang-Airport | 6100 | 10.647, 122.934 | [FAST Bacolod Singcang logistics office](https://fast.com.ph/contact-us/) |
| Region VII (Central Visayas) | City of Mandaue, Subangdaku | 6014 | 10.323, 123.933 | [FAST Mandaue logistics headquarters](https://fast.com.ph/contact-us/) |
| Region VIII (Eastern Visayas) | City of Tacloban, Barangay 77 | 6500 | 11.215, 125.01 | [FAST Tacloban Barangay 77 office](https://fast.com.ph/contact-us/) |
| Region IX (Zamboanga Peninsula) | City of Zamboanga, Baliwasan | 7000 | 6.913, 122.061 | [FAST Zamboanga distribution city](https://blog.fast.com.ph/warehousing-solutions-in-the-philippines-explained-a-complete-business-guide/) |
| Region X (Northern Mindanao) | City of Cagayan De Oro, Bulua | 9000 | 8.499, 124.622 | [FAST Cagayan de Oro Bulua office](https://fast.com.ph/contact-us/) |
| Region XI (Davao Region) | City of Davao, Sasa | 8000 | 7.113, 125.65 | [FAST Davao Sasa logistics office](https://fast.com.ph/contact-us/) |
| Region XII (SOCCSKSARGEN) | City of General Santos, Labangal | 9500 | 6.114, 125.155 | [FAST General Santos Labangal office](https://fast.com.ph/contact-us/) |
| Region XIII (Caraga) | City of Butuan, Bayanihan Pob. | 8600 | 8.947, 125.52 | [FAST Butuan logistics office corridor](https://fast.com.ph/contact-us/) |
| Bangsamoro Autonomous Region In Muslim Mindanao (BARMM) | Sultan Kudarat, Salimbao | 9605 | 7.263, 124.257 | [FAST Cotabato-area office in Sultan Kudarat](https://fast.com.ph/contact-us/) |

Postal codes follow the [PHLPost locator](https://phlpost.gov.ph/zip-code-locator/); the region hierarchy follows bundled PSGC. Each fixture supports its hub's urban four-digit code with an active local-delivery mapping. **All regions are represented; every Philippine postal code is not covered.** Island/province-wide coverage must be explicitly configured with actual final-mile capability. The BARMM fixture is in Sultan Kudarat, Maguindanao del Norte, near the Cotabato freight market, rather than misclassifying General Santos as BARMM.

## Adjacent linehaul corridors

Each row seeds two independently accepted, active directed edges, with a standard physical lane and next-hub mapping at both ends. There are 21 corridors / 42 directed connections. Long-distance delivery uses several regional transfers; there are no all-to-all edges. A single trip means the same loaded truck can reach the next hub without a third sorting-hub handoff. It does not mean a guaranteed nonstop driving shift or guaranteed ferry departure. Longer crossings require rest/crew planning and ferry reservations outside these fixtures.

| Regional pair | Corridor | Approximate route km | Approximate elapsed hours |
| --- | --- | ---: | ---: |
| ncr ↔ region-3 | NLEX / San Fernando | 80 | 3 |
| ncr ↔ region-4a | SLEX / Calamba | 70 | 3 |
| region-3 ↔ region-1 | SCTEX / TPLEX / Manila North Road | 220 | 5 |
| region-3 ↔ car | TPLEX / Marcos Highway | 230 | 6 |
| region-3 ↔ region-2 | NLEX / Nueva Ecija / Dalton Pass / AH26 | 440 | 10 |
| region-1 ↔ car | Naguilian Road | 65 | 2.5 |
| region-4a ↔ region-4b | Batangas–Calapan RoRo | 120 | 6 |
| region-4a ↔ region-5 | AH26 / Quezon / Camarines / Albay | 460 | 10 |
| region-4b ↔ region-6 | Calapan–Roxas / Roxas–Caticlan RoRo / Iloilo | 430 | 14 |
| region-5 ↔ region-8 | Matnog–Dapdap RoRo / AH26 / San Juanico | 350 | 11 |
| region-6 ↔ nir | Dumangas–Banago RoRo | 75 | 4 |
| nir ↔ region-7 | Bacolod–San Carlos / San Carlos–Toledo RoRo / Mandaue | 220 | 8 |
| region-7 ↔ region-8 | Cebu–Ormoc RoRo / Ormoc–Tacloban | 230 | 9 |
| region-8 ↔ region-13 | Tacloban–Liloan / Liloan–Lipata RoRo / Butuan | 400 | 13 |
| region-13 ↔ region-10 | Butuan–Gingoog–Cagayan de Oro coastal road | 210 | 5 |
| region-13 ↔ region-11 | AH26 / Agusan del Sur / Tagum | 310 | 7 |
| region-10 ↔ region-11 | Bukidnon / Buda / Davao | 290 | 7 |
| region-10 ↔ barmm | Iligan / Malabang / Sultan Kudarat | 240 | 6 |
| region-11 ↔ region-12 | Davao–Digos–General Santos | 150 | 4 |
| region-12 ↔ barmm | General Santos–Koronadal–Tacurong–Cotabato corridor | 190 | 5 |
| region-9 ↔ barmm | Zamboanga–Pagadian–Malabang–Sultan Kudarat | 420 | 11 |

Cross-island links use documented vehicle-carrying corridors: [Starlite Batangas–Calapan / Roxas–Caticlan](https://starliteferries.com/our-fleet/), [FastCat Matnog–Dapdap, Dumangas–Banago and Liloan–Lipata](https://www.fastcat.ph/about-us/), and [Lite Ferries San Carlos–Toledo / Cebu–Ormoc](https://liteferries.com.ph/schedule/schedule.php/index). Land segments connect these gateways to the selected city hubs. These sources establish corridors, not the estimated door-to-door kilometers/hours or operating availability on a particular date.

Distances/times are explicit approximate **development corridor inputs**, not straight-line calculations, live provider measurements, or published timetable promises. The existing routing API serializes nonzero stored connection metrics as `provider=operator`; seeded values use that compatibility path and require real operator confirmation before operational use. No paid geocoding/matrix calls occur during seeding. RoRo waiting/sailing estimates are included, and the route planner adds its configured per-hop handling allowance. The model does not support ferry booking, mode-specific costs, or sailing calendars; no new transport behavior is invented.

Every new hub gets an open exception lane, a dedicated local-delivery lane for each active supported postal code, and one transfer lane per accepted outgoing partner. This includes coverage configured before seeding, beyond the catalogue's default code. Only exact supported postal codes map to local delivery; distant postal codes route through the committed next hub. The seeder uses the existing publish-and-activate service to create immutable version 1 and activation history. When other plans exist, the new regional fixture version is published inactive for review.

On reruns, the currently active plan (including an operator-named plan) receives missing postal mappings and separate `POSTAL-<code>` lanes when destinations share a lane. Existing dedicated mappings and next-hub mappings are retained. The repair seeds an immutable successor from the selected published snapshot and validates/activates it through the existing activation service; it never rewrites historical versions, scans, or committed routes. An unfinished operator draft stays exactly as written while the active version gains coverage; a clean working copy follows the successor. Repeating the seeder after repair adds no further versions or lanes. Inactive coverage and other hubs' coverage are excluded. Suspended accounts, scheduled activations, unavailable physical lanes/connections, and archived/inactive plans remain preserved; blocked repairs print a review warning and roll back their changes.

## Rates and checkout

New published PHP rate cards cover all 14 currently active Shop Categories for first mile, linehaul, and last mile. Service prices are per Parcel/service leg, not a vehicle hire or a per-kilometer fare:

| Charge | Included billable weight | Base fee | Extra per 500 g above 1 kg |
| --- | --- | ---: | ---: |
| First mile | 1 kg | ₱35 | ₱5 |
| Each linehaul hop | 1 kg | ₱15 | ₱2.50 |
| Last mile | 1 kg | ₱45 | ₱5 |

New fixture parcel limits are 20 kg and 1,000 mm per dimension; existing platform limits still apply, as does volumetric weight. At 1 kg, local delivery costs ₱80; one-hop delivery ₱95; three-hop delivery ₱125. Tests exercise all regional pairs and bound the fixture's chosen routes at ₱245 before existing Admin surcharges. Extra weight applies independently to each evidenced leg. This is a modest consolidated development tariff, not a retail carrier quote or cost guarantee. [GoGo Xpress advertises pouch prices starting at ₱80 for up to 3 kg](https://www.gogoxpress.com/); its [fuel-surcharge advisory](https://www.gogoxpress.com/news/advisory-temporary-fuel-surcharge/) means live prices depend on the current service/calculator. Aisley uses a different allowance and deliberately does not copy those terms.

Existing platform tariff and regional surcharges are retained. If no tariff history exists, an active Admin allows the fixture to create an initial published measurement policy with zero surcharges; without an Admin it warns instead. Each regional participant receives a missing tariff acceptance; revoked acceptances stay revoked. Existing organization rate-card history is never overwritten. A new Shop Category added later requires normal operator rate publication; reseeding does not rewrite published cards.

After provisioning the network, `InitialSellerLogisticsSeeder` explicitly selects only the NCR regional provider for the configured initial Seller-owned `aisley-demo-store` and disables its other existing provider links, advancing changed configuration revisions. This requested fixture exception leaves unrelated Shops unchanged. Missing/inactive NCR fixtures and production environments preserve existing selections. Missing NCR coverage for default initial Seller/Customer shipping postal codes is added without rewriting addresses or historical sorting plans; disabled coverage is preserved. See [voucher and provider fixture commands](features/shared/voucher-authoring/seeding.md). Existing routing/Linehaul feature flags are not re-enabled. Policy consent, a complete Seller pickup address, compatible rates, active coverage/lanes, and enabled provider/Linehaul settings still govern normal checkout and dispatch.

## Fleet and Couriers

Each hub gets two Logistics-owned company trucks: an Isuzu NPR closed van with 250-parcel fixture capacity and a Hino 300 closed van with 500-parcel fixture capacity. These are application parcel-count limits, not manufacturer payload guarantees. Trucks start available at their home hub; reruns preserve capacity, location, availability and activation changes. Plates are synthetic `PHL-NN-01/02` fixtures. No trip, manifest, parcel, or receipt is fabricated.

There are five Couriers per hub (90 total), each with exactly one personal vehicle. New Courier suffixes `.01` and `.02` have approved affiliations with `can_drive_company_truck=true` (36 new-fixture drivers). The flag qualifies the person to drive the organization's company truck; their personal motorcycle is not a company truck. Existing Luzon approvals/capabilities remain unchanged: older fixtures initially have only `.01` qualified. Courier online state is never fabricated; sign in and become available through the existing mobile workflow before assigning a trip.

## Accounts and initial passwords

All Logistics accounts below initially use **`logistics123`**. All listed Couriers initially use **`courier123`**. Passwords are hashed by the User model and are preserved on rerun; an account whose password has been changed no longer uses the initial password. These credentials are for local development only.

| Region | Logistics account | Courier accounts (all use `courier123`) |
| --- | --- | --- |
| ncr | `logistics.luzon01@example.com` | `courier.luzon01.01@example.com`<br>`courier.luzon01.02@example.com`<br>`courier.luzon01.03@example.com`<br>`courier.luzon01.04@example.com`<br>`courier.luzon01.05@example.com` |
| car | `logistics.luzon02@example.com` | `courier.luzon02.01@example.com`<br>`courier.luzon02.02@example.com`<br>`courier.luzon02.03@example.com`<br>`courier.luzon02.04@example.com`<br>`courier.luzon02.05@example.com` |
| region-1 | `logistics.luzon03@example.com` | `courier.luzon03.01@example.com`<br>`courier.luzon03.02@example.com`<br>`courier.luzon03.03@example.com`<br>`courier.luzon03.04@example.com`<br>`courier.luzon03.05@example.com` |
| region-2 | `logistics.luzon04@example.com` | `courier.luzon04.01@example.com`<br>`courier.luzon04.02@example.com`<br>`courier.luzon04.03@example.com`<br>`courier.luzon04.04@example.com`<br>`courier.luzon04.05@example.com` |
| region-3 | `logistics.luzon05@example.com` | `courier.luzon05.01@example.com`<br>`courier.luzon05.02@example.com`<br>`courier.luzon05.03@example.com`<br>`courier.luzon05.04@example.com`<br>`courier.luzon05.05@example.com` |
| region-4a | `logistics.luzon06@example.com` | `courier.luzon06.01@example.com`<br>`courier.luzon06.02@example.com`<br>`courier.luzon06.03@example.com`<br>`courier.luzon06.04@example.com`<br>`courier.luzon06.05@example.com` |
| region-4b | `logistics.luzon07@example.com` | `courier.luzon07.01@example.com`<br>`courier.luzon07.02@example.com`<br>`courier.luzon07.03@example.com`<br>`courier.luzon07.04@example.com`<br>`courier.luzon07.05@example.com` |
| region-5 | `logistics.luzon08@example.com` | `courier.luzon08.01@example.com`<br>`courier.luzon08.02@example.com`<br>`courier.luzon08.03@example.com`<br>`courier.luzon08.04@example.com`<br>`courier.luzon08.05@example.com` |
| region-6 | `logistics.region-6@example.com` | `courier.region-6.01@example.com`<br>`courier.region-6.02@example.com`<br>`courier.region-6.03@example.com`<br>`courier.region-6.04@example.com`<br>`courier.region-6.05@example.com` |
| nir | `logistics.nir@example.com` | `courier.nir.01@example.com`<br>`courier.nir.02@example.com`<br>`courier.nir.03@example.com`<br>`courier.nir.04@example.com`<br>`courier.nir.05@example.com` |
| region-7 | `logistics.region-7@example.com` | `courier.region-7.01@example.com`<br>`courier.region-7.02@example.com`<br>`courier.region-7.03@example.com`<br>`courier.region-7.04@example.com`<br>`courier.region-7.05@example.com` |
| region-8 | `logistics.region-8@example.com` | `courier.region-8.01@example.com`<br>`courier.region-8.02@example.com`<br>`courier.region-8.03@example.com`<br>`courier.region-8.04@example.com`<br>`courier.region-8.05@example.com` |
| region-9 | `logistics.region-9@example.com` | `courier.region-9.01@example.com`<br>`courier.region-9.02@example.com`<br>`courier.region-9.03@example.com`<br>`courier.region-9.04@example.com`<br>`courier.region-9.05@example.com` |
| region-10 | `logistics.region-10@example.com` | `courier.region-10.01@example.com`<br>`courier.region-10.02@example.com`<br>`courier.region-10.03@example.com`<br>`courier.region-10.04@example.com`<br>`courier.region-10.05@example.com` |
| region-11 | `logistics.region-11@example.com` | `courier.region-11.01@example.com`<br>`courier.region-11.02@example.com`<br>`courier.region-11.03@example.com`<br>`courier.region-11.04@example.com`<br>`courier.region-11.05@example.com` |
| region-12 | `logistics.region-12@example.com` | `courier.region-12.01@example.com`<br>`courier.region-12.02@example.com`<br>`courier.region-12.03@example.com`<br>`courier.region-12.04@example.com`<br>`courier.region-12.05@example.com` |
| region-13 | `logistics.region-13@example.com` | `courier.region-13.01@example.com`<br>`courier.region-13.02@example.com`<br>`courier.region-13.03@example.com`<br>`courier.region-13.04@example.com`<br>`courier.region-13.05@example.com` |
| barmm | `logistics.barmm@example.com` | `courier.barmm.01@example.com`<br>`courier.barmm.02@example.com`<br>`courier.barmm.03@example.com`<br>`courier.barmm.04@example.com`<br>`courier.barmm.05@example.com` |
