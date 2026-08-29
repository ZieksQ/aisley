# Seeded User Accounts

This file lists the user-role seeders currently available in the Laravel API. Buyer and Customer refer to the same `customer` role in the database.

## Role seeders

| Role | Seeder | Credentials | Result |
| --- | --- | --- | --- |
| Admin | `InitialAdminSeeder` | `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` | Creates an active Admin with registration review and audit-log permissions when both values are configured. Existing credentials, status, and profile data are not overwritten. |
| Seller | `InitialSellerSeeder` | `INITIAL_SELLER_EMAIL` and `INITIAL_SELLER_PASSWORD` | Creates an active Seller when both values are configured. The full database seeder attaches `Aisley Demo Store` and sample products to that account. Existing credentials, status, and profile data are not overwritten. |
| Buyer / Customer | `InitialCustomerSeeder` | Configured through `APPROVED_CUSTOMER_EMAIL` and `APPROVED_CUSTOMER_PASSWORD` | Creates one active Customer and profile when both values are configured. No fixed Buyer password is stored in the repository. |

Optional profile values are configured with:

- Admin: `INITIAL_ADMIN_FIRST_NAME`, `INITIAL_ADMIN_LAST_NAME`
- Seller: `INITIAL_SELLER_FIRST_NAME`, `INITIAL_SELLER_LAST_NAME`, `INITIAL_SELLER_CONTACT_NUMBER`, `INITIAL_SELLER_BIRTH_DATE`

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

`ProductSeeder` is a catalog seeder rather than a user-role seeder. When both Seller credential variables are configured, `InitialSellerSeeder` runs first and `ProductSeeder` reuses that Seller. Without them, the catalog seeder retains its inaccessible random-password fallback account for data integrity.

## Production safety

- `.env.example` intentionally leaves Admin and Seller email/password values blank.
- Store real credentials only in the deployment environment or untracked `.env`; never commit them.
- Use strong, unique production passwords and rotate the account password after bootstrap when appropriate.
- The seeders skip account creation when either required value is missing.
- Rerunning a seeder never resets the password, status, or profile of an existing same-role account.
- After changing environment values on a configuration-cached deployment, run `php artisan config:clear` or rebuild the configuration cache before seeding.
- Production seeding requires the explicit `php artisan db:seed --force` command.
