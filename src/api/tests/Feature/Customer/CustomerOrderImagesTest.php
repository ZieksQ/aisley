<?php

namespace Tests\Feature\Customer;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Address;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Models\User;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\ConfiguresCheckoutFinance;
use Tests\TestCase;

class CustomerOrderImagesTest extends TestCase
{
    use ConfiguresCheckoutFinance, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProductSeeder::class);
        $this->configureTestCheckoutFinance();
    }

    /** @return array<string, array{string}> */
    public static function imageCases(): array
    {
        return array_combine(
            $cases = ['variant', 'default', 'first_gallery', 'pending_variant', 'rejected_variant',
                'deleted_variant_media', 'foreign_variant_media', 'pending_default', 'no_media'],
            array_map(fn (string $case) => [$case], $cases),
        );
    }

    #[DataProvider('imageCases')]
    public function test_image_projection_is_consistent_across_quote_placement_history_detail_and_batch(string $case): void
    {
        [$customer, $product, $variant, $input] = $this->checkout();
        $product->media()->forceDelete();
        $product->update(['thumbnail_path' => null]);
        $variant->update(['primary_media_id' => null]);
        $expected = null;

        if ($case !== 'no_media') {
            $first = $this->media($product, ['position' => 0]);
            $default = $this->media($product, ['position' => 1, 'is_default' => true]);
            $expected = $default;

            if ($case === 'first_gallery') {
                $default->delete();
                $expected = $first;
            } elseif ($case === 'pending_default') {
                $default->update(['scan_status' => 'pending']);
                $expected = $first;
            } elseif (! in_array($case, ['default', 'first_gallery'], true)) {
                $owner = $case === 'foreign_variant_media'
                    ? Product::where('slug', 'compact-everyday-camera')->firstOrFail()
                    : $product;
                $media = $this->media($owner, ['product_variant_id' => $variant->id]);
                $variant->update(['primary_media_id' => $media->id]);

                if ($case === 'variant') {
                    $expected = $media;
                } elseif (in_array($case, ['pending_variant', 'rejected_variant'], true)) {
                    $media->update(['scan_status' => $case === 'pending_variant' ? 'pending' : 'rejected']);
                } elseif ($case === 'deleted_variant_media') {
                    $media->delete();
                }
            }
        }

        $imageUrl = $expected === null ? null : url('/api/v1/product-media/'.$expected->id);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $input)
            ->assertOk()
            ->assertJsonPath('data.groups.0.items.0.imageUrl', $imageUrl)
            ->json('data');
        $payload = [...$input, 'quote_id' => $quote['quoteId']];
        $key = (string) Str::uuid();
        $batch = $this->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/customer/checkout/place', $payload)
            ->assertOk()
            ->assertJsonPath('data.orders.0.items.0.imageUrl', $imageUrl)
            ->json('data');

        $this->assertImages($batch, $imageUrl);
        $this->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/customer/checkout/place', $payload)
            ->assertOk()
            ->assertJsonPath('data.id', $batch['id'])
            ->assertJsonPath('data.orders.0.items.0.imageUrl', $imageUrl);
        $this->assertDatabaseCount('orders', 1);

        // Media changes affect the current projection, never purchased facts.
        $item = Order::findOrFail($batch['orders'][0]['id'])->items()->firstOrFail();
        $snapshot = $item->getAttributes();
        $product->delete();
        $this->assertImages($batch, null);
        $this->assertSame($snapshot, $item->fresh()->getAttributes());

        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]));
        $this->getJson('/api/v1/customer/orders')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/customer/orders/'.$item->order_id)->assertNotFound();
        $this->getJson('/api/v1/customer/checkout/'.$batch['id'])->assertNotFound();
        $this->assertSame($customer->id, $item->order->customer_id);
    }

    public function test_removed_variant_uses_product_default_and_missing_product_ids_keep_snapshots_readable(): void
    {
        [, $product, $variant, $input] = $this->checkout();
        $product->media()->forceDelete();
        $default = $this->media($product, ['is_default' => true]);
        $variant->update(['primary_media_id' => null]);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $input)->assertOk()->json('data');
        $batch = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$input, 'quote_id' => $quote['quoteId']])
            ->assertOk()->json('data');

        $variant->delete();
        $this->assertImages($batch, url('/api/v1/product-media/'.$default->id));
        $item = Order::findOrFail($batch['orders'][0]['id'])->items()->firstOrFail();
        $item->update(['product_id' => null, 'product_variant_id' => null]);
        $this->assertImages($batch, null);
    }

    /** @param array<string, mixed> $batch */
    private function assertImages(array $batch, ?string $url): void
    {
        $this->getJson('/api/v1/customer/orders')->assertOk()
            ->assertJsonPath('data.0.itemPreview.imageUrl', $url)
            ->assertJsonPath('data.0.itemPreview.productName', $batch['orders'][0]['items'][0]['productName']);
        $this->getJson('/api/v1/customer/orders/'.$batch['orders'][0]['id'])->assertOk()
            ->assertJsonPath('data.items.0.imageUrl', $url)
            ->assertJsonPath('data.items.0.productName', $batch['orders'][0]['items'][0]['productName'])
            ->assertJsonPath('data.items.0.unitPrice', $batch['orders'][0]['items'][0]['unitPrice']);
        $this->getJson('/api/v1/customer/checkout/'.$batch['id'])->assertOk()
            ->assertJsonPath('data.orders.0.items.0.imageUrl', $url)
            ->assertJsonPath('data.orders.0.items.0.quantity', 1);
    }

    /** @param array<string, mixed> $attributes */
    private function media(Product $product, array $attributes = []): ProductMedia
    {
        return $product->media()->create([
            'disk' => 'local', 'path' => 'synthetic/order-image-'.Str::uuid().'.png',
            'mime_type' => 'image/png', 'scan_status' => 'approved',
            'is_default' => false, 'position' => (int) $product->media()->withTrashed()->max('position') + 1, ...$attributes,
        ]);
    }

    /** @return array{User, Product, ProductVariant, array<string, mixed>} */
    private function checkout(): array
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($customer);
        $address = Address::create([
            'user_id' => $customer->id, 'type' => AddressType::Shipping, 'label' => 'Home',
            'recipient_name' => 'Ada Buyer', 'contact_number' => '09171234567',
            'address_line_1' => '123 Test Street', 'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City', 'province' => 'Metro Manila',
            'region' => 'NCR', 'postal_code' => '1203', 'country' => 'Philippines',
        ]);
        $variant = ProductVariant::where('sku', 'AWH-BLK')->firstOrFail();
        $variant->update(['unit_cost_cents' => 1000, 'cost_currency' => 'PHP']);
        $product = $variant->product;
        $input = [
            'mode' => 'buy_now',
            'buy_now' => ['product_id' => $product->id, 'variant_id' => $variant->id, 'quantity' => 1],
            'address_id' => $address->id, 'payment_method' => 'cod', 'vouchers' => [],
        ];

        return [$customer, $product, $variant, $input];
    }
}
