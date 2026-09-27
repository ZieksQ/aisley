<?php

namespace Tests\Feature\Finance;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Address;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\CommissionPolicy;
use App\Models\FinancialHold;
use App\Models\LogisticsOrganization;
use App\Models\Order;
use App\Models\Permission;
use App\Models\ShippingRateVersion;
use App\Models\Shop;
use App\Models\User;
use Database\Seeders\AdminPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class FinanceHoldReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_reviews_and_reconciles_route_finance_holds_with_safe_context(): void
    {
        $this->seed(AdminPermissionSeeder::class);
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $this->actingAs($admin)->getJson('/api/v1/admin/finance/holds')->assertForbidden();
        $admin->permissions()->attach(Permission::query()->whereIn('slug', ['finance.view', 'finance.manage'])->pluck('id'));

        $first = $this->logistics('First Carrier');
        $second = $this->logistics('Second Carrier');
        $order = $this->order($first);
        $hold = FinancialHold::create([
            'order_id' => $order->id,
            'reason_code' => 'UNPLANNED_ROUTE_RECONCILIATION_REQUIRED',
            'notes' => 'Route could not be planned at checkout.',
            'placed_at' => now(),
        ]);
        FinancialHold::create([
            'order_id' => $order->id,
            'reason_code' => 'MANUAL_REVIEW',
            'notes' => 'Not a route allocation hold.',
            'placed_at' => now(),
        ]);

        $this->getJson('/api/v1/admin/finance/holds?status=open')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $hold->id)
            ->assertJsonPath('data.0.order.reference', 'AIS-HOLD-0001')
            ->assertJsonPath('data.0.pricing.destination.city_municipality', 'Makati City')
            ->assertJsonMissing(['recipient_name' => 'Private Buyer'])
            ->assertJsonMissing(['barangay' => 'Private Barangay']);

        $this->getJson('/api/v1/admin/finance/holds/'.$hold->id)
            ->assertOk()
            ->assertJsonPath('data.pricing.logistics_pool_cents', 9000)
            ->assertJsonPath('organizations.0.business_name', 'First Carrier')
            ->assertJsonPath('organizations.1.business_name', 'Second Carrier');

        $this->postJson('/api/v1/admin/finance/holds/'.$hold->id.'/reconcile-logistics', [
            'platform_subsidy_cents' => 1000,
            'notes' => 'Dispatch manifests confirm first-mile pickup and final-mile delivery.',
            'allocations' => [
                ['logistics_organization_id' => $first->id, 'service_type' => 'first_mile', 'amount_cents' => 3000],
                ['logistics_organization_id' => $second->id, 'service_type' => 'last_mile', 'amount_cents' => 7000],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.shipping_pool_cents', 9000)
            ->assertJsonPath('data.total_allocation_cents', 10000);

        $this->assertDatabaseHas('financial_holds', ['id' => $hold->id, 'released_by' => $admin->id]);
        $this->assertDatabaseHas('logistics_route_reconciliations', ['financial_hold_id' => $hold->id, 'platform_subsidy_cents' => 1000]);
        $this->assertDatabaseCount('logistics_service_allocations', 2);

        $this->getJson('/api/v1/admin/finance/holds?status=resolved')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reconciliation.total_allocation_cents', 10000);
    }

    private function logistics(string $name): LogisticsOrganization
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $this->address($user, $name.' Hub');
        $organization = LogisticsOrganization::create(['user_id' => $user->id, 'business_name' => $name]);
        $organization->hub()->create(['address_id' => $address->id, 'name' => $name.' Hub']);

        return $organization;
    }

    private function order(LogisticsOrganization $organization): Order
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'name' => 'Hold Review Shop', 'slug' => 'hold-review-shop']);
        $quote = CheckoutQuote::create([
            'customer_id' => $customer->id,
            'input_payload' => [],
            'request_hash' => str_repeat('a', 64),
            'state_hash' => str_repeat('b', 64),
            'expires_at' => now()->addHour(),
        ]);
        $batch = CheckoutBatch::create([
            'customer_id' => $customer->id,
            'checkout_quote_id' => $quote->id,
            'idempotency_key' => Str::uuid(),
            'request_hash' => str_repeat('a', 64),
            'currency' => 'PHP',
            'placed_at' => now(),
        ]);
        $order = Order::create([
            'checkout_batch_id' => $batch->id,
            'customer_id' => $customer->id,
            'shop_id' => $shop->id,
            'selected_logistics_organization_id' => $organization->id,
            'reference' => 'AIS-HOLD-0001',
            'status' => 'delivered',
            'payment_method' => 'cod',
            'payment_status' => 'paid',
            'currency' => 'PHP',
            'merchandise_subtotal' => '500.00',
            'shipping_fee' => '100.00',
            'discount_total' => '0.00',
            'shipping_discount_total' => '0.00',
            'payable_total' => '600.00',
            'placed_at' => now(),
        ]);
        $rate = ShippingRateVersion::create([
            'version_number' => 1,
            'status' => 'published',
            'currency' => 'PHP',
            'base_fee_cents' => 5000,
            'included_weight_grams' => 1,
            'additional_weight_grams' => 1,
            'additional_fee_cents' => 0,
            'volumetric_divisor' => 5000,
            'max_weight_grams' => 50000,
            'max_length_mm' => 2000,
            'max_width_mm' => 2000,
            'max_height_mm' => 2000,
            'destination_surcharge_cents' => 1000,
            'effective_at' => now()->subDay(),
            'published_at' => now()->subDay(),
        ]);
        $sellerPolicy = CommissionPolicy::create(['beneficiary_type' => 'seller', 'rate_basis_points' => 500, 'status' => 'published', 'effective_at' => now()->subDay()]);
        $logisticsPolicy = CommissionPolicy::create(['beneficiary_type' => 'logistics', 'rate_basis_points' => 1000, 'status' => 'published', 'effective_at' => now()->subDay()]);
        $order->pricingSnapshot()->create([
            'shipping_rate_version_id' => $rate->id,
            'selected_logistics_organization_id' => $organization->id,
            'seller_commission_policy_id' => $sellerPolicy->id,
            'logistics_commission_policy_id' => $logisticsPolicy->id,
            'currency' => 'PHP',
            'billable_weight_grams' => 2000,
            'base_fee_cents' => 5000,
            'additional_weight_fee_cents' => 4000,
            'destination_surcharge_cents' => 1000,
            'quoted_shipping_fee_cents' => 10000,
            'seller_commission_base_cents' => 50000,
            'seller_commission_cents' => 2500,
            'seller_proceeds_cents' => 47500,
            'logistics_commission_cents' => 1000,
            'logistics_pool_cents' => 9000,
            'cod_total_cents' => 60000,
            'origin_snapshot' => ['region' => 'National Capital Region (NCR)'],
            'destination_snapshot' => [
                'recipient_name' => 'Private Buyer',
                'barangay' => 'Private Barangay',
                'city_municipality' => 'Makati City',
                'province' => 'Metro Manila',
                'region' => 'National Capital Region (NCR)',
            ],
            'line_inputs' => [],
            'voucher_funding' => [],
            'eligible_logistics_organization_ids' => [$organization->id],
            'shipping_route_status' => 'unplanned',
            'shipping_route_snapshot' => ['status' => 'unplanned'],
            'logistics_charge_inputs' => [],
            'snapshotted_at' => now(),
        ]);

        return $order;
    }

    private function address(User $user, string $name): Address
    {
        return Address::create([
            'user_id' => $user->id,
            'type' => AddressType::Both,
            'label' => 'Hub',
            'recipient_name' => $name,
            'contact_number' => '09171234567',
            'address_line_1' => '1 Hub Road',
            'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'National Capital Region (NCR)',
            'postal_code' => '1203',
            'country' => 'Philippines',
            'is_default' => true,
        ]);
    }
}
