<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Permission;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SellerComplianceOptionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_options_require_compliance_permission(): void
    {
        $url = '/api/v1/admin/seller-compliance/options';
        $this->getJson($url)->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => UserRole::Seller]))->getJson($url)->assertForbidden();
        $this->actingAs(User::factory()->create(['role' => UserRole::Admin]))->getJson($url)->assertForbidden();
    }

    public function test_picker_exposes_only_safe_profile_fields_and_scoped_products(): void
    {
        $this->seed(ProductSeeder::class);
        $product = Product::query()->where('slug', 'studio-wireless-headphones')->firstOrFail();
        $seller = $product->shop->seller;
        $url = '/api/v1/admin/seller-compliance/options?seller_search='.urlencode($seller->shop->name).'&seller_id='.$seller->id;
        $admin = $this->admin();
        $response = $this->actingAs($admin)->getJson($url)->assertOk()
            ->assertJsonPath('data.sellers.0.id', $seller->id)
            ->assertJsonPath('data.sellers.0.contact_number', $seller->sellerProfile->contact_number)
            ->assertJsonPath('data.sellers.0.shop_status', $seller->shop->status->value)
            ->assertJsonPath('data.sellers.0.joined_at', $seller->created_at->toIso8601String());
        $this->assertEqualsCanonicalizing([
            'id', 'name', 'email', 'status', 'shop_name', 'contact_number', 'shop_status', 'joined_at',
        ], array_keys($response->json('data.sellers.0')));
        $this->assertNotEmpty($response->json('data.products'));
        foreach ($response->json('data.products') as $option) {
            $this->assertSame($seller->shop->id, Product::findOrFail($option['id'])->shop_id);
        }
        $this->assertSame(['seller_compliance.manage'], $admin->permissions()->pluck('slug')->all());
    }

    public function test_seller_search_is_paginated_and_handles_absent_profiles_and_shops(): void
    {
        $sellers = collect(range(1, 23))->map(fn ($number) => User::factory()->create([
            'role' => UserRole::Seller, 'email' => "picker-{$number}@example.test",
        ]));
        $admin = $this->admin();
        $url = '/api/v1/admin/seller-compliance/options?seller_search=picker-';
        $first = $this->actingAs($admin)->getJson($url)->assertOk()->assertJsonCount(20, 'data.sellers')
            ->assertJsonPath('data.sellers_meta.total', 23)->assertJsonPath('data.sellers_meta.last_page', 2)
            ->assertJsonPath('data.sellers.0.shop_name', null)->assertJsonPath('data.sellers.0.contact_number', null)
            ->assertJsonPath('data.sellers.0.shop_status', null);
        $second = $this->getJson($url.'&seller_page=2')->assertOk()->assertJsonCount(3, 'data.sellers')
            ->assertJsonPath('data.sellers_meta.current_page', 2);
        $ids = array_merge(array_column($first->json('data.sellers'), 'id'), array_column($second->json('data.sellers'), 'id'));
        $this->assertEqualsCanonicalizing($sellers->pluck('id')->all(), $ids);
        $this->getJson($url.'&seller_page=3')->assertOk()->assertJsonCount(0, 'data.sellers');
        $this->getJson('/api/v1/admin/seller-compliance/options?seller_search=missing')->assertOk()
            ->assertJsonCount(0, 'data.sellers')->assertJsonPath('data.sellers_meta.total', 0);
        $this->getJson('/api/v1/admin/seller-compliance/options?seller_id='.$sellers->first()->id)
            ->assertOk()->assertJsonCount(0, 'data.products');
    }

    public function test_options_validate_pagination_and_search(): void
    {
        $this->actingAs($this->admin())->getJson('/api/v1/admin/seller-compliance/options?seller_page=0')
            ->assertUnprocessable()->assertJsonValidationErrors('seller_page');
        $this->getJson('/api/v1/admin/seller-compliance/options?seller_search='.str_repeat('s', 121))
            ->assertUnprocessable()->assertJsonValidationErrors('seller_search');
        $this->getJson('/api/v1/admin/seller-compliance/options?seller_id=invalid')
            ->assertUnprocessable()->assertJsonValidationErrors('seller_id');
        $customer = User::factory()->create(['role' => UserRole::Customer]);
        $this->getJson('/api/v1/admin/seller-compliance/options?seller_id='.$customer->id)->assertNotFound();
    }

    private function admin(): User
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $permission = Permission::firstOrCreate(['slug' => 'seller_compliance.manage'], ['name' => 'Manage Seller compliance']);
        $admin->permissions()->attach($permission);

        return $admin;
    }
}
