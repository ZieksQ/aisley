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
- Show enabled providers for this Shop in a semantic selected-provider table with business name, hub identity, and available location/distance evidence. Provide an accessible “Add shipping provider” modal for available providers, with explicit Add and icon-only red/rose Remove actions. Removing requires a destructive confirmation and disables the provider for new checkout choices through the existing revisioned update; placed Orders retain their frozen selection. Distinguish loading, known-empty, failed, saved, and conflict/recovery states in both themes and supported widths.
- Merge the configuration list with read-only location ranking from `GET /api/v1/seller/logistics-options` and the Shop's default pickup-address data. Promote a provider to “Recommended” only when both nonempty normalized pickup city and region exactly match the provider hub's city and region. Keep the remaining location ranking order from the read-only ranking API, including province and authoritative road distance where available. Recommendation text is advisory; it never enables a provider or promises coverage, checkout availability, or price.
- Keep provider configuration usable when location ranking or pickup-address reads fail. Distinguish a failed read from a known missing/incomplete default pickup address; explain what data is unavailable and how to restore recommendations. Never fabricate a distance or infer an address from another source.

## HOW

- Persist settings in `shop_logistics_providers`.
- Use `GET /api/v1/seller/shipping-providers` for the configuration list.
- Use `PUT /api/v1/seller/shipping-providers/{organization}` with `is_enabled` and optional `expected_revision`.
- Keep `GET /api/v1/seller/logistics-options` for legacy operational ranking; it is not the checkout allow-list authority.
- The Seller page may merge the two reads by organization ID for presentation. Only `shipping-providers` and its revisioned update endpoint own the Customer checkout allow-list.
- The selected table contains the Shop's currently enabled provider configurations. The add modal lists available, not-yet-enabled organizations; a Seller's explicit Add action enables that organization, while confirmed Remove disables it. Both mutations use the current configuration revision and are owned by the authenticated Shop.
- Enforce the selected organization again in `RequestSellerPickup` before creating pickup requests and waybills.
- Test tenant isolation, inactive organizations, enable/disable behavior, revision conflicts, checkout enforcement, and mixed-provider bulk pickup rejection.

### UI references

- [Shopify shipping zones and rates](https://help.shopify.com/en/manual/shipping/setting-up-shipping-zones) — keeps shipping configuration in a dedicated settings area and explains that weight, dimensions, origin, and destination affect carrier rates.
- [Shippo carrier account settings](https://support.goshippo.com/hc/en-us/articles/360024209911-How-to-Connect-Your-Own-Carrier-Account) — uses a direct carrier list with an active control instead of a decorative dashboard composition.


### Pricing ownership revision — 2026-10-03

Logistics now owns service base fees and one main Shop Category weight/size extra per Parcel/service leg; Admin owns only destination surcharges. Seller provider configuration and frozen pickup selection keep the same contracts. No Seller fee editor is required; verify checkout options and existing provider/Order-preparation enforcement against the revised pricing API.


### Initial development Seller — 2026-10-11

The regional fixture seeder runs `InitialSellerLogisticsSeeder` after provisioning the network. It explicitly enables only the regional NCR organization for the configured initial Seller's `aisley-demo-store`, disables that Shop's other existing providers and advances only changed configuration revisions. This fixture exception preserves unrelated Shops, production data and placed Order snapshots; normal Seller settings remain authoritative outside an explicit fixture rerun. Missing/inactive NCR fixtures leave the previous selection intact. See [fixture setup](../../shared/voucher-authoring/seeding.md).
