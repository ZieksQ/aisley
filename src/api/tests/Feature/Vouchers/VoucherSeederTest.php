<?php

namespace Tests\Feature\Vouchers;

use App\Enums\UserRole;
use App\Models\Shop;
use App\Models\User;
use App\Models\Voucher;
use Database\Seeders\AdminPermissionSeeder;
use Database\Seeders\InitialAdminSeeder;
use Database\Seeders\VoucherSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VoucherSeederTest extends TestCase
{
    use RefreshDatabase;

    private Shop $shop;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.initial.email' => 'seed-admin@example.com', 'admin.initial.password' => 'test-password',
            'seller.initial.email' => 'seed-seller@example.com', 'seller.initial.password' => 'test-password']);
        $this->seed([AdminPermissionSeeder::class, InitialAdminSeeder::class]);
        $seller = User::factory()->create(['email' => 'seed-seller@example.com', 'role' => 'seller', 'status' => 'active']);
        $this->shop = Shop::create(['seller_id' => $seller->id, 'slug' => 'aisley-demo-store', 'name' => 'Demo Store', 'status' => 'active']);
    }

    public function test_seeded_offers_are_published_versioned_scoped_and_collectible(): void
    {
        $this->seed(VoucherSeeder::class);
        $this->assertDatabaseCount('vouchers', 6);
        $this->assertDatabaseCount('voucher_versions', 6);
        $this->assertDatabaseCount('voucher_actions', 12);
        $this->assertDatabaseCount('voucher_claims', 0);
        $this->assertDatabaseCount('voucher_redemptions', 0);
        $this->assertSame(2, Voucher::where('issuer_type', 'app')->where('benefit_type', 'shipping')->count());
        $this->assertSame(2, Voucher::where('issuer_type', 'app')->where('benefit_type', 'discount')->whereNotNull('maximum_discount')->count());
        $this->assertSame(2, $this->shop->vouchers()->where('distribution_mode', 'claim_required')->where('value_type', 'percent')->whereNotNull('maximum_discount')->count());
        foreach (Voucher::all() as $voucher) {
            $this->assertSame('published', $voucher->lifecycle->value);
            $this->assertTrue($voucher->is_active);
            $this->assertTrue(now()->between($voucher->starts_at, $voucher->ends_at));
            $this->assertSame(0, $voucher->redeemed_count);
            $this->assertSame(3, $voucher->per_customer_limit);
            $version = $voucher->versions()->sole();
            $this->assertSame('published', $version->state->value);
            $this->assertSame($voucher->maximum_discount, $version->terms['maximum_discount']);
            $this->assertSame($voucher->distribution_mode->value, $version->terms['distribution_mode']);
            $this->assertSame($voucher->issuer_type->value === 'app' ? UserRole::Admin : UserRole::Seller, User::findOrFail($version->actor_id)->role);
        }
        $this->getJson('/api/v1/customer/vouchers')->assertOk()->assertJsonPath('pagination.total', 6);
        $this->getJson('/api/v1/customer/shops/aisley-demo-store/vouchers')->assertOk()->assertJsonCount(2, 'items');
    }

    public function test_rerun_preserves_terms_expiry_publication_decisions_and_usage(): void
    {
        $this->seed(VoucherSeeder::class);
        $paused = Voucher::where('code', 'AIS-DEMO-PLATFORM-10')->firstOrFail();
        $paused->update(['is_active' => false, 'redeemed_count' => 2, 'name' => 'Operator name', 'value' => '5.00']);
        $ended = Voucher::where('code', 'AIS-DEMO-SHOP-10')->firstOrFail();
        $ended->update(['lifecycle' => 'ended', 'is_active' => false, 'ended_at' => now()]);
        $before = Voucher::orderBy('id')->get()->toArray();
        $this->travel(40)->days();
        $this->seed(VoucherSeeder::class);
        $this->assertSame($before, Voucher::orderBy('id')->get()->toArray());
        $this->assertDatabaseCount('voucher_versions', 6);
        $this->assertDatabaseCount('voucher_actions', 12);
        $this->assertDatabaseCount('voucher_mutation_receipts', 12);
    }

    public function test_missing_admin_permissions_do_not_bypass_authoring_authorization(): void
    {
        User::where('role', 'admin')->firstOrFail()->permissions()->detach();
        $this->seed(VoucherSeeder::class);
        $this->assertDatabaseCount('vouchers', 2);
        $this->assertSame(0, Voucher::where('issuer_type', 'app')->count());
    }

    public function test_a_foreign_demo_shop_is_not_given_initial_seller_vouchers(): void
    {
        $other = User::factory()->create(['role' => 'seller', 'status' => 'active']);
        $this->shop->update(['seller_id' => $other->id]);
        $this->seed(VoucherSeeder::class);
        $this->assertDatabaseCount('vouchers', 4);
        $this->assertSame(0, $this->shop->vouchers()->count());
    }

    public function test_existing_code_collision_is_preserved_without_adopting_or_publishing_it(): void
    {
        $existing = Voucher::create(['code' => 'AIS-DEMO-PLATFORM-10', 'name' => 'Existing draft', 'issuer_type' => 'app',
            'benefit_type' => 'discount', 'value_type' => 'fixed', 'value' => '9.00', 'minimum_spend' => 0,
            'starts_at' => now(), 'ends_at' => now()->addDay(), 'per_customer_limit' => 1, 'lifecycle' => 'draft', 'is_active' => false, 'terms_summary' => 'Existing terms.']);
        $before = $existing->fresh()->toArray();
        $this->seed(VoucherSeeder::class);
        $this->assertSame($before, $existing->fresh()->toArray());
        $this->assertSame(0, $existing->versions()->count());
        $this->assertDatabaseCount('vouchers', 6);
    }

    public function test_demo_vouchers_are_not_seeded_in_production(): void
    {
        $environment = app()->environment();
        app()->detectEnvironment(fn () => 'production');
        try {
            app(VoucherSeeder::class)->run();
        } finally {
            app()->detectEnvironment(fn () => $environment);
        }
        $this->assertDatabaseCount('vouchers', 0);
    }
}
