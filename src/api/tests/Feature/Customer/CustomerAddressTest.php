<?php

namespace Tests\Feature\Customer;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerAddressTest extends TestCase
{
    use RefreshDatabase;

    public function test_address_endpoints_require_an_active_customer(): void
    {
        $this->getJson('/api/v1/customer/addresses')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]));

        $this->getJson('/api/v1/customer/addresses')->assertForbidden();
    }

    public function test_customer_can_create_and_list_only_owned_delivery_addresses(): void
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $other = User::factory()->create();
        $other->addresses()->create($this->addressPayload(['label' => 'Other']));
        Sanctum::actingAs($customer);

        $created = $this->postJson('/api/v1/customer/addresses', $this->addressPayload([
            'latitude' => 14.5547290,
            'longitude' => 121.0244452,
            'is_default' => true,
        ]))
            ->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.label', 'Home')
            ->assertJsonPath('data.type', 'shipping')
            ->assertJsonPath('data.latitude', '14.5547290')
            ->assertJsonPath('data.isDefault', true)
            ->json('data');

        $this->getJson('/api/v1/customer/addresses')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $created['id']);

        $this->assertDatabaseHas('addresses', [
            'id' => $created['id'],
            'user_id' => $customer->id,
            'barangay' => 'San Antonio',
        ]);
    }

    public function test_address_creation_rejects_owner_forgery_and_invalid_coordinates(): void
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        Sanctum::actingAs($customer);

        $this->postJson('/api/v1/customer/addresses', $this->addressPayload([
            'user_id' => User::factory()->create()->id,
            'latitude' => 14.5,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['user_id', 'longitude']);
    }

    public function test_setting_a_new_shipping_default_clears_the_previous_shipping_default(): void
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $previous = $customer->addresses()->create($this->addressPayload(['is_default' => true]));
        Sanctum::actingAs($customer);

        $createdId = $this->postJson('/api/v1/customer/addresses', $this->addressPayload([
            'label' => 'Office',
            'type' => AddressType::Both->value,
            'is_default' => true,
        ]))->assertSuccessful()->json('data.id');

        $this->assertFalse($previous->fresh()->is_default);
        $this->assertDatabaseHas('addresses', ['id' => $createdId, 'is_default' => true]);
    }

    /** @param array<string, mixed> $overrides @return array<string, mixed> */
    private function addressPayload(array $overrides = []): array
    {
        return array_merge([
            'type' => AddressType::Shipping->value,
            'label' => 'Home',
            'recipient_name' => 'Ada Buyer',
            'contact_number' => '09171234567',
            'address_line_1' => '123 Test Street',
            'address_line_2' => null,
            'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'NCR',
            'postal_code' => '1203',
            'country' => 'Philippines',
            'is_default' => false,
        ], $overrides);
    }
}
