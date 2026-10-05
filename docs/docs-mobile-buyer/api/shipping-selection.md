# Per-Shop shipping selection — current platform contract

Inspected 2026-10-04 at Laravel `22b0a48f9575ead182d03c35ab87345711c23b90`.
The external Buyer reports adoption of `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`.
This newer contract is **not established as adopted by that client** (G25).
Imported Phase 3 fixtures/tests do not verify these fields or provider UI.

## Options, quote and placement

`POST /api/v1/customer/checkout/logistics-options` (`op-096`) requires Sanctum,
active Customer, required consent and the normal checkout throttle. It uses
`CheckoutQuoteRequest`: `mode:cart|buy_now`, exactly owned `cart_item_ids` or
`buy_now:{product_id,variant_id:null|UUID,quantity}`, owned shipping `address_id`,
`payment_method:cod`, optional `vouchers` (max 20) and optional
`logistics_selections` (max 50). Request keys are snake_case. Responses are
`200 {data:{address:QuoteAddress,groups:[{shop:{id,name},options:[{organizationId,
businessName,shippingFee,routeStatus}]}]}}`, private/no-store.

Options calculation validates address, catalog and available inventory but creates
no quote, reservation, redemption or Order. Selection/voucher entries are checked
structurally by the Request; the options-only service branch does not apply them
or validate foreign-Shop selection semantics. Omit selections when discovering
options. Repeat reads with bounded backoff and session/query guards; no UUID key
is required. An empty `options` list is successful discovery, not quote eligibility.

For quote/place, send `logistics_selections:[{shop_id,logistics_organization_id}]`.
Each UUID Shop must belong to the intent and appear once (`distinct:strict`). One
provider may serve multiple Shops. Never send provider names, fees, totals, owner
or status as authority. Show each returned provider name and final fee; Customers
do not calculate routes, choose Couriers or receive private tariff components.

- No explicit selection and exactly one option: server uses it.
- No explicit selection and multiple options: `409 LOGISTICS_SELECTION_REQUIRED`.
- No explicit selection and zero options: `409 SHIPPING_COVERAGE_UNAVAILABLE`.
- Foreign Shop or provider disabled/not enabled for that Shop:
  `422 LOGISTICS_SELECTION_INVALID`, field `logistics_selections`.
- Enabled provider with inactive account/missing hub address:
  `409 LOGISTICS_PROVIDER_UNAVAILABLE`.

Changing address, items, vouchers **or selections** needs a new quote and review.
Normalization lowercases UUIDs, sorts selections by Shop, and includes them in the
request and placement hashes. Omitted and empty selections normalize to `[]`;
adding an explicit selection after an implicit quote changes intent even if it
names the same provider (`QUOTE_INPUT_CHANGED`). A changed payload under an
existing placement key yields `IDEMPOTENCY_KEY_REUSED`. Same key and frozen payload
return the original Batch before recalculation; never replace an uncertain intent
with a new key. Existing expiry, stale-state, atomicity and consent rules remain.

## Eligibility and pricing failures

Options are Seller-enabled providers ordered by business name whose account is
active, sole hub has an address and shipping quotation succeeds. Quotation requires
Seller default pickup address, active effective published platform tariff, the
provider's unrevoked acceptance, and valid Product/variant parcel measurements.
The options service catches `CheckoutException` and omits failed candidates; empty
discovery does not expose each candidate's rejection code.

Explicit quote errors include `PICKUP_ADDRESS_REQUIRED`,
`SHIPPING_RATE_UNAVAILABLE`, `LOGISTICS_RATE_NOT_ACCEPTED`, `SHIPPING_DATA_REQUIRED`,
`SHIPPING_DIMENSIONS_UNSUPPORTED`, `SHIPPING_WEIGHT_UNSUPPORTED` and
`ROUTE_RATE_LIMIT_EXCEEDED` (409). Exact fields/codes are in [errors](errors.md).
Parcel limits from a route participant fail quotation. Other missing route
participant tariff/rate-card/service/category charges become `unplanned`; all leg
charges are discarded and the destination region surcharge remains. Routing
disabled, uncovered postal code, incomplete sort plans or metric failure can also
produce a successful `unplanned` quote. Do not translate it to a promised route,
ETA or provider replacement. Seller pickup can then be held for unavailable frozen
routes; the committed Customer price stays unchanged.

## Wire projections and fulfillment

Quote `shippingQuote` is required: `{serviceable:true,logisticsOrganizationId:UUID,
logisticsBusinessName:string,routeStatus:local|planned|unplanned,shippingFee:money}`.
`money` is an exact decimal string. `serviceable:true` means successful commercial
quotation; it does not prove physical routing readiness.

Batch Order `shippingQuote` is nullable when there is no pricing snapshot; otherwise
`{logisticsOrganizationId:UUID?,logisticsBusinessName:string?,routeStatus:string,
shippingFee:money}`. Provider fields tolerate legacy nulls. Order list/detail and
mutation projections include required nullable
`shippingProvider:{id:UUID,businessName:string}|null`. Null is an absent legacy
provider, never permission to invent one. Unknown route values disable unsupported
presentation. Old rate-version/weight/component/count keys are no longer returned
in Customer shipping projections.

Placement stores the selected provider on each Shop Order and pricing snapshot.
Seller enables allowed providers and requests pickup using the frozen selection;
`CHECKOUT_LOGISTICS_MISMATCH` rejects substitution on snapshot-backed Orders.
Unavailable selected provider/route holds fulfillment rather than repricing COD.
Courier authorization still comes from its offered/accepted task and organization;
these Customer endpoints grant no Courier task, evidence or cash permissions.

Use [typed models](field-index.md), [operations](operations.md), and
[synthetic scenarios](examples/shipping-selection-scenarios.json).
The [inspection record](../references/current-source-inspection.json) hashes the
source and test definitions. Those application tests were inspected, not executed.
