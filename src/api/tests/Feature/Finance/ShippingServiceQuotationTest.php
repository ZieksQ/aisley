<?php

namespace Tests\Feature\Finance;

use App\Exceptions\Customer\CheckoutException;
use App\Models\Address;
use App\Models\LogisticsOrganization;
use App\Models\LogisticsRateCard;
use App\Models\LogisticsShippingRateAcceptance;
use App\Models\Product;
use App\Models\ShippingRateVersion;
use App\Services\Finance\ShippingQuotationService;
use App\Services\Logistics\Routing\CheckoutRoutePlanner;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\ConfiguresCheckoutFinance;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class ShippingServiceQuotationTest extends TestCase
{
    use ConfiguresCheckoutFinance, HubRoutingFixtures, RefreshDatabase;

    private LogisticsOrganization $origin;

    private ShippingRateVersion $tariff;

    private Product $product;

    private Address $destination;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProductSeeder::class);
        $this->configureTestCheckoutFinance();
        $this->origin = LogisticsOrganization::query()->with('hub')->firstOrFail();
        $this->tariff = ShippingRateVersion::query()->firstOrFail();
        $this->tariff->update(['base_fee_cents' => 99999]);
        $this->tariff->regionSurcharges()->create(['destination_region' => 'NCR', 'normalized_region' => 'ncr', 'surcharge_cents' => 500]);
        $this->product = Product::where('slug', 'compact-everyday-camera')->firstOrFail();
        $this->destination = $this->origin->hub->address;
    }

    public function test_two_linehaul_hops_charge_service_base_once_per_leg_across_categories(): void
    {
        [, $middle] = $this->logistics();
        [, $last] = $this->logistics();
        $other = Product::where('category_id', '!=', $this->product->category_id)->firstOrFail();
        $categoryIds = [$this->product->category_id, $other->category_id];
        $this->card($this->origin, ['first_mile' => 100, 'linehaul' => 200], $categoryIds);
        $this->card($middle, ['linehaul' => 300], $categoryIds);
        $this->card($last, ['last_mile' => 400], $categoryIds);
        $route = $this->route($middle, $last);
        $this->mock(CheckoutRoutePlanner::class)->shouldReceive('plan')->andReturn($route);

        $quote = $this->quote([
            ['product' => $this->product, 'variant' => null, 'quantity' => 1],
            ['product' => $other, 'variant' => null, 'quantity' => 1],
        ]);

        // Each 600g category has one 100-cent weight step on every leg.
        $this->assertSame(2300, $quote['shipping_cents']);
        $this->assertSame(1000, $quote['base_fee_cents']);
        $this->assertSame(800, $quote['additional_weight_fee_cents']);
        $this->assertSame(500, $quote['destination_surcharge_cents']);
        $charges = $quote['logistics_charge_inputs'];
        $this->assertSame(['first_mile', 'linehaul', 'linehaul', 'last_mile'], array_column($charges, 'service_type'));
        $this->assertSame([$this->origin->id, $this->origin->id, $middle->id, $last->id], array_column($charges, 'organization_id'));
        $this->assertSame([300, 400, 500, 600], array_column($charges, 'quoted_charge_cents'));
        $this->assertSame([null, 1, 2, null], array_column($charges, 'hop_sequence'));
        foreach ($charges as $charge) {
            $this->assertCount(2, $charge['rate_rule_ids']);
            $this->assertNotEmpty($charge['service_rate_id']);
        }
    }

    public function test_missing_service_base_discards_all_leg_charges_in_unplanned_fallback(): void
    {
        $card = $this->card($this->origin, ['first_mile' => 100, 'last_mile' => 200], [$this->product->category_id]);
        $card->services()->where('service_type', 'last_mile')->delete();
        $this->mock(CheckoutRoutePlanner::class)->shouldReceive('plan')->andReturn($this->route());
        $quote = $this->quote();
        $this->assertSame(500, $quote['shipping_cents']);
        $this->assertSame(0, $quote['base_fee_cents']);
        $this->assertSame(0, $quote['additional_weight_fee_cents']);
        $this->assertSame([], $quote['logistics_charge_inputs']);
        $this->assertSame('unplanned', $quote['route_snapshot']['status']);
        $this->assertSame('ROUTE_SERVICE_RATE_UNAVAILABLE', $quote['route_snapshot']['failure_code']);
    }

    #[DataProvider('parcelLimits')]
    public function test_weight_and_dimension_limits_still_reject_instead_of_using_fallback(string $field, int $limit): void
    {
        $card = $this->card($this->origin, ['first_mile' => 100, 'last_mile' => 200], [$this->product->category_id]);
        $card->rules()->update([$field => $limit]);
        $this->mock(CheckoutRoutePlanner::class)->shouldReceive('plan')->andReturn($this->route());
        try {
            $this->quote();
            $this->fail('An oversized parcel must be rejected.');
        } catch (CheckoutException $exception) {
            $this->assertSame('ROUTE_RATE_LIMIT_EXCEEDED', $exception->errorCode);
        }
    }

    public function test_zero_service_base_and_weight_fees_are_valid_and_rate_changes_affect_quote_state(): void
    {
        $card = $this->card($this->origin, ['first_mile' => 0, 'last_mile' => 0], [$this->product->category_id]);
        $card->rules()->update(['additional_fee_cents' => 0]);
        $this->mock(CheckoutRoutePlanner::class)->shouldReceive('plan')->andReturn($this->route());
        $before = $this->quote();
        $this->assertSame(500, $before['shipping_cents']);
        $this->assertSame('local', $before['route_snapshot']['status']);
        $card->services()->where('service_type', 'first_mile')->update(['base_fee_cents' => 250]);
        $after = $this->quote();
        $this->assertSame(750, $after['shipping_cents']);
        $this->assertNotEquals($before['state'], $after['state']);
    }

    public function test_additive_migration_backfills_highest_legacy_base_per_service_without_rewriting_rules(): void
    {
        $other = Product::where('category_id', '!=', $this->product->category_id)->firstOrFail();
        $card = $this->card($this->origin, ['first_mile' => 100], [$this->product->category_id, $other->category_id]);
        $card->rules()->where('category_id', $this->product->category_id)->update(['base_charge_cents' => 200]);
        $card->rules()->where('category_id', $other->category_id)->update(['base_charge_cents' => 300]);
        $migration = require database_path('migrations/2026_10_03_000001_add_logistics_service_base_fees.php');
        $migration->down();
        $migration->up();
        $this->assertDatabaseHas('logistics_service_rates', ['logistics_rate_card_id' => $card->id, 'service_type' => 'first_mile', 'base_fee_cents' => 300]);
        $this->assertDatabaseHas('logistics_rate_rules', ['logistics_rate_card_id' => $card->id, 'category_id' => $this->product->category_id, 'base_charge_cents' => 200]);
        $this->assertDatabaseHas('shipping_rate_versions', ['id' => $this->tariff->id, 'base_fee_cents' => 99999]);
    }

    public static function parcelLimits(): array
    {
        return [
            'weight' => ['max_weight_grams', 100],
            'length' => ['max_length_mm', 100],
            'width' => ['max_width_mm', 100],
            'height' => ['max_height_mm', 50],
        ];
    }

    private function quote(?array $lines = null): array
    {
        return app(ShippingQuotationService::class)->quote($this->product->shop, $this->destination,
            $lines ?? [['product' => $this->product, 'variant' => null, 'quantity' => 1]], $this->origin->id);
    }

    private function card(LogisticsOrganization $organization, array $services, array $categoryIds): LogisticsRateCard
    {
        LogisticsShippingRateAcceptance::firstOrCreate([
            'shipping_rate_version_id' => $this->tariff->id, 'logistics_organization_id' => $organization->id,
        ], ['accepted_at' => now(), 'accepted_by' => $organization->user_id]);
        $card = LogisticsRateCard::create([
            'logistics_organization_id' => $organization->id, 'version_number' => 1, 'status' => 'published',
            'currency' => 'PHP', 'effective_at' => now()->subHour(), 'published_at' => now()->subHour(),
        ]);
        foreach ($services as $type => $base) {
            $card->services()->create(['service_type' => $type, 'base_fee_cents' => $base]);
            foreach ($categoryIds as $categoryId) {
                $card->rules()->create([
                    'service_type' => $type, 'category_id' => $categoryId, 'base_charge_cents' => 99999,
                    'included_weight_grams' => 500, 'additional_weight_grams' => 500, 'additional_fee_cents' => 100,
                    'max_weight_grams' => 100000, 'max_length_mm' => 2000, 'max_width_mm' => 2000, 'max_height_mm' => 2000,
                ]);
            }
        }

        return $card;
    }

    private function route(?LogisticsOrganization $middle = null, ?LogisticsOrganization $last = null): array
    {
        $last ??= $this->origin;
        $hops = $middle === null ? [] : [
            ['from_organization_id' => $this->origin->id, 'from_hub_id' => $this->origin->hub->id, 'to_hub_id' => $middle->hub->id],
            ['from_organization_id' => $middle->id, 'from_hub_id' => $middle->hub->id, 'to_hub_id' => $last->hub->id],
        ];

        return [
            'status' => $middle === null ? 'local' : 'planned', 'failure_code' => null,
            'origin_organization_id' => $this->origin->id, 'origin_hub_id' => $this->origin->hub->id,
            'destination_organization_id' => $last->id, 'destination_hub_id' => $last->hub->id,
            'hops' => $hops, 'graph_revision' => 'test', 'sort_plans' => [],
        ];
    }
}
