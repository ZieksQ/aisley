# Development vouchers

`VoucherSeeder` publishes these PHP/COD offers through the existing authoring service, including immutable versions and create/publication actions. It runs after initial accounts, demo products and regional logistics in `DatabaseSeeder` and is disabled in production.

| Code | Issuer | Benefit | Cap | Minimum spend | Distribution |
| --- | --- | --- | --- | --- | --- |
| `AIS-DEMO-SHIP-50` | Platform | ₱50 shipping saving | Shipping fee | ₱300 | Automatic |
| `AIS-DEMO-FREE-SHIP` | Platform | 100% shipping saving | ₱100 | ₱500 | Collect |
| `AIS-DEMO-PLATFORM-10` | Platform | 10% merchandise discount | ₱200 | ₱500 | Collect |
| `AIS-DEMO-PLATFORM-15` | Platform | 15% merchandise discount | ₱500 | ₱1,500 | Automatic |
| `AIS-DEMO-SHOP-10` | Initial Shop | 10% merchandise discount | ₱150 | ₱500 | Collect at Shop |
| `AIS-DEMO-SHOP-15` | Initial Shop | 15% merchandise discount | ₱300 | ₱1,000 | Collect at Shop |

Offers start one minute before creation and end 30 days after creation, with 1,000 total redemptions and three uses per Customer. No collections or redemption history are fabricated. Savings, opposite-benefit stacking, explicit platform Shop targeting and funding follow normal Checkout rules.

Platform offers require the configured active initial Admin with `vouchers.view` and `vouchers.manage`; missing authorization warns instead of broadening permissions. Shop offers belong only to the configured initial Seller's visible `aisley-demo-store`, matching `ProductSeeder`'s existing `catalog@aisley.test` fallback when initial Seller credentials are absent. Other Shops receive no vouchers.

Run from the repository root after existing migrations and initial fixture setup:

```sh
(cd src/api && php artisan db:seed --class=VoucherSeeder)
(cd src/api && php artisan db:seed --class=InitialSellerLogisticsSeeder)
```

Stable codes make voucher reruns additive. Existing offers—including paused, ended, expired, edited or redeemed offers—and immutable history remain unchanged. A conflicting existing code is preserved. Use normal Admin/Seller duplication for a new offer after expiry; reseeding does not renew it.

`InitialSellerLogisticsSeeder` explicitly selects only the regional NCR organization (`logistics.luzon01@example.com`) for the initial development Shop and disables its other existing providers. Changed rows advance configuration revisions once; unchanged reruns do not. It preserves other Shops, missing/inactive NCR fixtures, production state, existing coverage decisions and placed Order snapshots. Regional rate seeding no longer enables all providers. The NCR hub receives missing postal coverage for the initial Seller/Customer's default NCR shipping addresses; existing postal-lane repair publishes a successor when needed without rewriting historical plans. See [regional fixtures](../../../philippines-logistics-seeding.md).

Checkout already provides **Shop and Aisley vouchers** beneath each Shop. Expand it, select an eligible voucher and review refreshed server totals. Claim-required offers link to **Collect this voucher**; collect first, then return to Checkout and select. Automatic offers still require explicit selection. No extra selector or automatic application is introduced.

Verification covers publication snapshots, issuer/Shop isolation, caps/distribution, zero fabricated claims/usage, preserved reruns/code collisions, permission/production gates, NCR-only revisioned configuration and actual seeded collection → quote → placement. Runtime/test results are in the app-wide [progress log](../../../PROGRESS.md).
