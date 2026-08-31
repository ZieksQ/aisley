<?php

namespace Tests\Feature\Seller;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SellerRegistrationAddressOptionsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('cache.default', 'array');
        config()->set('services.psgc.base_url', 'https://classification.example.test/psgc');
        config()->set('services.psgc.version', 'Q2_2024');
        config()->set('services.psgc.token', 'server-only-token');
        Cache::clear();
    }

    public function test_guests_can_load_normalized_region_options_without_receiving_the_psgc_token(): void
    {
        Http::fake([
            'classification.example.test/*' => Http::response([
                'results' => ['psgc_data' => [
                    ['reg' => 4, 'area_name' => 'Region IV-A'],
                    ['reg' => 1, 'area_name' => 'Ilocos Region'],
                ]],
            ]),
        ]);

        $this->getJson('/api/v1/seller/auth/address-options/regions')
            ->assertOk()
            ->assertExactJson(['options' => [
                ['code' => '1', 'name' => 'Ilocos Region'],
                ['code' => '4', 'name' => 'Region IV-A'],
            ]])
            ->assertJsonMissing(['token' => 'server-only-token']);

        Http::assertSent(fn (Request $request): bool => $request->url() === 'https://classification.example.test/psgc/Q2_2024/regions?page=1&page_size=1000&token=server-only-token');
    }

    public function test_cascading_filters_are_validated_and_forwarded_to_psgc(): void
    {
        Http::fake([
            'classification.example.test/*' => Http::response([
                'results' => ['psgc_data' => [
                    ['bgy' => 7, 'area_name' => 'Poblacion'],
                ]],
            ]),
        ]);

        $this->getJson('/api/v1/seller/auth/address-options/barangays?reg=4&prv=10&mun=2')
            ->assertOk()
            ->assertJsonPath('options.0.name', 'Poblacion');

        Http::assertSent(fn (Request $request): bool => $request['reg'] === '4'
            && $request['prv'] === '10'
            && $request['mun'] === '2'
            && $request['token'] === 'server-only-token');

        $this->getJson('/api/v1/seller/auth/address-options/provinces?reg=invalid')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reg');
    }

    public function test_missing_configuration_or_provider_failure_returns_a_safe_service_error(): void
    {
        config()->set('services.psgc.token', '');

        $this->getJson('/api/v1/seller/auth/address-options/regions')
            ->assertStatus(503)
            ->assertJsonPath('code', 'PSGC_UNAVAILABLE')
            ->assertJsonMissing(['token' => 'server-only-token']);

        config()->set('services.psgc.token', 'server-only-token');
        Http::fake(['classification.example.test/*' => Http::response([], 500)]);

        $this->getJson('/api/v1/seller/auth/address-options/municipalities?reg=13')
            ->assertStatus(503)
            ->assertJsonPath('code', 'PSGC_UNAVAILABLE');
    }
}
