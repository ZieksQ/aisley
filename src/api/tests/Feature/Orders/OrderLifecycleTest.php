<?php

namespace Tests\Feature\Orders;

use App\Enums\PaymentStatus;
use App\Models\CompanyTruck;
use App\Models\InventoryMovement;
use App\Models\Order;
use App\Models\ShipmentEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\OrderLifecycleFixtures;
use Tests\TestCase;

class OrderLifecycleTest extends TestCase
{
    use OrderLifecycleFixtures, RefreshDatabase;

    public static function deliveryRoutes(): array
    {
        return ['local delivery' => [false], 'company-truck transfer then delivery' => [true]];
    }

    #[DataProvider('deliveryRoutes')]
    public function test_real_checkout_reaches_confirmed_delivery_without_repricing_or_duplicate_effects(bool $transfer): void
    {
        Http::preventStrayRequests();
        config(['hub-routing.enabled' => true, 'services.geoapify.server_key' => 'test-key']);
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response([
            'sources_to_targets' => [[['distance' => 1000, 'time' => 100]]],
        ])]);
        $disk = 'order-lifecycle-'.getmypid();
        Storage::fake($disk);
        config(['filesystems.default' => $disk]);
        $context = $this->lifecycleContext($transfer);
        ['seller' => $seller, 'product' => $product, 'balance' => $balance, 'origin' => $origin,
            'destination' => $destination, 'firstCourier' => $firstCourier, 'finalCourier' => $finalCourier,
            'customer' => $customer, 'address' => $address] = $context;
        $shipping = $transfer ? '17.00' : '10.00';
        $payable = $transfer ? '217.00' : '210.00';
        $routeStatus = $transfer ? 'planned' : 'local';
        $this->asLifecycleActor($customer);
        $cart = $this->postJson('/api/v1/customer/cart/items', [
            'product_id' => $product->id, 'variant_id' => null, 'quantity' => 2,
        ])->assertOk()->json('data.items.0');
        $intent = [
            'mode' => 'cart', 'cart_item_ids' => [$cart['id']], 'address_id' => $address->id,
            'payment_method' => 'cod', 'vouchers' => [],
            'logistics_selections' => [['shop_id' => $product->shop_id, 'logistics_organization_id' => $origin[1]->id]],
        ];
        $this->postJson('/api/v1/customer/checkout/logistics-options', $intent)->assertOk()
            ->assertJsonPath('data.groups.0.options.0.shippingFee', $shipping)
            ->assertJsonPath('data.groups.0.options.0.routeStatus', $routeStatus);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()
            ->assertJsonPath('data.summary.payable', $payable)->json('data');
        $placement = [...$intent, 'quote_id' => $quote['quoteId']];
        $placeKey = (string) Str::uuid();
        $batch = $this->withHeader('Idempotency-Key', $placeKey)
            ->postJson('/api/v1/customer/checkout/place', $placement)->assertOk()->json('data');
        $this->postJson('/api/v1/customer/checkout/place', $placement)->assertOk()->assertJsonPath('data.id', $batch['id']);
        $order = Order::findOrFail($batch['orders'][0]['id']);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseMissing('cart_items', ['id' => $cart['id']]);
        $this->assertSame([10, 2], [$balance->fresh()->on_hand, $balance->fresh()->reserved]);
        $this->assertSame($routeStatus, $order->pricingSnapshot->shipping_route_status->value);
        $this->assertSame($origin[1]->id, $order->selected_logistics_organization_id);
        $this->assertOrderProjection($order, $customer, 'placed', $payable);

        // Editing the source catalog/address after checkout cannot rewrite purchased facts.
        $product->update(['name' => 'Renamed later', 'price' => '999.00']);
        $address->update(['postal_code' => '9999', 'recipient_name' => 'Changed later']);
        $this->asLifecycleActor($seller);
        $approveKey = (string) Str::uuid();
        $this->withHeader('Idempotency-Key', $approveKey)->postJson('/api/v1/seller/orders/'.$order->id.'/approve')
            ->assertOk()->assertJsonPath('data.status', 'seller_processing');
        $this->postJson('/api/v1/seller/orders/'.$order->id.'/approve')->assertOk();
        $this->assertSame([10, 2], [$balance->fresh()->on_hand, $balance->fresh()->reserved]);
        $this->assertOrderProjection($order, $customer, 'seller_processing', $payable);
        $this->asLifecycleActor($seller);
        $pickupInput = [
            'order_ids' => [$order->id], 'pickup_address_id' => $seller->addresses()->where('label', 'Pickup')->sole()->id,
            'logistics_organization_id' => $origin[1]->id,
        ];
        $this->withHeader('Idempotency-Key', (string) Str::uuid());
        $pickup = $this->postJson('/api/v1/seller/orders/pickup-requests', $pickupInput)->assertOk()->json('data');
        $this->postJson('/api/v1/seller/orders/pickup-requests', $pickupInput)->assertOk();
        $this->assertDatabaseCount('waybills', 1);
        $reference = $pickup['waybills'][0]['reference'];
        $this->assertOrderProjection($order, $customer, 'ready_for_pickup', $payable);
        $this->asLifecycleActor($origin[0]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $firstCourier->id,
            'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertCreated();
        $this->asLifecycleActor($firstCourier);
        $first = $this->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data.0');
        $this->postJson('/api/v1/courier/first-mile-tasks/'.$first['id'].'/accept')->assertOk();
        $pickupConfirm = ['identifier_type' => 'tracking_id', 'identifier' => $reference];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/courier/first-mile-tasks/'.$first['id'].'/pickup', $pickupConfirm)->assertOk();
        $this->postJson('/api/v1/courier/first-mile-tasks/'.$first['id'].'/pickup', $pickupConfirm)->assertOk();
        $this->assertSame([8, 0], [$balance->fresh()->on_hand, $balance->fresh()->reserved]);
        $this->assertSame(1, InventoryMovement::where('movement_type', 'fulfillment')->where('reference_id', $order->id)->count());
        $this->assertOrderProjection($order, $customer, 'picked_up', $payable);

        $this->asLifecycleActor($origin[0]);
        $receipts = ['receipts' => [[
            'client_id' => (string) Str::uuid(), 'reference' => $reference, 'scanned_at' => now()->toISOString(),
        ]]];
        $this->postJson('/api/v1/logistics/receiving/batches', $receipts)->assertOk()->assertJsonPath('summary.received', 1);
        $this->postJson('/api/v1/logistics/receiving/batches', $receipts)->assertOk()->assertJsonPath('summary.received', 1);
        $record = $this->sortLifecycleParcel($reference);
        if ($transfer) {
            $record = $this->transferLifecycleParcel($context, $record, $reference);
        }
        $this->asLifecycleActor($destination[0]);
        $this->assertSame('LANE-1', $record['sorting_assignment']['lane']['code']);
        $lane = $record['sorting_lane'];
        $this->patchJson('/api/v1/logistics/sorting/lanes/'.$lane['id'], [
            'expected_revision' => $lane['revision'], 'code' => 'RENAMED', 'name' => 'Renamed staging',
        ])->assertOk();
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->json('data');
        $scheduleInput = [
            'shipment_ids' => [$record['shipment_id']], 'courier_id' => $finalCourier->id,
            'scheduled_for' => now()->addHour()->toISOString(),
            'assignments' => [$this->lifecycleAssignment($record)],
        ];
        $this->withHeader('Idempotency-Key', (string) Str::uuid());
        $schedule = $this->postJson('/api/v1/logistics/dispatch/schedules', $scheduleInput)->assertCreated()->json('data');
        $this->assertSame('LANE-1', $schedule['parcels'][0]['source_lane']['code']);
        $this->assertSame('Original staging', $schedule['parcels'][0]['source_lane']['name']);
        $this->postJson('/api/v1/logistics/dispatch/schedules', $scheduleInput)->assertCreated()->assertJsonPath('data.id', $schedule['id']);
        $this->assertOrderProjection($order, $customer, 'assigned', $payable);
        $this->asLifecycleActor($finalCourier);
        $batch = $this->postJson('/api/v1/courier/final-mile-batches/'.$schedule['id'].'/accept')->assertOk()->json('data');
        $final = $batch['tasks'][0];
        $this->withHeader('Idempotency-Key', (string) Str::uuid());
        $hubEvidence = $this->postJson('/api/v1/courier/final-mile-tasks/'.$final['task_id'].'/pickup', [
            'expected_revision' => $final['revision'],
        ])->assertStatus(202)->json('data');
        $this->asLifecycleActor($destination[0]);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->json('data');
        $record = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', [
            'reference' => $reference, 'target_state' => 'picked_up_from_hub',
            'expected_revision' => $record['revision'], 'evidence_id' => $hubEvidence['evidence_id'],
        ])->assertOk()->json('data');
        $final = collect($record['tasks'])->firstWhere('leg', 'final_mile');
        foreach (['in_transit', 'out_for_delivery'] as $state) {
            $this->asLifecycleActor($finalCourier);
            $final = $this->withHeader('Idempotency-Key', (string) Str::uuid())
                ->postJson('/api/v1/courier/final-mile-tasks/'.$final['task_id'].'/status', [
                    'target_state' => $state, 'expected_revision' => $final['revision'],
                ])->assertOk()->json('data');
            $this->assertOrderProjection($order, $customer, $state, $payable);
        }
        $this->asLifecycleActor($finalCourier);
        $proof = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post('/api/v1/courier/tasks/'.$final['task_id'].'/proof-of-delivery', [
                'photo' => UploadedFile::fake()->image('handoff.jpg'), 'expected_revision' => $final['revision'],
            ])->assertStatus(202)->json('data');
        $completion = [
            'expected_revision' => $final['revision'], 'evidence_id' => $proof['proof_id'],
            'confirmed' => true, 'cod_collected' => true,
        ];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/courier/tasks/'.$final['task_id'].'/completion', $completion)->assertStatus(202);
        $this->postJson('/api/v1/courier/tasks/'.$final['task_id'].'/completion', $completion)->assertStatus(202);
        $this->assertOrderProjection($order, $customer, 'out_for_delivery', $payable);
        $this->assertSame(PaymentStatus::Pending, $order->fresh()->payment_status);
        $this->asLifecycleActor($destination[0]);
        $this->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()
            ->assertJsonPath('data.0.cod.declared_amount', $payable);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->json('data');
        $approval = [
            'reference' => $reference, 'target_state' => 'delivered',
            'expected_revision' => $record['revision'], 'evidence_id' => $proof['proof_id'],
        ];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/update-status/transitions', $approval)->assertOk()->assertJsonPath('data.status', 'delivered');
        $this->postJson('/api/v1/logistics/update-status/transitions', $approval)->assertOk();
        $this->assertSame(PaymentStatus::Paid, $order->fresh()->payment_status);
        $this->assertDatabaseHas('cod_invoices', [
            'order_id' => $order->id, 'logistics_organization_id' => $destination[1]->id,
            'total_cents' => $transfer ? 21700 : 21000, 'status' => 'outstanding',
        ]);
        $this->assertDatabaseHas('courier_cash_obligations', [
            'order_id' => $order->id, 'courier_id' => $finalCourier->id,
            'logistics_organization_id' => $destination[1]->id, 'amount_cents' => $transfer ? 21700 : 21000,
        ]);
        $this->assertDatabaseCount('cod_invoices', 1);
        $this->assertDatabaseCount('courier_cash_obligations', 1);
        $this->assertSame(1, ShipmentEvent::where('event_type', 'delivery_completed')->count());
        $this->assertSame([8, 0], [$balance->fresh()->on_hand, $balance->fresh()->reserved]);
        $this->assertOrderProjection($order, $customer, 'delivered', $payable);
        $this->getJson('/api/v1/customer/orders/'.$order->id)->assertOk()
            ->assertJsonPath('data.items.0.productName', 'Lifecycle parcel')
            ->assertJsonPath('data.deliveryAddress.recipientName', 'Lifecycle Buyer')
            ->assertJsonPath('data.deliveryAddress.postalCode', '6000')
            ->assertJsonPath('data.payment.status', 'paid')->assertJsonPath('data.items.0.canReview', true);
        $this->postJson('/api/v1/customer/order-items/'.$order->items()->sole()->id.'/review', [
            'rating' => 5, 'body' => 'Received the parcel successfully.',
        ])->assertCreated()->assertJsonPath('data.verifiedPurchase', true);
        $this->asLifecycleActor($seller);
        $this->getJson('/api/v1/seller/orders/'.$order->id)->assertOk()->assertJsonPath('data.status', 'delivered');
        $this->asLifecycleActor($finalCourier);
        $this->getJson('/api/v1/courier/delivery-history')->assertOk()->assertJsonPath('data.0.status', 'delivered');
    }

    private function assertOrderProjection(Order $order, User $customer, string $state, string $payable): void
    {
        $this->asLifecycleActor($customer);
        $this->getJson('/api/v1/customer/orders/'.$order->id)->assertOk()
            ->assertJsonPath('data.status', $state)->assertJsonPath('data.totals.payable', $payable);
    }

    private function sortLifecycleParcel(string $reference): array
    {
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $capture = ['captures' => [[
            'client_id' => (string) Str::uuid(), 'reference' => $reference, 'auto_route' => true,
            'expected_revision' => $session['items'][0]['expected_revision'],
            'source' => 'barcode', 'captured_at' => now()->toISOString(),
        ]]];
        $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', $capture)
            ->assertOk()->assertJsonPath('summary.sorted', 1);
        $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', $capture)
            ->assertOk()->assertJsonPath('summary.sorted', 1);

        return $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->json('data');
    }

    private function lifecycleAssignment(array $record): array
    {
        return [
            'shipment_id' => $record['shipment_id'], 'expected_revision' => $record['revision'],
            'lane_id' => $record['sorting_lane']['id'], 'lane_revision' => $record['sorting_lane']['revision'],
        ];
    }

    private function transferLifecycleParcel(array $context, array $record, string $reference): array
    {
        ['origin' => $origin, 'destination' => $destination, 'firstCourier' => $driver] = $context;
        $driver->courierLogisticsAffiliation()->update(['can_drive_company_truck' => true]);
        $truck = CompanyTruck::create([
            'logistics_organization_id' => $origin[1]->id, 'home_hub_id' => $origin[2]->id,
            'last_confirmed_hub_id' => $origin[2]->id, 'plate_number' => 'LIFE-001', 'max_parcels' => 10,
        ]);
        $trip = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', [
            'next_hub_id' => $destination[2]->id, 'company_truck_id' => $truck->id,
            'driver_id' => $driver->id, 'scheduled_for' => now()->addHour()->toISOString(),
            'shipment_ids' => [$record['shipment_id']],
        ])->assertCreated()->json('data');
        $this->asLifecycleActor($destination[0]);
        $this->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/decision', [
            'accept' => true, 'expected_revision' => $trip['revision'],
        ])->assertOk();
        $this->asLifecycleActor($origin[0]);
        $this->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/depart', ['expected_revision' => 2])
            ->assertOk()->assertJsonPath('data.status', 'in_transfer');
        $this->assertDatabaseMissing('delivery_tasks', ['leg' => 'final_mile']);
        $this->asLifecycleActor($destination[0]);
        $this->receiveTripParcels($trip['id']);
        $this->assertDatabaseHas('shipments', ['id' => $record['shipment_id'], 'current_hub_id' => $destination[2]->id, 'status' => 'received_at_hub']);

        return $this->sortLifecycleParcel($reference);
    }
}
