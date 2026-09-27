# Route-based shipping quotation

## WHAT

- Quote one immutable shipping price for each Shop Order before placement.
- Use four layers: Admin platform base fee, Admin buyer-region surcharge, selected Logistics provider, and rate-bearing route legs.
- Let each Shop enable its accepted first-mile providers and let the Customer choose one provider per Shop Order.
- Use the chosen provider's sole hub as the route origin and the Buyer postal code to find a destination hub.
- Freeze a usable active-sort-plan route at checkout. Later tariff changes never alter Customer COD.
- Fall back to platform base plus buyer-region surcharge when no complete route can be planned; this is a commercial fallback, not a promise that routing is already resolved.

## MUST

- Admin publishes a versioned PHP tariff containing:
  - one nonnegative base shipping fee;
  - optional nonnegative surcharges keyed by normalized destination region;
  - volumetric divisor and platform parcel weight/dimension ceilings;
  - effective and published timestamps plus revision and publisher.
- Logistics must accept the exact published platform tariff before it can be selected or paid under that version.
- Logistics publishes its own versioned rate card. A rule is uniquely keyed by Product category and service type: `first_mile`, `linehaul`, or `last_mile`.
- Each Logistics rule contains base charge, included weight, incremental weight/charge, and maximum weight/dimensions.
- A Shop explicitly enables Logistics providers. Checkout rejects a provider not enabled for that Shop.
- Checkout accepts `logistics_selections[]` with one Shop and Logistics organization pair per Shop Order. When exactly one provider can quote, the API may select it for backward-compatible clients; two or more options require explicit Customer selection.
- `POST /customer/checkout/logistics-options` returns provider name, final shipping fee, and route status per Shop. It does not expose internal weights, dimensions, tariff components, route-leg charges, rate rules, or payout shares.
- Product packed weight, length, width, and height are required positive integers. Variant overrides are optional but must provide all four fields together; otherwise the Product measurements apply.
- Unit billable weight is `max(actual grams, ceil(length_mm × width_mm × height_mm / platform divisor))`.
- Multiply unit billable weight by quantity and sum all selected lines. Group route-rate calculations by Product category so multi-item checkout is deterministic.
- For each category on each route leg, compute `base charge + ceil(max(0, category billable weight - included weight) / increment) × increment charge`.
- A commercially planned route contains:
  - the selected provider's origin hub;
  - a destination hub with active postal coverage and an active standard postal-code lane;
  - only active, receiver-accepted directed connections;
  - an active standard sort-plan lane at each sending hub for its frozen next hub;
  - active organizations that accepted the platform tariff and published all required category/service rules.
- Charge first mile to the selected origin organization, each linehaul leg to the sending-hub organization, and last mile to the destination-hub organization.
- Customer shipping is `platform base + buyer-region surcharge + all quoted Logistics leg charges`.
- If no complete operational/commercial route exists, set route status `unplanned`, charge only platform base plus buyer-region surcharge, and store no invented leg charges.
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
- `ShippingQuotationService` owns measurement, tariff resolution, leg-rating, fallback, and private pricing inputs.
- `CheckoutRoutePlanner` owns route previews from active coverage, connections, metrics, and sort-plan lanes.
- `ShipmentRouteService` materializes frozen planned/local snapshots when the shared waybill is created.
- Enum-like DB values remain string columns with PHP enum casts. Schema changes use the additive `2026_09_27_000001_add_route_based_shipping_rates.php` migration.
- Verify base/region pricing, exact category matches, weight increments, complete variant overrides, multi-line aggregation, explicit selection, stale quotes, local/multi-hop routes, fallback, frozen route materialization, and hidden Customer internals.
