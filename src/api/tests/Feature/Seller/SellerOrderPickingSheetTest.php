<?php

namespace Tests\Feature\Seller;

use App\Enums\CategoryStatus;
use App\Enums\OrderStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\Order;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SellerOrderPickingSheetTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_active_sellers_can_read_a_picking_sheet(): void
    {
        $path = $this->path([(string) Str::uuid()]);
        $this->getJson($path)->assertUnauthorized();
        foreach ([UserRole::Customer, UserRole::Admin, UserRole::Logistics, UserRole::Courier] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role, 'status' => UserStatus::Active]))
                ->getJson($path)->assertForbidden();
        }
        foreach ([UserStatus::Pending, UserStatus::Rejected, UserStatus::Suspended, UserStatus::Deactivated] as $status) {
            $this->actingAs(User::factory()->create(['role' => UserRole::Seller, 'status' => $status]))
                ->getJson($path)->assertForbidden();
        }
    }

    public function test_selection_is_bounded_and_validated_before_rendering(): void
    {
        [$seller] = $this->sellerShop();
        $this->actingAs($seller);
        $id = (string) Str::uuid();
        foreach ([[], ['bad-id'], [$id, $id], [$id, strtoupper($id)], array_map(fn () => (string) Str::uuid(), range(1, 51))] as $ids) {
            $this->getJson($this->path($ids))->assertUnprocessable();
        }
        $this->getJson('/api/v1/seller/orders/picking-sheet.pdf?order_ids=invalid')
            ->assertUnprocessable()->assertJsonValidationErrors('order_ids');
    }

    public function test_mixed_foreign_or_missing_orders_reject_the_entire_pdf(): void
    {
        [$seller, $shop] = $this->sellerShop();
        [, $foreignShop] = $this->sellerShop();
        $owned = $this->order($shop);
        $foreign = $this->order($foreignShop);
        Pdf::shouldReceive('setOptions')->never();

        $this->actingAs($seller)->getJson($this->path([$owned->id, $foreign->id]))->assertNotFound();
        $this->getJson($this->path([$owned->id, (string) Str::uuid()]))->assertNotFound();
        $this->getJson($this->path([$foreign->id]))->assertNotFound();
    }

    public function test_pdf_uses_owned_snapshots_in_selection_order_without_fulfillment_side_effects(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $first = $this->order($shop);
        $second = $this->order($shop);
        $second->items()->create([
            'product_name' => 'Second purchased item', 'sku' => null, 'quantity' => 3,
            'unit_price' => '10.00', 'line_subtotal' => '30.00', 'currency' => 'PHP',
            'variant_name' => 'Large', 'selected_options' => [['group' => 'Color', 'value' => 'Blue']],
        ]);
        $pdf = $this->app->make('dompdf.wrapper');
        $this->app->instance('dompdf.wrapper', $pdf);
        $document = null;
        $pdf->setCallbacks([['event' => 'begin_page_reflow', 'f' => function () use ($pdf, &$document): void {
            $document ??= clone $pdf->getDomPDF()->getDom();
        }]]);
        $response = $this->actingAs($seller)->get($this->path([strtoupper($second->id), $first->id]));
        $response->assertOk()->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Pragma', 'no-cache')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringStartsWith('%PDF-', $response->getContent());
        $this->assertStringContainsString('inline; filename="order-picking-sheet-', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));

        // Inspect the same DOM used by the actual PDF renderer, rather than a parallel template.
        $text = $document->textContent;
        $this->assertLessThan(strpos($text, $first->reference), strpos($text, $second->reference));
        foreach (['Buyer snapshot', 'Purchased basket', 'BASKET-SNAP', 'Second purchased item', 'Large', 'Color: Blue', 'SKU: Unavailable', 'Qty: 3'] as $expected) {
            $this->assertStringContainsString($expected, $text);
        }
        $body = $document->getElementsByTagName('body')->item(0)->textContent;
        foreach (['Order picking sheet', 'Warehouse shop', 'Generated', 'Placed:', 'Status:', 'Destination:', 'Processing', 'Manila', 'Continued', 'Verify the current order status'] as $removed) {
            $this->assertStringNotContainsString($removed, $body);
        }
        $this->assertCount(2, $document->getElementsByTagName('th'));
        $this->assertSame([0.0, 0.0, 595.28, 841.89], $pdf->getDomPDF()->getPaperSize());
        $this->assertFalse($pdf->getDomPDF()->getOptions()->getIsRemoteEnabled());
        $this->assertFalse($pdf->getDomPDF()->getOptions()->getIsPhpEnabled());
        $this->assertFalse($pdf->getDomPDF()->getOptions()->getIsJavascriptEnabled());
        $this->assertSame(OrderStatus::SellerProcessing, $first->fresh()->status);
        $this->assertSame('pending', $first->fresh()->payment_status->value);
        foreach (['order_status_events', 'inventory_movements', 'waybills', 'seller_pickup_requests', 'notifications'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
    }

    public function test_long_order_can_span_pages_and_printed_text_cannot_inject_markup(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->items()->update(['product_name' => '<script>bad()</script> José & Niño']);
        foreach (range(1, 65) as $index) {
            $order->items()->create([
                'product_name' => 'Purchased item '.$index, 'sku' => 'PICK-'.$index, 'quantity' => 1,
                'unit_price' => '10.00', 'line_subtotal' => '10.00', 'currency' => 'PHP',
            ]);
        }
        $pdf = $this->app->make('dompdf.wrapper');
        $this->app->instance('dompdf.wrapper', $pdf);
        $document = null;
        $pdf->setCallbacks([['event' => 'begin_page_reflow', 'f' => function () use ($pdf, &$document): void {
            $document ??= clone $pdf->getDomPDF()->getDom();
        }]]);
        $this->actingAs($seller)->get($this->path([$order->id]))->assertOk();
        $this->assertGreaterThan(1, $pdf->getDomPDF()->getCanvas()->get_page_count());
        $this->assertCount(0, $document->getElementsByTagName('script'));
        $this->assertStringContainsString('<script>bad()</script> José & Niño', $document->textContent);
        foreach (range(1, 65) as $index) {
            $this->assertStringContainsString('PICK-'.$index, $document->textContent);
        }
        $this->assertSame(66, $document->getElementsByTagName('tbody')->item(0)->getElementsByTagName('tr')->length);
    }

    /** @return array{User, Shop} */
    private function sellerShop(): array
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $suffix = Str::lower(Str::random(10));
        $category = ShopCategory::create(['name' => 'General', 'slug' => $suffix, 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $category->id,
            'name' => 'Warehouse shop', 'slug' => $suffix, 'status' => ShopStatus::Active]);

        return [$seller, $shop];
    }

    private function order(Shop $shop): Order
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $quote = CheckoutQuote::create(['customer_id' => $customer->id, 'input_payload' => [],
            'request_hash' => str_repeat('a', 64), 'state_hash' => str_repeat('b', 64), 'expires_at' => now()->addHour()]);
        $batch = CheckoutBatch::create(['customer_id' => $customer->id, 'checkout_quote_id' => $quote->id,
            'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('c', 64), 'currency' => 'PHP', 'placed_at' => now()]);
        $order = Order::create(['checkout_batch_id' => $batch->id, 'customer_id' => $customer->id, 'shop_id' => $shop->id,
            'reference' => 'ASL-PICK-'.Str::upper(Str::random(10)), 'status' => OrderStatus::SellerProcessing,
            'payment_method' => 'cod', 'payment_status' => 'pending', 'currency' => 'PHP',
            'merchandise_subtotal' => '100.00', 'shipping_fee' => '0.00', 'discount_total' => '0.00',
            'shipping_discount_total' => '0.00', 'payable_total' => '100.00', 'placed_at' => now()]);
        $order->items()->create(['product_name' => 'Purchased basket', 'sku' => 'BASKET-SNAP', 'quantity' => 2,
            'unit_price' => '50.00', 'line_subtotal' => '100.00', 'currency' => 'PHP']);
        $order->address()->create(['recipient_name' => 'Buyer snapshot', 'contact_number' => '09171234567',
            'address_line_1' => '1 Test Street', 'barangay' => 'Test', 'city_municipality' => 'Manila',
            'province' => 'Metro Manila', 'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH']);

        return $order;
    }

    private function path(array $ids): string
    {
        return '/api/v1/seller/orders/picking-sheet.pdf?'.http_build_query(['order_ids' => $ids]);
    }
}
