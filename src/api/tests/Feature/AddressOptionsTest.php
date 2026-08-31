<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class AddressOptionsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('cache.default', 'array');
        config()->set('addresses.path', base_path('addresses'));
        Cache::clear();
    }

    public function test_shared_psgc_options_follow_the_canonical_hierarchy(): void
    {
        $this->getJson('/api/v1/address-options/regions')
            ->assertOk()
            ->assertJsonFragment(['code' => '0400000000', 'name' => 'Region IV-A (CALABARZON)']);

        $this->getJson('/api/v1/address-options/provinces?reg=0400000000')
            ->assertOk()
            ->assertJsonFragment(['code' => '0403400000', 'name' => 'Laguna']);

        $this->getJson('/api/v1/address-options/municipalities?reg=0400000000&prv=0403400000')
            ->assertOk()
            ->assertJsonFragment(['name' => 'City of Calamba']);

        $this->getJson('/api/v1/address-options/barangays?reg=0400000000&prv=0403400000&mun=0403405000')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Canlubang']);
    }

    public function test_shared_psgc_options_validate_parent_filters(): void
    {
        $this->getJson('/api/v1/address-options/barangays?reg=invalid&mun=invalid')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reg', 'mun']);
    }
}
