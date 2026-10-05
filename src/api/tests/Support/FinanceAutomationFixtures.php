<?php

namespace Tests\Support;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Address;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\CommissionPolicy;
use App\Models\LogisticsOrganization;
use App\Models\LogisticsServiceAllocation;
use App\Models\Order;
use App\Models\SandboxGatewayAccount;
use App\Models\ShippingRateVersion;
use App\Models\Shop;
use App\Models\User;
use App\Services\Finance\LedgerService;
use Illuminate\Support\Str;

trait FinanceAutomationFixtures
{
    private function logistics(string $name): LogisticsOrganization
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $this->address($user, $name.' Hub');
        $organization = LogisticsOrganization::create(['user_id' => $user->id, 'business_name' => $name]);
        $organization->hub()->create(['address_id' => $address->id, 'name' => $name.' Hub']);
        // Explicit funding for successful-payment regression scenarios.
        SandboxGatewayAccount::where('reference', 'logistics-'.$organization->id)->update(['balance_cents' => 100000000]);

        return $organization;
    }

    private function order(LogisticsOrganization $organization): Order
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'name' => 'Hold Review Shop', 'slug' => 'finance-'.Str::uuid()]);
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
            'reference' => 'AIS-'.Str::uuid(),
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
            'version_number' => ShippingRateVersion::query()->max('version_number') + 1,
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

    private function fund(Order $order, LogisticsOrganization $organization): void
    {
        LogisticsServiceAllocation::create(['order_id' => $order->id, 'logistics_organization_id' => $organization->id, 'service_type' => 'last_mile', 'amount_cents' => 9000, 'status' => 'committed']);
        app(LedgerService::class)->post('fixture:'.$order->id, 'delivery_recognized', 'PHP', [
            ['account_code' => 'cod_receivable', 'owner_type' => 'platform', 'debit_cents' => 60000],
            ['account_code' => 'seller_liability', 'owner_type' => 'seller', 'owner_id' => $order->shop_id, 'credit_cents' => 47500],
            ['account_code' => 'logistics_liability', 'owner_type' => 'logistics', 'owner_id' => $organization->id, 'credit_cents' => 9000],
            ['account_code' => 'commission_revenue', 'owner_type' => 'platform', 'credit_cents' => 3500],
        ], now(), $order->id);
    }
}
