# Seller shipping providers

## WHAT

- Let an approved Seller control which active Logistics organizations Customers may select for the Seller's Shop.
- Keep this configuration Shop-scoped and separate from pickup execution, route planning, and Logistics pricing.
- Provide a dedicated Seller dashboard page at `/shipping-providers`; do not put this configuration inside Order preparation.

## MUST

- Require authenticated, active, approved Seller access.
- Derive the Shop from the authenticated Seller and never accept a client-supplied Shop owner.
- List only active Logistics organizations with an operational hub.
- Return organization ID, business name, hub summary, enabled state, and configuration revision.
- Default an unconfigured provider to disabled.
- Enable or disable one provider with optimistic revision checking.
- Store the configuring Seller, timestamps, and monotonically increasing revision.
- A provider setting is unique for one Shop and Logistics organization.
- Checkout may quote or accept only an enabled provider for that Shop.
- Disabling a provider blocks new quotes but does not rewrite placed Order pricing or provider selection.
- A placed Order must be picked up by its checkout-selected provider. Bulk pickup requires every selected Order to have that same provider.
- A provider becoming inactive or a frozen route becoming unusable creates a hold; it never reprices the Customer.
- Show provider business name and hub identity in a compact settings list with an accessible native switch, loading/empty/error/success states, and light/dark responsive behavior.
- Merge the configuration list with the read-only location ranking from `GET /api/v1/seller/logistics-options`. Sort exact city, province, and region matches before other domestic hubs, then use authoritative road distance where available. Recommendation text is advisory and never changes enablement automatically.
- If ranking is unavailable because the Seller has no complete pickup address, keep configuration usable and explain how to enable location recommendations. Never fabricate a distance.

## HOW

- Persist settings in `shop_logistics_providers`.
- Use `GET /api/v1/seller/shipping-providers` for the configuration list.
- Use `PUT /api/v1/seller/shipping-providers/{organization}` with `is_enabled` and optional `expected_revision`.
- Keep `GET /api/v1/seller/logistics-options` for legacy operational ranking; it is not the checkout allow-list authority.
- The Seller page may merge the two reads by organization ID for presentation. Only `shipping-providers` and its revisioned update endpoint own the Customer checkout allow-list.
- Enforce the selected organization again in `RequestSellerPickup` before creating pickup requests and waybills.
- Test tenant isolation, inactive organizations, enable/disable behavior, revision conflicts, checkout enforcement, and mixed-provider bulk pickup rejection.

### UI references

- [Shopify shipping zones and rates](https://help.shopify.com/en/manual/shipping/setting-up-shipping-zones) — keeps shipping configuration in a dedicated settings area and explains that weight, dimensions, origin, and destination affect carrier rates.
- [Shippo carrier account settings](https://support.goshippo.com/hc/en-us/articles/360024209911-How-to-Connect-Your-Own-Carrier-Account) — uses a direct carrier list with an active control instead of a decorative dashboard composition.
