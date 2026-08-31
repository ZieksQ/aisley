<?php

namespace Tests\Feature\Seller;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SellerRegistrationAddressOptionsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('cache.default', 'array');
        config()->set('addresses.path', base_path('addresses'));
        Cache::clear();
        Http::fake();
    }

    public function test_guests_can_load_regions_from_the_bundled_address_index_without_network_requests(): void
    {
        $this->getJson('/api/v1/seller/auth/address-options/regions')
            ->assertOk()
            ->assertJsonCount(18, 'options')
            ->assertJsonFragment(['code' => '0400000000', 'name' => 'Region IV-A (CALABARZON)'])
            ->assertJsonFragment(['code' => '1300000000', 'name' => 'National Capital Region (NCR)']);

        Http::assertNothingSent();
    }

    public function test_province_municipality_and_barangay_options_follow_the_local_hierarchy(): void
    {
        $this->getJson('/api/v1/seller/auth/address-options/provinces?reg=0400000000')
            ->assertOk()
            ->assertJsonFragment(['code' => '0402100000', 'name' => 'Cavite']);

        $this->getJson('/api/v1/seller/auth/address-options/municipalities?reg=0400000000&prv=0402100000')
            ->assertOk()
            ->assertJsonFragment(['code' => '0402103000', 'name' => 'City of Bacoor']);

        $this->getJson('/api/v1/seller/auth/address-options/barangays?reg=0400000000&prv=0402100000&mun=0402103000')
            ->assertOk()
            ->assertJsonFragment(['code' => '0402103014', 'name' => 'Molino I']);

        Http::assertNothingSent();
    }

    public function test_independent_cities_and_nested_sub_municipalities_remain_usable(): void
    {
        $this->getJson('/api/v1/seller/auth/address-options/provinces?reg=1300000000')
            ->assertOk()
            ->assertJsonCount(0, 'options');

        $this->getJson('/api/v1/seller/auth/address-options/municipalities?reg=1300000000')
            ->assertOk()
            ->assertJsonFragment(['code' => '1380600000', 'name' => 'City of Manila']);

        $this->getJson('/api/v1/seller/auth/address-options/barangays?reg=1300000000&mun=1380600000')
            ->assertOk()
            ->assertJsonFragment(['code' => '1380601001', 'name' => 'Barangay 1']);
    }

    public function test_invalid_filters_or_unavailable_local_data_fail_safely(): void
    {
        $this->getJson('/api/v1/seller/auth/address-options/provinces?reg=invalid')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reg');

        $this->getJson('/api/v1/seller/auth/address-options/municipalities?reg=0400000000&prv=1300000000')
            ->assertStatus(503)
            ->assertJsonPath('code', 'ADDRESS_DATA_UNAVAILABLE');

        config()->set('addresses.path', base_path('addresses-not-present'));

        $this->getJson('/api/v1/seller/auth/address-options/regions')
            ->assertStatus(503)
            ->assertJsonPath('code', 'ADDRESS_DATA_UNAVAILABLE');
    }
}
