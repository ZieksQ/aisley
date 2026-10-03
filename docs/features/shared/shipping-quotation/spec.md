# Route-based shipping quotation

## WHAT

- Quote one immutable shipping price for each Shop Order before placement.
- Use Logistics-owned base fees once per service leg, Admin buyer-region surcharges, and category-based weight/size charges along the selected provider’s route.
- Let each Shop enable its accepted first-mile providers and let the Customer choose one provider per Shop Order.
- Use the chosen provider's sole hub as the route origin and the Buyer postal code to find a destination hub.
- Freeze a usable active-sort-plan route at checkout. Later tariff changes never alter Customer COD.
- Fall back to buyer-region surcharge only when no complete route can be planned; this is a commercial fallback, not a promise that routing is already resolved.

## MUST

- Admin publishes a versioned PHP destination-surcharge tariff containing:
  - optional nonnegative surcharges keyed by normalized destination region;
  - read-only volumetric divisor and platform parcel weight/dimension ceilings inherited from the preceding version (initial defaults: divisor 5000, 100000g, 2000mm per dimension);
  - effective and published timestamps plus revision and publisher.
- Logistics must accept the exact published platform tariff before it can be selected or paid under that version.
- Logistics publishes its own versioned rate card. A rule is uniquely keyed by Product category and service type: `first_mile`, `linehaul`, or `last_mile`.
- Each rate card contains one `services[]` entry per offered service with `service_type` and nonnegative `base_fee_cents`. Category/service rules contain included weight, incremental weight/charge, and maximum weight/dimensions; they have no base charge.
- A Shop explicitly enables Logistics providers. Checkout rejects a provider not enabled for that Shop.
- Checkout accepts `logistics_selections[]` with one Shop and Logistics organization pair per Shop Order. When exactly one provider can quote, the API may select it for backward-compatible clients; two or more options require explicit Customer selection.
- `POST /customer/checkout/logistics-options` returns provider name, final shipping fee, and route status per Shop. It does not expose internal weights, dimensions, tariff components, route-leg charges, rate rules, or payout shares.
- Product packed weight, length, width, and height are required positive integers. Variant overrides are optional but must provide all four fields together; otherwise the Product measurements apply.
- Unit billable weight is `max(actual grams, ceil(length_mm × width_mm × height_mm / platform divisor))`.
- Multiply unit billable weight by quantity and sum all selected lines. Group route-rate calculations by Product category so multi-item checkout is deterministic.
- For each category on each route leg, compute `ceil(max(0, category billable weight - included weight) / increment) × increment charge`. Add the owning organization’s service base fee once for that leg, regardless of the number of categories. Size affects billable weight through the volumetric calculation; maximum dimensions remain eligibility limits, not a second size fee.
- A commercially planned route contains:
  - the selected provider's origin hub;
  - a destination hub with active postal coverage and an active standard postal-code lane;
  - only active, receiver-accepted directed connections;
  - an active standard sort-plan lane at each sending hub for its frozen next hub;
  - active organizations that accepted the platform tariff and published a base fee for each required service plus every required category/service rule.
- Charge first mile to the selected origin organization, each linehaul leg to the sending-hub organization, and last mile to the destination-hub organization.
- Customer shipping is `first-mile base fee + sum(linehaul base fees per hop) + last-mile base fee + buyer-region surcharge + sum(category weight/size charges per leg)`. Each full quoted leg charge is its service base plus its category extras; do not add those extras twice. A local route has first-mile and last-mile fees and no linehaul fee.
- If no complete operational/commercial route exists, set route status `unplanned`, charge only buyer-region surcharge, and store no invented leg charges.
- Recompute all inputs at placement. Changed products, measurements, tariffs, commissions, provider settings, sort-plan route, or Logistics rate cards make the quote stale.
- Store the chosen organization, addresses, line measurements, billable weights, platform tariff, route snapshot, rate card/rule IDs, per-leg quoted charges, and commission snapshots in `order_pricing_snapshots`.
- Store only the final shipping fee and other Order totals in Customer responses. Finance/Admin projections may expose internal snapshots under role authorization.
- Waybill creation materializes a planned/local route from the frozen checkout snapshot instead of predicting it again.
- If a frozen connection or participant becomes unavailable before pickup, place an operational/financial hold and keep Customer pricing unchanged.
- An `unplanned` order may be routed operationally later, but its Logistics payout remains held for Admin reconciliation.

## HOW

