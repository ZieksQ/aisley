# Seeded User Accounts

This file lists the user-role seeders currently available in the Laravel API. Buyer and Customer refer to the same `customer` role in the database.

## Role seeders

| Role | Seeder | Credentials | Result |
| --- | --- | --- | --- |
| Admin | `InitialAdminSeeder` | `admin@test.com` / `Admin12345` | Creates or restores an active local/testing Admin with registration review and audit-log permissions. It does not run in production. |
| Seller | `InitialSellerSeeder` | `catalog@aisley.test` / `Seller12345` | Creates or restores the active local/testing Seller used by the seeded catalog. The full database seeder subsequently attaches the `Aisley Demo Store` and sample products through `ProductSeeder`. It does not run in production. |
| Buyer / Customer | `InitialCustomerSeeder` | Configured through `APPROVED_CUSTOMER_EMAIL` and `APPROVED_CUSTOMER_PASSWORD` | Creates one active Customer and profile when both values are configured. No fixed Buyer password is stored in the repository. |

## Commands

Run every configured seeder, including the sample Seller shop and catalog:

```bash
cd src/api
php artisan db:seed
```

Run one role seeder:

```bash
php artisan db:seed --class=InitialAdminSeeder
php artisan db:seed --class=InitialSellerSeeder
php artisan db:seed --class=InitialCustomerSeeder
```

`ProductSeeder` is a catalog seeder rather than a user-role seeder. When the complete `DatabaseSeeder` runs locally, `InitialSellerSeeder` runs first so `ProductSeeder` reuses the known Seller account instead of creating its random-password fallback account.

These credentials are intended only for local development and automated testing. Never reproduce the fixed Admin or Seller accounts in production.
