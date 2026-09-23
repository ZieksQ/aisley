# Shipping quotation

## WHAT

- Quote one immutable, zone-based shipping price for each Shop Order before the Customer places checkout.
- Calculate billable weight per unit as the greater of actual and volumetric weight, then sum quantity.
- Require a published Admin rate and at least one active Logistics organization that accepted that exact version.
- Keep fulfillment routing separate from Customer pricing. Rerouting and later tariff changes never increase COD.

## MUST

- Match origin and destination PSGC fields from most specific to least specific: barangay, city/municipality, province, region, then country.
- A published version stores PHP integer centavos, actual-weight increment grams, volumetric divisor, supported dimensions, included weight, and an explicit destination surcharge.
- Product or Variant shipping dimensions and weight are required for a purchasable line. Variant values override Product values as a complete set.
- Compute `base + ceil(max(0, billable-included)/increment) * increment_price + surcharge`.
- Return rate version, billable weight, price breakdown, eligible Logistics organizations, and serviceability in the checkout quote.
- Recompute all inputs at placement. Any changed address, item, dimension, rate state, acceptance, or coverage makes the quote stale.
- Store the resolved geographic inputs, line measurements, formula inputs, eligible organizations, and rate version in `order_pricing_snapshots`.
- Missing dimensions, rates, acceptance, or coverage block only the affected Shop group and prevent placing the checkout.
- Seller pickup choices are limited to organizations in the saved snapshot that still honor the version. If none remains, place fulfillment on a financial/fulfillment hold without repricing.
- Do not seed sample rates as live tariffs.

## API

- Admin: `GET/POST /api/v1/admin/shipping-rates`, `POST /shipping-rates/{rate}/publish`.
- Logistics: `GET /api/v1/logistics/shipping-rates`, `POST /shipping-rates/{rate}/accept`.
- Customer checkout quote groups expose `shippingQuote`; placed orders expose the immutable shipping snapshot.

## Verification

- Cover geographic precedence, volumetric weight, increment rounding, dimension limits, acceptance, coverage, stale quotes, multi-Shop totals, and locked COD after later routing/rate changes.
