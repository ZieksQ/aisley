<?php

namespace Tests\Feature\Seller;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SellerPickupAddressTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_seller_can_manage_only_owned_pickup_addresses_with_one_default(): void
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $other = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);

        $firstId = $this->actingAs($seller)->postJson('/api/v1/seller/pickup-addresses', $this->payload(['label' => 'Main shop']))
            ->assertCreated()->assertJsonPath('data.is_default', true)->json('data.id');
        $secondId = $this->postJson('/api/v1/seller/pickup-addresses', $this->payload(['label' => 'Warehouse', 'is_default' => true]))
            ->assertCreated()->assertJsonPath('data.is_default', true)->json('data.id');

        $this->assertDatabaseHas('addresses', ['id' => $firstId, 'user_id' => $seller->id, 'type' => AddressType::Both->value, 'is_default' => false]);
        $this->assertDatabaseHas('addresses', ['id' => $secondId, 'user_id' => $seller->id, 'is_default' => true]);
        $this->getJson('/api/v1/seller/pickup-addresses')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.id', $secondId);

        $foreignId = $other->addresses()->create(['type' => AddressType::Both, ...$this->payload(['is_default' => true])])->id;
        $this->patchJson("/api/v1/seller/pickup-addresses/{$foreignId}", $this->payload())->assertNotFound();
        $this->deleteJson("/api/v1/seller/pickup-addresses/{$foreignId}")->assertNotFound();

        $this->deleteJson("/api/v1/seller/pickup-addresses/{$secondId}")->assertNoContent();
        $this->assertDatabaseHas('addresses', ['id' => $firstId, 'is_default' => true]);
    }

    public function test_pickup_address_endpoints_require_an_active_seller_and_reject_owner_fields(): void
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);

        $this->getJson('/api/v1/seller/pickup-addresses')->assertUnauthorized();
        $this->actingAs($customer)->getJson('/api/v1/seller/pickup-addresses')->assertForbidden();
        $this->actingAs(User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]))
            ->postJson('/api/v1/seller/pickup-addresses', $this->payload(['user_id' => $customer->id, 'type' => 'shipping']))
            ->assertUnprocessable()->assertJsonValidationErrors(['user_id', 'type']);
    }

    /** @param array<string, mixed> $overrides @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'label' => 'Pickup', 'recipient_name' => 'Seller Owner', 'contact_number' => '09171111111',
            'address_line_1' => '1 Seller Road', 'address_line_2' => null, 'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City', 'province' => 'Metro Manila', 'region' => 'National Capital Region',
            'postal_code' => '1200', 'country' => 'Philippines', 'latitude' => null, 'longitude' => null,
            'is_default' => false,
        ], $overrides);
    }
}
