<?php

namespace Tests\Feature\Seller;

use App\Enums\InventoryMovementType;
use App\Enums\InventorySkuStatus;
use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use App\Notifications\Seller\LowStockAlertNotification;
use App\Services\Seller\InventoryService;
use App\Services\Seller\LowStockAlertService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Mockery;
use Tests\TestCase;

class SellerLowStockAlertTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_adjustments_schedule_the_shared_evaluator_with_the_committed_movement(): void
    {
        [$seller, , , $balance] = $this->inventory(5, 2);
        $alerts = Mockery::mock(LowStockAlertService::class);
        $alerts->shouldReceive('schedule')
            ->once()
            ->with($balance->id, Mockery::type('string'));

        $movement = (new InventoryService($alerts))->adjust(
            $balance->sku,
            2,
            InventoryMovementType::ManualDecrease,
            'Damaged stock.',
            $seller,
        );

        $this->assertSame(-2, $movement->on_hand_delta);
        $this->assertSame(3, $movement->resulting_on_hand);
    }

    public function test_threshold_crossing_creates_one_alert_per_cycle_and_notifies_once(): void
    {
        Notification::fake();
        [$seller, , , $balance] = $this->inventory(5, 3);
        $alerts = app(LowStockAlertService::class);

        $balance->update(['on_hand' => 3]);
        $first = $alerts->evaluate($balance->id);

        $this->assertNotNull($first);
        $this->assertSame('active', $first->state->value);
        $this->assertSame(3, $first->trigger_available);
        Notification::assertSentToTimes($seller, LowStockAlertNotification::class, 1);

        $balance->update(['on_hand' => 2]);
        $same = $alerts->evaluate($balance->id);
        $this->assertSame($first->id, $same?->id);
        $this->assertSame(2, $same?->current_available);
        $this->assertDatabaseCount('low_stock_alerts', 1);
        Notification::assertSentToTimes($seller, LowStockAlertNotification::class, 1);

        $balance->update(['on_hand' => 6]);
        $alerts->evaluate($balance->id);
        $this->assertDatabaseHas('low_stock_alerts', [
            'id' => $first->id,
            'state' => 'resolved',
            'resolution_reason' => 'stock_recovered',
            'active_marker' => null,
        ]);

        $balance->update(['on_hand' => 1]);
        $second = $alerts->evaluate($balance->id);
        $this->assertNotSame($first->id, $second?->id);
        $this->assertDatabaseCount('low_stock_alerts', 2);
        Notification::assertSentToTimes($seller, LowStockAlertNotification::class, 2);
    }

    public function test_zero_threshold_is_valid_and_disabling_threshold_resolves_the_alert(): void
    {
        [, , , $balance] = $this->inventory(0, 0);
        $alerts = app(LowStockAlertService::class);

        $alert = $alerts->evaluate($balance->id, notify: false);
        $this->assertSame(0, $alert?->current_threshold);

        $balance->update(['alert_threshold' => null]);
        $alerts->evaluate($balance->id, notify: false);

        $this->assertDatabaseHas('low_stock_alerts', [
            'id' => $alert?->id,
            'state' => 'resolved',
            'resolution_reason' => 'threshold_disabled',
        ]);
    }

    public function test_archived_products_do_not_open_new_alerts_but_history_remains_visible(): void
    {
        [$seller, , $product, $balance] = $this->inventory(1, 2);
        $alerts = app(LowStockAlertService::class);
        $alert = $alerts->evaluate($balance->id, notify: false);
        $product->update(['status' => ProductStatus::Archived]);
        $balance->update(['on_hand' => 5]);
        $alerts->evaluate($balance->id, notify: false);
        $balance->update(['on_hand' => 0]);
        $alerts->evaluate($balance->id, notify: false);

        $this->assertDatabaseCount('low_stock_alerts', 1);
        $this->actingAs($seller)->getJson('/api/v1/seller/low-stock-alerts')
            ->assertOk()
            ->assertJsonPath('data.0.id', $alert?->id)
            ->assertJsonPath('data.0.product.status', 'archived');
    }

    public function test_seller_can_filter_alert_history_but_cannot_read_another_shops_alert(): void
    {
        [$owner, , , $ownerBalance] = $this->inventory(2, 3, 'owner');
        [$other, , , $otherBalance] = $this->inventory(1, 2, 'other');
        $alerts = app(LowStockAlertService::class);
        $ownerAlert = $alerts->evaluate($ownerBalance->id, notify: false);
        $otherAlert = $alerts->evaluate($otherBalance->id, notify: false);

        $this->actingAs($owner)->getJson('/api/v1/seller/low-stock-alerts?state=active&search=sku-owner')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $ownerAlert?->id)
            ->assertJsonPath('configured_threshold_count', 1);
        $this->getJson('/api/v1/seller/low-stock-alerts/'.$otherAlert?->id)->assertNotFound();
        $this->actingAs($other)->getJson('/api/v1/seller/low-stock-alerts/'.$ownerAlert?->id)->assertNotFound();
    }

    public function test_alert_keeps_the_safe_trigger_movement_reference(): void
    {
        [, , , $balance] = $this->inventory(2, 2);
        $movement = InventoryMovement::create([
            'inventory_balance_id' => $balance->id,
            'movement_type' => InventoryMovementType::ManualDecrease,
            'on_hand_delta' => -1,
            'reserved_delta' => 0,
            'resulting_on_hand' => 2,
            'resulting_reserved' => 0,
            'reference_type' => 'manual_adjustment',
            'reason' => 'Damaged stock.',
        ]);

        $alert = app(LowStockAlertService::class)->evaluate($balance->id, $movement->id, false);

        $this->assertSame($movement->id, $alert?->trigger_movement_id);
    }

    /** @return array{User, Shop, Product, InventoryBalance} */
    private function inventory(int $onHand, ?int $threshold, string $suffix = 'one'): array
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $shop = Shop::create([
            'seller_id' => $seller->id,
            'name' => "Alert Shop {$suffix}",
            'slug' => "alert-shop-{$suffix}",
            'status' => ShopStatus::Active,
        ]);
        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => "Alert Product {$suffix}",
            'slug' => "alert-product-{$suffix}",
            'price' => '100.00',
            'stock_quantity' => $onHand,
            'status' => ProductStatus::Active,
            'published_at' => now(),
        ]);
        $sku = InventorySku::create([
            'shop_id' => $shop->id,
            'product_id' => $product->id,
            'code' => "SKU-{$suffix}",
            'is_base' => true,
            'status' => InventorySkuStatus::Active,
        ]);
        $balance = InventoryBalance::create([
            'inventory_sku_id' => $sku->id,
            'on_hand' => $onHand,
            'reserved' => 0,
            'alert_threshold' => $threshold,
        ]);

        return [$seller, $shop, $product, $balance];
    }
}
