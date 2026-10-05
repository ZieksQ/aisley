<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\CommissionPolicy;
use App\Models\LogisticsRateCard;
use App\Models\LogisticsServiceRate;
use App\Models\Order;
use App\Models\Product;
use App\Models\ShippingRateVersion;
use App\Models\Shop;
use App\Models\ShopLogisticsProvider;
use App\Models\User;
use Database\Seeders\AdminPermissionSeeder;
use Database\Seeders\DemoCheckoutSeeder;
use Database\Seeders\InitialAdminSeeder;
use Database\Seeders\InitialCustomerSeeder;
use Database\Seeders\InitialLogisticsSeeder;
use Database\Seeders\InitialSellerSeeder;
use Database\Seeders\PlatformFeatureControlSeeder;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DemoCheckoutSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('customer.generic.count', 0);
        config()->set('seller.generic.count', 0);
        config()->set('logistics.generic.count', 0);
        config()->set('courier.generic.count', 0);
        config()->set('hub-routing.enabled', true);
        config()->set('admin.initial', [
            'email' => 'admin@example.com', 'password' => 'AdminSecret123',
            'first_name' => 'Aisley', 'last_name' => 'Admin',
        ]);
        config()->set('customer.initial', [
            'email' => 'customer@example.com', 'password' => 'CustomerSecret123',
            'first_name' => 'Jamie', 'last_name' => 'Buyer', 'contact_number' => '+639171111111', 'birth_date' => '1998-04-12',
        ]);
        config()->set('seller.initial', [
            'email' => 'seller@example.com', 'password' => 'SellerSecret123',
            'first_name' => 'Aisley', 'last_name' => 'Catalog', 'contact_number' => '+639171111112', 'birth_date' => '1995-01-01',
            'address_line_1' => '1 Seller Street', 'address_line_2' => null, 'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City', 'province' => 'Metro Manila', 'region' => 'National Capital Region (NCR)', 'postal_code' => '1200',
        ]);
        config()->set('logistics.initial', [
            'email' => 'logistics@example.com', 'password' => 'LogisticsSecret123',
            'first_name' => 'Logan', 'last_name' => 'Operator', 'contact_number' => '+639171111113', 'birth_date' => '1990-01-01',
            'business_name' => 'Aisley Delivery Services', 'hub_name' => 'Aisley Makati Hub',
            'address_line_1' => '1 Hub Road', 'address_line_2' => null, 'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City', 'province' => 'Metro Manila', 'region' => 'National Capital Region (NCR)',
            'postal_code' => '1200', 'latitude' => 14.565681, 'longitude' => 121.032077,
        ]);

        $this->seed([
            AdminPermissionSeeder::class,
            InitialAdminSeeder::class,
            PlatformFeatureControlSeeder::class,
            InitialCustomerSeeder::class,
            InitialSellerSeeder::class,
            InitialLogisticsSeeder::class,
            ProductSeeder::class,
            DemoCheckoutSeeder::class,
        ]);
    }

    public function test_seeded_customer_can_quote_place_and_request_pickup_for_a_local_delivery(): void
    {
        $customer = User::query()->where('email', 'customer@example.com')->firstOrFail();
        Sanctum::actingAs($customer);
        $address = $customer->addresses()->sole();
        $product = Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();
        $shop = Shop::query()->where('slug', 'aisley-demo-store')->firstOrFail();
        $organization = ShopLogisticsProvider::query()->where('shop_id', $shop->id)->firstOrFail()->organization;
        $payload = $this->buyNowPayload($product, $address);

        $this->postJson('/api/v1/customer/checkout/logistics-options', $payload)
            ->assertOk()
            ->assertJsonPath('data.groups.0.options.0.organizationId', $organization->id)
            ->assertJsonPath('data.groups.0.options.0.shippingFee', '70.00')
            ->assertJsonPath('data.groups.0.options.0.routeStatus', 'local');

        $quote = $this->postJson('/api/v1/customer/checkout/quote', $payload)
            ->assertOk()
            ->assertJsonPath('data.groups.0.shippingQuote.shippingFee', '70.00')
            ->assertJsonPath('data.groups.0.shippingQuote.routeStatus', 'local')
            ->json('data');
        $orderId = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$payload, 'quote_id' => $quote['quoteId']])
            ->assertOk()
            ->assertJsonPath('data.orders.0.totals.shippingFee', '70.00')
            ->json('data.orders.0.id');

        $this->assertDatabaseHas('order_pricing_snapshots', [
            'order_id' => $orderId,
            'quoted_shipping_fee_cents' => 7000,
            'shipping_route_status' => 'local',
        ]);

        $seller = User::query()->where('email', 'seller@example.com')->firstOrFail();
        $order = Order::query()->findOrFail($orderId);
        $this->actingAs($seller)->postJson("/api/v1/seller/orders/{$order->id}/approve")->assertOk();
        $pickupAddressId = $seller->addresses()->where('is_default', true)->firstOrFail()->id;
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/seller/orders/pickup-requests', [
                'order_ids' => [$order->id],
                'pickup_address_id' => $pickupAddressId,
                'logistics_organization_id' => $organization->id,
            ])
            ->assertOk()
            ->assertJsonPath('data.logistics_organization_id', $organization->id)
            ->assertJsonCount(1, 'data.waybills');
    }

    public function test_demo_checkout_seed_is_repeatable_and_preserves_operator_choices(): void
    {
        $provider = ShopLogisticsProvider::query()->firstOrFail();
        $provider->update(['is_enabled' => false]);
        $serviceRate = LogisticsServiceRate::query()->where('service_type', 'first_mile')->firstOrFail();
        $serviceRate->update(['base_fee_cents' => 4321]);
        $sellerPolicy = CommissionPolicy::query()->where('beneficiary_type', 'seller')->firstOrFail();
        $sellerPolicy->update(['rate_basis_points' => 250]);
        $versions = [
            ShippingRateVersion::query()->count(),
            CommissionPolicy::query()->count(),
            LogisticsRateCard::query()->count(),
        ];
        $this->seed(DemoCheckoutSeeder::class);

        $this->assertFalse($provider->fresh()->is_enabled);
        $this->assertSame(4321, $serviceRate->fresh()->base_fee_cents);
        $this->assertSame(250, $sellerPolicy->fresh()->rate_basis_points);
        $this->assertSame($versions, [
            ShippingRateVersion::query()->count(),
            CommissionPolicy::query()->count(),
            LogisticsRateCard::query()->count(),
        ]);
        $this->assertSame(1, User::query()->where('email', 'customer@example.com')->firstOrFail()->addresses()->count());
    }

    public function test_demo_checkout_settings_are_not_seeded_in_production(): void
    {
        $counts = [
            ShippingRateVersion::query()->count(),
            CommissionPolicy::query()->count(),
            LogisticsRateCard::query()->count(),
        ];
        $originalEnvironment = app()->environment();
        app()->detectEnvironment(fn (): string => 'production');

        try {
            app(DemoCheckoutSeeder::class)->run();
        } finally {
            app()->detectEnvironment(fn (): string => $originalEnvironment);
        }

        $this->assertSame($counts, [
            ShippingRateVersion::query()->count(),
            CommissionPolicy::query()->count(),
            LogisticsRateCard::query()->count(),
        ]);
    }

    /** @return array<string, mixed> */
    private function buyNowPayload(Product $product, Address $address): array
    {
        return [
            'mode' => 'buy_now',
            'buy_now' => ['product_id' => $product->id, 'variant_id' => null, 'quantity' => 1],
            'address_id' => $address->id,
            'payment_method' => 'cod',
            'vouchers' => [],
        ];
    }
}
