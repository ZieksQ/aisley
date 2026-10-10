<?php

namespace Tests\Feature\Vouchers;

use App\Models\PlatformPolicy;
use App\Models\Shop;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherClaim;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CustomerVoucherCollectionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->startOfSecond());
    }

    private function offer(array $overrides = []): Voucher
    {
        return Voucher::create(array_replace([
            'name' => 'Everyday saving', 'code' => fake()->unique()->bothify('OFFER-########'),
            'issuer_type' => 'app', 'distribution_mode' => 'claim_required',
            'benefit_type' => 'discount', 'value_type' => 'fixed', 'value' => '20.00',
            'minimum_spend' => '100.00', 'starts_at' => now()->subHour(), 'ends_at' => now()->addDay(),
            'per_customer_limit' => 2, 'redeemed_count' => 0, 'is_active' => true, 'lifecycle' => 'published',
            'payment_method' => 'cod', 'eligibility_rules' => [], 'terms_summary' => 'COD savings.',
        ], $overrides));
    }

    private function customer(): User
    {
        $customer = User::factory()->create(['role' => 'customer', 'status' => 'active']);
        Sanctum::actingAs($customer);

        return $customer;
    }

    private function shop(): Shop
    {
        return Shop::create(['seller_id' => User::factory()->create(['role' => 'seller', 'status' => 'active'])->id, 'name' => 'Visible shop', 'slug' => fake()->unique()->slug(), 'status' => 'active']);
    }

    public function test_public_catalogue_is_untargeted_unpersonalized_bounded_and_stably_ordered(): void
    {
        $first = $this->offer(['ends_at' => now()->addHour()]);
        $second = $this->offer();
        $this->offer(['lifecycle' => 'draft']);
        $this->offer(['lifecycle' => 'ended']);
        $this->offer(['ends_at' => now()]);
        $targeted = $this->offer(['eligibility_rules' => ['customer_ids' => [fake()->uuid()]]]);
        $this->offer(['eligibility_rules' => ['excluded_customer_ids' => [fake()->uuid()]]]);
        $hidden = $this->shop();
        $hidden->update(['is_on_vacation' => true]);
        $this->offer(['issuer_type' => 'shop', 'shop_id' => $hidden->id]);
        $response = $this->getJson('/api/v1/customer/vouchers?limit=1')->assertOk()->assertHeader('Cache-Control', 'max-age=60, public')
            ->assertJsonPath('items.0.id', $first->id)->assertJsonPath('pagination.total', 2)->assertJsonPath('items.0.collected', null)
            ->assertJsonPath('items.0.remainingPersonalUses', null)->json('items.0');
        foreach (['customer_ids', 'excluded_customer_ids', 'eligibility_rules', 'redeemed_count', 'global_limit', 'draft', 'funding'] as $field) {
            $this->assertArrayNotHasKey($field, $response);
        }
        $this->getJson('/api/v1/customer/vouchers?limit=1&page=2')->assertOk()->assertJsonPath('items.0.id', $second->id);
        $this->getJson('/api/v1/customer/vouchers/'.$targeted->id)->assertNotFound();
        $this->getJson('/api/v1/customer/vouchers?limit=51')->assertUnprocessable();
        $this->getJson('/api/v1/customer/vouchers?issuer=admin')->assertUnprocessable();
        $this->getJson('/api/v1/customer/vouchers?customer_id='.fake()->uuid())->assertUnprocessable();
        $owner = $this->customer();
        VoucherClaim::create(['voucher_id' => $first->id, 'customer_id' => $owner->id, 'collected_at' => now()]);
        $this->getJson('/api/v1/customer/vouchers/'.$first->id)->assertOk()->assertJsonPath('data.collected', null);
    }

    public function test_collection_is_idempotent_does_not_consume_capacity_and_is_customer_owned(): void
    {
        $voucher = $this->offer(['global_limit' => 1]);
        $customer = $this->customer();
        $first = $this->postJson('/api/v1/customer/vouchers/'.$voucher->id.'/claim')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('data.collected', true)->json('data.collectedAt');
        $this->travel(2)->seconds();
        $this->postJson('/api/v1/customer/vouchers/'.$voucher->id.'/claim')->assertOk()->assertJsonPath('data.collectedAt', $first);
        $this->assertDatabaseCount('voucher_claims', 1);
        $this->assertSame(0, $voucher->fresh()->redeemed_count);
        $this->assertDatabaseCount('voucher_redemptions', 0);
        $this->getJson('/api/v1/customer/my-vouchers')->assertOk()->assertJsonPath('items.0.id', $voucher->id);
        $voucher->update(['is_active' => false]);
        $this->postJson('/api/v1/customer/vouchers/'.$voucher->id.'/claim')->assertOk()->assertJsonPath('data.collectedAt', $first);
        $this->getJson('/api/v1/customer/my-vouchers')->assertOk()->assertJsonPath('items.0.availabilityReason', 'VOUCHER_INACTIVE');
        $this->customer();
        $this->getJson('/api/v1/customer/my-vouchers')->assertOk()->assertJsonCount(0, 'items');
        $this->assertDatabaseHas('voucher_claims', ['customer_id' => $customer->id, 'voucher_id' => $voucher->id]);
    }

    public function test_shop_collection_cannot_be_used_through_platform_or_another_shop(): void
    {
        $shop = $this->shop();
        $other = $this->shop();
        $voucher = $this->offer(['issuer_type' => 'shop', 'shop_id' => $shop->id]);
        $this->getJson('/api/v1/customer/shops/'.$shop->slug.'/vouchers')->assertOk()->assertJsonPath('items.0.shop.id', $shop->id);
        $this->getJson('/api/v1/customer/shops/'.$other->slug.'/vouchers')->assertOk()->assertJsonCount(0, 'items');
        $this->customer();
        $this->postJson('/api/v1/customer/vouchers/'.$voucher->id.'/claim')->assertNotFound();
        $this->postJson('/api/v1/customer/shops/'.$other->slug.'/vouchers/'.$voucher->id.'/claim')->assertNotFound();
        $this->postJson('/api/v1/customer/shops/'.$shop->slug.'/vouchers/'.$voucher->id.'/claim')->assertOk();
        $platform = $this->offer();
        $this->postJson('/api/v1/customer/shops/'.$shop->slug.'/vouchers/'.$platform->id.'/claim')->assertNotFound();
        $shop->update(['is_on_vacation' => true]);
        $this->postJson('/api/v1/customer/shops/'.$shop->slug.'/vouchers/'.$voucher->id.'/claim')->assertNotFound();
        $this->getJson('/api/v1/customer/my-vouchers')->assertOk()->assertJsonPath('items.0.shop', null)->assertJsonPath('items.0.availabilityReason', 'VOUCHER_SHOP_UNAVAILABLE');
    }

    public static function unavailable(): array
    {
        return [
            'draft' => [['lifecycle' => 'draft'], 'VOUCHER_ENDED'],
            'ended' => [['lifecycle' => 'ended'], 'VOUCHER_ENDED'],
            'paused' => [['is_active' => false], 'VOUCHER_INACTIVE'],
            'global exhausted' => [['global_limit' => 1, 'redeemed_count' => 1], 'VOUCHER_EXHAUSTED'],
            'invalid limit' => [['per_customer_limit' => 0], 'VOUCHER_TERMS_INVALID'],
            'invalid percentage' => [['value_type' => 'percent', 'value' => 101], 'VOUCHER_TERMS_INVALID'],
        ];
    }

    #[DataProvider('unavailable')]
    public function test_unavailable_offers_cannot_be_collected(array $terms, string $reason): void
    {
        if (DB::getDriverName() === 'pgsql' && (isset($terms['per_customer_limit']) || isset($terms['value_type']))) {
            try {
                DB::transaction(fn () => $this->offer($terms));
                $this->fail('PostgreSQL must reject invalid voucher terms before collection.');
            } catch (QueryException $exception) {
                $this->assertSame('23514', $exception->getCode());
                $this->assertDatabaseCount('voucher_claims', 0);
            }

            return;
        }
        $voucher = $this->offer($terms);
        $this->customer();
        $this->postJson('/api/v1/customer/vouchers/'.$voucher->id.'/claim')->assertConflict()->assertJsonPath('code', $reason);
        $this->assertDatabaseCount('voucher_claims', 0);
    }

    public function test_schedule_is_start_inclusive_end_exclusive_and_targeting_is_private(): void
    {
        $customer = $this->customer();
        $voucher = $this->offer(['starts_at' => now()->addHour(), 'ends_at' => now()->addHours(2), 'eligibility_rules' => ['customer_ids' => [$customer->id]]]);
        $this->postJson('/api/v1/customer/vouchers/'.$voucher->id.'/claim')->assertConflict()->assertJsonPath('code', 'VOUCHER_NOT_STARTED');
        $this->getJson('/api/v1/customer/voucher-statuses?ids[]='.$voucher->id)->assertOk()->assertJsonPath('items.0.availabilityReason', 'VOUCHER_NOT_STARTED');
        $this->travel(1)->hours();
        $this->postJson('/api/v1/customer/vouchers/'.$voucher->id.'/claim')->assertOk();
        $this->travel(1)->hours();
        $this->getJson('/api/v1/customer/my-vouchers?status=history')->assertOk()->assertJsonPath('items.0.availabilityReason', 'VOUCHER_EXPIRED');
        $this->customer();
        $this->getJson('/api/v1/customer/voucher-statuses?ids[]='.$voucher->id)->assertOk()->assertJsonCount(0, 'items');
        $targeted = $this->offer(['eligibility_rules' => ['customer_ids' => [$customer->id]]]);
        $this->postJson('/api/v1/customer/vouchers/'.$targeted->id.'/claim')->assertConflict()->assertJsonPath('code', 'VOUCHER_CUSTOMER_INELIGIBLE');
    }

    public function test_automatic_offers_are_derived_for_new_accounts_without_expired_unreceived_history(): void
    {
        $automatic = $this->offer(['distribution_mode' => 'automatic']);
        $upcoming = $this->offer(['distribution_mode' => 'automatic', 'starts_at' => now()->addHour()]);
        $this->offer(['distribution_mode' => 'automatic', 'ends_at' => now()]);
        $this->offer(['distribution_mode' => 'automatic', 'eligibility_rules' => ['customer_ids' => [fake()->uuid()]]]);
        foreach ([1, 2] as $account) {
            $this->customer();
            $this->getJson('/api/v1/customer/my-vouchers')->assertOk()->assertJsonCount(1, 'items')->assertJsonPath('items.0.id', $automatic->id)->assertJsonPath('items.0.collected', false);
            $this->getJson('/api/v1/customer/my-vouchers?status=upcoming')->assertOk()->assertJsonPath('items.0.id', $upcoming->id);
            $this->getJson('/api/v1/customer/my-vouchers?status=history')->assertOk()->assertJsonCount(0, 'items');
            $this->postJson('/api/v1/customer/vouchers/'.$automatic->id.'/claim')->assertOk()->assertJsonPath('data.distributionMode', 'automatic');
        }
        $this->assertDatabaseCount('voucher_claims', 0);
    }

    public function test_private_routes_require_active_customer_consent_and_bounded_ids(): void
    {
        $voucher = $this->offer();
        $this->getJson('/api/v1/customer/my-vouchers')->assertUnauthorized();
        $this->postJson('/api/v1/customer/vouchers/'.$voucher->id.'/claim')->assertUnauthorized();
        $this->getJson('/api/v1/customer/voucher-statuses?ids[]='.$voucher->id)->assertUnauthorized();
        foreach ([['seller', 'active'], ['admin', 'active'], ['logistics', 'active'], ['courier', 'active'], ['customer', 'suspended']] as [$role, $status]) {
            Sanctum::actingAs(User::factory()->create(compact('role', 'status')));
            $this->getJson('/api/v1/customer/my-vouchers')->assertForbidden();
            $this->postJson('/api/v1/customer/vouchers/'.$voucher->id.'/claim')->assertForbidden();
        }
        $this->customer();
        $this->getJson('/api/v1/customer/voucher-statuses?ids[]=bad')->assertUnprocessable();
        $ids = array_map(fn () => fake()->uuid(), range(1, 51));
        $this->getJson('/api/v1/customer/voucher-statuses?'.http_build_query(['ids' => $ids]))->assertUnprocessable();
        $this->getJson('/api/v1/customer/my-vouchers?status=bad')->assertUnprocessable();
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $policy = PlatformPolicy::create(['type' => 'terms_of_service']);
        $version = $policy->versions()->create(['version' => 1, 'title' => 'Terms', 'content' => 'Read these terms.', 'status' => 'published', 'revision' => 1, 'created_by_admin_id' => $admin->id, 'published_by_admin_id' => $admin->id, 'published_at' => now()]);
        $policy->update(['current_version_id' => $version->id]);
        $this->getJson('/api/v1/customer/my-vouchers')->assertForbidden()->assertJsonPath('code', 'POLICY_CONSENT_REQUIRED');
        $this->postJson('/api/v1/customer/vouchers/'.$voucher->id.'/claim')->assertForbidden();
    }

    public function test_collection_migration_backfills_only_live_projection(): void
    {
        $shop = $this->shop();
        $platform = $this->offer();
        $seller = $this->offer(['issuer_type' => 'shop', 'shop_id' => $shop->id]);
        $version = $platform->versions()->create(['number' => 1, 'state' => 'published', 'terms' => ['code' => $platform->code], 'published_at' => now()]);
        $bytes = DB::table('voucher_versions')->where('id', $version->id)->value('terms');
        $migration = require database_path('migrations/2026_10_11_000001_add_voucher_collection.php');
        $migration->down();
        $migration->up();
        $this->assertSame('automatic', $platform->fresh()->distribution_mode->value);
        $this->assertSame('claim_required', $seller->fresh()->distribution_mode->value);
        $this->assertSame($bytes, DB::table('voucher_versions')->where('id', $version->id)->value('terms'));
    }
}
