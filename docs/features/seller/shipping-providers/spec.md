# Seller shipping providers

## WHAT

- Let an approved Seller control which active Logistics organizations Customers may select for the Seller's Shop.
- Keep this configuration Shop-scoped and separate from pickup execution, route planning, and Logistics pricing.
- Expose API contracts now; Seller dashboard UI is a later task.

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

## HOW

- Persist settings in `shop_logistics_providers`.
- Use `GET /api/v1/seller/shipping-providers` for the configuration list.
- Use `PUT /api/v1/seller/shipping-providers/{organization}` with `is_enabled` and optional `expected_revision`.
- Keep `GET /api/v1/seller/logistics-options` for legacy operational ranking; it is not the checkout allow-list authority.
- Enforce the selected organization again in `RequestSellerPickup` before creating pickup requests and waybills.
- Test tenant isolation, inactive organizations, enable/disable behavior, revision conflicts, checkout enforcement, and mixed-provider bulk pickup rejection.
