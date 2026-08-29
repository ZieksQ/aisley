<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

class InitialSellerSeeder extends Seeder
{
    private const TEST_SELLER_EMAIL = 'catalog@aisley.test';

    private const TEST_SELLER_PASSWORD = 'Seller12345';

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        $seller = User::query()->updateOrCreate(
            [
                'email' => self::TEST_SELLER_EMAIL,
                'role' => UserRole::Seller,
            ],
            [
                'password' => self::TEST_SELLER_PASSWORD,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
            ],
        );

        $seller->sellerProfile()->updateOrCreate([], [
            'first_name' => 'Aisley',
            'last_name' => 'Catalog',
            'contact_number' => '+639171234568',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1995-01-01',
        ]);
    }
}
