<?php

namespace Tests\Feature\Finance;

use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Permission;
use App\Models\Shop;
use App\Models\User;
use Database\Seeders\AdminPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinanceAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_finance_requires_explicit_permission(): void
    {
        $this->seed(AdminPermissionSeeder::class);
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);

        $this->actingAs($admin)->getJson('/api/v1/admin/finance/summary')->assertForbidden();
        $admin->permissions()->attach(Permission::query()->where('slug', 'finance.view')->firstOrFail());

        $this->getJson('/api/v1/admin/finance/summary')
            ->assertOk()
            ->assertJsonPath('data.currency', 'PHP')
            ->assertJsonPath('data.summary.profitState', 'provisional');
    }

    public function test_seller_costs_and_finance_summary_are_store_isolated(): void
    {
        [$firstSeller] = $this->seller('first');
        [$secondSeller] = $this->seller('second');

        $this->actingAs($firstSeller)->postJson('/api/v1/seller/finance/costs', [
            'category' => 'packaging', 'description' => 'Packing supplies', 'amount_cents' => 12500,
            'incurred_on' => now('Asia/Manila')->toDateString(),
        ])->assertCreated();

        $this->getJson('/api/v1/seller/finance/summary')
            ->assertOk()->assertJsonPath('data.summary.costsCents', 12500);
        $this->actingAs($secondSeller)->getJson('/api/v1/seller/finance/summary')
            ->assertOk()->assertJsonPath('data.summary.costsCents', 0);
    }

    /** @return array{User, Shop} */
    private function seller(string $suffix): array
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $shop = Shop::create([
            'seller_id' => $seller->id, 'name' => ucfirst($suffix).' Finance Shop',
            'slug' => $suffix.'-finance-shop', 'status' => ShopStatus::Active,
        ]);

        return [$seller, $shop];
    }
}
