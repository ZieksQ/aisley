<?php

namespace Tests\Feature\Seller;

use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\SellerProfile;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SellerAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('seller-profile-test');
        config()->set('filesystems.default', 'seller-profile-test');
    }

    public function test_only_an_active_seller_can_use_own_account_endpoints(): void
    {
        $this->getJson('/api/v1/seller/account')->assertUnauthorized();

        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($customer)->getJson('/api/v1/seller/account')->assertForbidden();

        $seller = $this->seller();
        $this->actingAs($seller)->getJson('/api/v1/seller/account')
            ->assertOk()
            ->assertJsonPath('account.id', $seller->id)
            ->assertJsonPath('account.shop.name', 'Avery Store')
            ->assertJsonMissingPath('account.password')
            ->assertJsonMissingPath('account.profile.profile_photo_path');
    }

    public function test_seller_can_update_only_their_defined_profile_and_storefront_fields(): void
    {
        $seller = $this->seller();
        $other = $this->seller('other@example.com', 'Other Store');

        $this->actingAs($seller)->patchJson('/api/v1/seller/account/profile', [
            'first_name' => 'Alex',
            'last_name' => 'Merchant',
            'middle_name' => 'Q',
            'contact_number' => '+639171111111',
            'sex' => UserSex::PreferNotToSay->value,
            'birth_date' => '1992-06-15',
        ])->assertOk()
            ->assertJsonPath('account.profile.first_name', 'Alex')
            ->assertJsonPath('seller.profile.first_name', 'Alex');

        $this->patchJson('/api/v1/seller/account/storefront', [
            'name' => 'Alex General Store',
            'description' => 'Everyday goods for local buyers.',
            'contact_email' => 'store@example.com',
            'contact_number' => '+639172222222',
            'website' => 'https://example.com',
            'is_on_vacation' => true,
            'vacation_message' => 'Orders resume next Monday.',
        ])->assertOk()
            ->assertJsonPath('account.shop.name', 'Alex General Store')
            ->assertJsonPath('account.shop.is_on_vacation', true);

        $this->assertDatabaseHas('seller_profiles', ['user_id' => $seller->id, 'first_name' => 'Alex']);
        $this->assertDatabaseHas('shops', ['seller_id' => $seller->id, 'name' => 'Alex General Store']);
        $this->assertDatabaseHas('shops', ['seller_id' => $other->id, 'name' => 'Other Store']);

        $this->patchJson('/api/v1/seller/account/storefront', [
            'name' => 'Tampered', 'is_on_vacation' => false, 'seller_id' => $other->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('seller_id');
    }

    public function test_email_and_password_updates_use_current_password_without_two_factor_authentication(): void
    {
        $seller = $this->seller();
        User::factory()->create(['email' => 'shared@example.com', 'role' => UserRole::Customer]);

        $this->actingAs($seller)->patchJson('/api/v1/seller/account/email', [
            'email' => ' SHARED@example.com ',
            'current_password' => 'CurrentSeller123',
        ])->assertOk()->assertJsonPath('account.email', 'shared@example.com');

        $this->putJson('/api/v1/seller/account/password', [
            'current_password' => 'wrong-password',
            'password' => 'UpdatedSeller456',
            'password_confirmation' => 'UpdatedSeller456',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->putJson('/api/v1/seller/account/password', [
            'current_password' => 'CurrentSeller123',
            'password' => 'UpdatedSeller456',
            'password_confirmation' => 'UpdatedSeller456',
        ])->assertOk()->assertJsonMissingPath('password');

        $this->assertTrue(Hash::check('UpdatedSeller456', $seller->fresh()->password));
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_seller_can_upload_replace_view_and_remove_a_private_profile_photo(): void
    {
        $seller = $this->seller();

        $first = $this->actingAs($seller)->post('/api/v1/seller/account/profile-photo', [
            'photo' => $this->image('avatar.png'),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertStringStartsWith('/api/v1/seller/account/profile-photo?v=', (string) $first->json('account.profile.profile_photo_url'));
        $this->assertStringNotContainsString('seller-profile-photos/', json_encode($first->json(), JSON_THROW_ON_ERROR));
        $profile = $seller->sellerProfile->fresh();
        Storage::disk('seller-profile-test')->assertExists($profile->profile_photo_path);
        $oldPath = $profile->profile_photo_path;

        $this->get('/api/v1/seller/account/profile-photo')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->post('/api/v1/seller/account/profile-photo', [
            'photo' => $this->image('replacement.png'),
        ], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('seller-profile-test')->assertMissing($oldPath);

        $this->deleteJson('/api/v1/seller/account/profile-photo')->assertOk()
            ->assertJsonPath('account.profile.profile_photo_url', null);
        $this->get('/api/v1/seller/account/profile-photo')->assertNotFound();
    }

    public function test_profile_photo_rejects_corrupt_files_and_multiple_extensions(): void
    {
        $seller = $this->seller();

        $this->actingAs($seller)->post('/api/v1/seller/account/profile-photo', [
            'photo' => UploadedFile::fake()->createWithContent('avatar.png', 'not-an-image'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/seller/account/profile-photo', [
            'photo' => $this->image('avatar.safe.png'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');
    }

    private function seller(string $email = 'seller@example.com', string $shopName = 'Avery Store'): User
    {
        $seller = User::factory()->create([
            'email' => $email,
            'password' => 'CurrentSeller123',
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);
        SellerProfile::create([
            'user_id' => $seller->id,
            'first_name' => 'Avery',
            'last_name' => 'Seller',
            'contact_number' => '+639170000000',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1990-01-01',
        ]);
        Shop::create([
            'seller_id' => $seller->id,
            'name' => $shopName,
            'slug' => str($shopName)->slug().'-'.substr($seller->id, 0, 8),
            'status' => ShopStatus::Active,
        ]);

        return $seller;
    }

    private function image(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            $name,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true),
        );
    }
}
