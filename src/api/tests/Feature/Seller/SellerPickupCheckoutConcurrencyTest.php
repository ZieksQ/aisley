<?php

namespace Tests\Feature\Seller;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Permission;
use App\Services\Customer\CheckoutService;
use App\Services\Seller\AcceptSellerOrder;
use App\Services\Seller\RequestSellerPickup;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\InterleavesRoutingGate;
use Tests\Support\OrderLifecycleFixtures;
use Tests\TestCase;

class SellerPickupCheckoutConcurrencyTest extends TestCase
{
    use DatabaseMigrations { runDatabaseMigrations as private migratePickupDatabase; }
    use InterleavesRoutingGate, OrderLifecycleFixtures;

    public function runDatabaseMigrations(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! extension_loaded('pcntl') || ! str_starts_with((string) config('database.connections.pgsql.database'), 'aisley_pod_test_')) {
            $this->markTestSkipped('Requires a disposable run-delivery-postgres database and independent pcntl workers.');
        }
        $this->migratePickupDatabase();
    }

    public function test_checkout_waits_for_pickup_without_holding_the_shared_inventory_or_deadlocking(): void
    {
        Http::preventStrayRequests();
        config(['hub-routing.enabled' => true, 'services.geoapify.server_key' => null]);
        Permission::firstOrCreate(['slug' => 'platform-settings.manage'], ['name' => 'Manage platform settings']);
        $context = $this->lifecycleContext(false);
        $input = [
            'mode' => 'buy_now', 'buy_now' => ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 1],
            'address_id' => $context['address']->id, 'payment_method' => 'cod', 'vouchers' => [],
            'logistics_selections' => [['shop_id' => $context['shop']->id, 'logistics_organization_id' => $context['origin'][1]->id]],
        ];
        $checkout = app(CheckoutService::class);
        $firstQuote = $checkout->quote($context['customer'], $input);
        $batch = $checkout->place($context['customer'], [...$input, 'quote_id' => $firstQuote['quoteId']], (string) Str::uuid());
        $order = $batch->orders->sole();
        app(AcceptSellerOrder::class)->handle($context['seller'], $order->id, (string) Str::uuid());
        $nextQuote = $checkout->quote($context['customer'], $input);
        $placement = [...$input, 'quote_id' => $nextQuote['quoteId']];
        $placementKey = (string) Str::uuid();
        $pickupKey = (string) Str::uuid();
        $pickupAddressId = $context['seller']->addresses()->where('label', 'Pickup')->sole()->id;
        $pickup = fn () => app(RequestSellerPickup::class)->handle(
            $context['seller'], [$order->id], $pickupAddressId, $context['origin'][1]->id, $pickupKey,
        );

        $result = $this->interleaveRoutingGate(
            fn () => ['batch_id' => app(CheckoutService::class)->place($context['customer'], $placement, $placementKey)->id],
            $pickup,
        );

        $nextOrder = Order::where('checkout_batch_id', $result['batch_id'])->sole();
        $this->assertSame(OrderStatus::ReadyForPickup, $order->fresh()->status);
        $this->assertSame(OrderStatus::Placed, $nextOrder->status);
        $this->assertSame('110.00', $order->fresh()->payable_total);
        $this->assertSame($order->fresh()->payable_total, $nextOrder->payable_total);
        $this->assertSame([10, 2], [$context['balance']->fresh()->on_hand, $context['balance']->fresh()->reserved]);
        $this->assertSame($result['batch_id'], $checkout->place($context['customer'], $placement, $placementKey)->id);
        $this->assertSame($pickup()->id, $pickup()->id);
        $this->assertDatabaseCount('orders', 2);
        $this->assertDatabaseCount('inventory_movements', 2);
        $this->assertDatabaseCount('seller_pickup_requests', 1);
        $this->assertDatabaseCount('waybills', 1);
    }
}
