<?php

namespace Tests\Feature;

use App\Enums\AddressType;
use App\Enums\ApplicationStatus;
use App\Enums\CategoryStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Enums\VehicleStatus;
use App\Enums\VehicleType;
use App\Models\Address;
use App\Models\AdminPermission;
use App\Models\AdminProfile;
use App\Models\Category;
use App\Models\CourierProfile;
use App\Models\CustomerProfile;
use App\Models\Document;
use App\Models\Permission;
use App\Models\PersonalAccessToken;
use App\Models\RegistrationApplication;
use App\Models\SellerProfile;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class InitialDomainModelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_application_models_are_configured_for_uuid_primary_keys(): void
    {
        $models = [
            User::class,
            PersonalAccessToken::class,
            CustomerProfile::class,
            SellerProfile::class,
            CourierProfile::class,
            AdminProfile::class,
            RegistrationApplication::class,
            Document::class,
            Address::class,
            Permission::class,
            AdminPermission::class,
            Vehicle::class,
            ShopCategory::class,
            Shop::class,
            Category::class,
        ];

        foreach ($models as $modelClass) {
            /** @var Model $model */
            $model = new $modelClass;

            $this->assertSame('string', $model->getKeyType(), $modelClass);
            $this->assertFalse($model->getIncrementing(), $modelClass);
        }
    }

    public function test_user_email_is_unique_per_role_and_enum_fields_are_cast(): void
    {
        $customer = User::factory()->create([
            'email' => 'shared@example.com',
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);

        $seller = User::factory()->create([
            'email' => 'shared@example.com',
            'role' => UserRole::Seller,
        ]);

        $this->assertTrue(Str::isUuid($customer->id));
        $this->assertSame(UserRole::Customer, $customer->role);
        $this->assertSame(UserStatus::Active, $customer->status);
        $this->assertSame(UserRole::Seller, $seller->role);

        $this->expectException(QueryException::class);

        User::factory()->create([
            'email' => 'shared@example.com',
            'role' => UserRole::Customer,
        ]);
    }

    public function test_foundation_models_persist_uuid_relations_and_typed_enums(): void
    {
        $seller = User::factory()->create(['role' => UserRole::Seller]);
        $sellerProfile = SellerProfile::create([
            'user_id' => $seller->id,
            'first_name' => 'Sela',
            'last_name' => 'Mercado',
            'contact_number' => '09171234567',
            'sex' => UserSex::Female,
            'birth_date' => now()->subYears(25)->toDateString(),
        ]);
        $shopCategory = ShopCategory::create([
            'name' => 'General Merchandise',
            'slug' => 'general-merchandise',
            'status' => CategoryStatus::Active,
        ]);
        $shop = Shop::create([
            'seller_id' => $seller->id,
            'shop_category_id' => $shopCategory->id,
            'name' => 'Sela Store',
            'slug' => 'sela-store',
            'status' => ShopStatus::Active,
        ]);

        $parentCategory = Category::create([
            'name' => 'Electronics',
            'slug' => 'electronics',
            'status' => CategoryStatus::Active,
        ]);
        $childCategory = Category::create([
            'parent_id' => $parentCategory->id,
            'name' => 'Phones',
            'slug' => 'phones',
            'status' => CategoryStatus::Active,
        ]);

        $this->assertTrue(Str::isUuid($sellerProfile->id));
        $this->assertSame(UserSex::Female, $sellerProfile->sex);
        $this->assertSame(25, $sellerProfile->age);
        $this->assertTrue($seller->shop->is($shop));
        $this->assertTrue($sellerProfile->shop->is($shop));
        $this->assertTrue($shop->shopCategory->is($shopCategory));
        $this->assertTrue($childCategory->parent->is($parentCategory));
    }

    public function test_approval_documents_addresses_and_courier_vehicle_are_uuid_backed(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Pending,
        ]);
        $application = RegistrationApplication::create([
            'user_id' => $customer->id,
            'application_type' => UserRole::Customer,
            'status' => ApplicationStatus::Pending,
            'submitted_at' => now(),
        ]);
        $document = Document::create([
            'user_id' => $customer->id,
            'registration_application_id' => $application->id,
            'reviewer_id' => $admin->id,
            'type' => DocumentType::GovernmentId,
            'status' => DocumentStatus::Verified,
            'disk' => 'azure',
            'path' => 'registration/example-id.jpg',
            'original_name' => 'example-id.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1024,
            'reviewed_at' => now(),
        ]);
        $address = Address::create([
            'user_id' => $customer->id,
            'type' => AddressType::Both,
            'label' => 'Home',
            'recipient_name' => 'Casey Customer',
            'contact_number' => '09170000000',
            'address_line_1' => '1 Market Street',
            'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'NCR',
            'postal_code' => '1200',
            'is_default' => true,
        ]);

        $courier = User::factory()->create(['role' => UserRole::Courier]);
        $courierProfile = CourierProfile::create([
            'user_id' => $courier->id,
            'first_name' => 'Rida',
            'last_name' => 'Reyes',
            'contact_number' => '09179999999',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1995-01-01',
        ]);
        $vehicle = Vehicle::create([
            'courier_profile_id' => $courierProfile->id,
            'plate_number' => 'ABC-1234',
            'type' => VehicleType::Motorcycle,
            'status' => VehicleStatus::Active,
        ]);

        $this->assertTrue(Str::isUuid($application->id));
        $this->assertTrue(Str::isUuid($document->id));
        $this->assertTrue(Str::isUuid($address->id));
        $this->assertSame(DocumentType::GovernmentId, $document->type);
        $this->assertSame(DocumentStatus::Verified, $document->status);
        $this->assertSame(AddressType::Both, $address->type);
        $this->assertSame(VehicleType::Motorcycle, $vehicle->type);
        $this->assertTrue($vehicle->courierProfile->is($courierProfile));
        $this->assertTrue($courierProfile->vehicles->first()->is($vehicle));
    }

    public function test_sanctum_tokens_and_admin_permission_pivots_generate_uuid_ids(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $permission = Permission::create([
            'name' => 'Manage users',
            'slug' => 'users.manage',
        ]);

        $admin->permissions()->attach($permission->id, ['granted_by' => $admin->id]);
        $token = $admin->createToken('test-device');

        $pivot = AdminPermission::query()->firstOrFail();
        $storedToken = PersonalAccessToken::findToken($token->plainTextToken);

        $this->assertTrue(Str::isUuid($pivot->id));
        $this->assertTrue(Str::isUuid($storedToken->id));
        $this->assertSame($admin->id, $storedToken->tokenable_id);
        $this->assertTrue($admin->permissions->first()->is($permission));
    }
}