- Admin APIs: `GET/POST /api/v1/admin/shipping-rates` and `POST /api/v1/admin/shipping-rates/{rate}/publish`.
- Logistics platform acceptance: `GET /api/v1/logistics/shipping-rates` and `POST /api/v1/logistics/shipping-rates/{rate}/accept`.
- Logistics rate-card APIs: `GET/POST /api/v1/logistics/rate-cards` and `POST /api/v1/logistics/rate-cards/{card}/publish`.
- Seller provider APIs: `GET /api/v1/seller/shipping-providers` and `PUT /api/v1/seller/shipping-providers/{organization}`.
- Customer APIs: `POST /api/v1/customer/checkout/logistics-options`, `/checkout/quote`, and `/checkout/place`.
- `ShippingQuotationService` owns measurement, surcharge resolution, service-base/category leg-rating, fallback, and private pricing inputs.
- `CheckoutRoutePlanner` owns route previews from active coverage, connections, metrics, and sort-plan lanes.
- `ShipmentRouteService` materializes frozen planned/local snapshots when the shared waybill is created.
- Enum-like DB values remain string columns with PHP enum casts. The route baseline uses `2026_09_27_000001_add_route_based_shipping_rates.php`; service base fees and the pricing-model marker use the additive `2026_10_03_000001_add_logistics_service_base_fees.php` migration.
- Verify service-base/region pricing, one base per leg across categories, every linehaul hop, ignored legacy platform/category bases, exact category matches, weight increments, complete variant overrides, multi-line aggregation, explicit selection, stale quotes, local/multi-hop routes, fallback, frozen route materialization, and hidden Customer internals.

## Ownership and compatibility revision — 2026-10-03

- Admin `POST /shipping-rates` accepts `region_surcharges` (required array, empty clears all surcharges), `effective_at`, and optional PHP `currency`. Base-fee, weight-charge, volumetric-divisor, and parcel-ceiling inputs are prohibited. Technical measurement fields remain available as read-only outputs. Existing exact-version Logistics acceptance remains required.
- Logistics `POST /rate-cards` requires `services` alongside `rules`; all card create/index/publish responses include `services`. Each offered service must have a base fee and category rules; every rule must belong to an offered service. No per-category base is accepted or returned.
- Existing platform base columns remain stored for historical compatibility but are hidden from platform tariff API responses and ignored by new quotes. New platform tariff drafts store zero base. Existing category base columns remain untouched by migration and hidden from rule responses; new rules store zero there.
- The additive migration derives one service base per existing card/service using the highest former category base. It never adds the old platform base. The maximum preserves the largest former single-category base while preventing repeated category bases. Logistics can publish a successor card to choose different service amounts; existing cards, rules, and Orders remain intact.
- New Order snapshots store `shipping_pricing_model = logistics_service_base_v1`; pre-existing snapshots are marked `platform_base_v1`. On new snapshots, `base_fee_cents` is the sum of service bases and `additional_weight_fee_cents` is the sum of category extras. Historical field meanings and totals stay unchanged.
- Each new private leg input records `service_rate_id`, `base_fee_cents`, `additional_weight_fee_cents`, and their sum in `quoted_charge_cents`, alongside existing card/rule IDs, owner, service, and endpoints. Allocation continues to use the complete frozen leg charge; commission is applied once to the overall shipping budget. Quotes created before this pricing-model change must be refreshed before placement.
- A route with missing commercial rates or routing configuration still follows the existing `unplanned` workflow: only destination surcharge is quoted (possibly zero), all partial leg charges are discarded, and later nonzero allocation requires Finance reconciliation. Parcel limit violations still reject quotation. This fallback does not imply free quoted Logistics services.
- Admin and Logistics frontends now use the revised write contracts. Customer and Seller checkout/provider/pickup contracts remain unchanged.

### Frontend adoption — 2026-10-03

| Feature | Adopted behavior |
| --- | --- |
| Admin Pricing & fees — shipping draft/history | Removes platform base and editable parcel-policy inputs; submits regional surcharges and version metadata. The region selector, publication, acceptance count, and commission editor remain. |
| Logistics Shipping rates — tariff | Removes platform-base displays and shows destination surcharges with read-only parcel policy. Exact-version acceptance remains. The route is a dedicated sidebar destination, separate from Settings. |
| Logistics Shipping rates — rate cards and coverage | Sends one base per offered service in `services[]`; category rules contain only weight/size extras. History and coverage display service bases separately from category rules and describe one base per leg / linehaul hop. PHP/kg/cm conversion and versioning remain. |
| Admin Finance holds | Reads `pricing.pricing_model` and `additional_weight_fee_cents`; labels new aggregate bases as Logistics service bases and historical bases as platform base. Reconciliation and subsidy math are unchanged. |
| Shared Finance workspaces | The shared Finance summary package contains no Order-pricing drill-down. Admin Finance holds is the current UI exposing these snapshot components and now labels them by pricing model. |
| Customer Checkout/provider options and Order totals | Continue consuming final server fees, refreshing stale quotes, and hiding internal pricing inputs. No request/response shape or fee-breakdown UI was added. |
| Seller Shipping providers and Order preparation/pickup | Provider enablement and frozen provider enforcement remain unchanged. No fee editor or API shape was added. |

Example Logistics draft (UUID and numeric limits are illustrative):

```json
{
  "effective_at": "2026-10-03T00:00:00Z",
  "services": [{"service_type": "first_mile", "base_fee_cents": 1200}],
  "rules": [{
    "category_id": "11111111-1111-4111-8111-111111111111",
    "service_type": "first_mile",
    "included_weight_grams": 1000,
    "additional_weight_grams": 500,
    "additional_fee_cents": 250,
    "max_weight_grams": 50000,
    "max_length_mm": 2000,
    "max_width_mm": 2000,
    "max_height_mm": 2000
  }]
}
```
