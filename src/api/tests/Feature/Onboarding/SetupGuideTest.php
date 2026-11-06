<?php

namespace Tests\Feature\Onboarding;

use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\LogisticsRateCard;
use App\Models\PlatformPolicy;
use App\Models\Product;
use App\Models\ShopLogisticsProvider;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class SetupGuideTest extends TestCase
{
    use HubRoutingFixtures, RefreshDatabase;

    public function test_both_guides_require_active_correct_role_and_policy_consent(): void
    {
        foreach (['seller', 'logistics'] as $role) {
            $url = '/api/v1/'.$role.'/setup-guide';
            $this->getJson($url)->assertUnauthorized();
            foreach ([UserRole::Customer, UserRole::Admin, UserRole::Courier, $role === 'seller' ? UserRole::Logistics : UserRole::Seller] as $wrongRole) {
                $this->actingAs(User::factory()->create(['role' => $wrongRole, 'status' => UserStatus::Active]))
                    ->getJson($url)->assertForbidden()->assertJsonPath('code', 'FORBIDDEN_ROLE');
            }
            foreach ([UserStatus::Pending, UserStatus::Rejected, UserStatus::Suspended, UserStatus::Deactivated] as $status) {
                $this->actingAs(User::factory()->create(['role' => $role, 'status' => $status]))
                    ->getJson($url)->assertForbidden();
            }
            $this->app['auth']->forgetGuards();
        }
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $policy = PlatformPolicy::create(['type' => PlatformPolicyType::TermsOfService]);
        $version = $policy->versions()->create([
            'version' => 1, 'title' => 'Terms', 'content' => 'Read the terms.',
            'status' => PlatformPolicyVersionStatus::Published, 'requires_reconsent' => true,
            'revision' => 1, 'created_by_admin_id' => $admin->id, 'published_by_admin_id' => $admin->id, 'published_at' => now(),
        ]);
        $policy->update(['current_version_id' => $version->id]);
        foreach (['seller', 'logistics'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role, 'status' => UserStatus::Active]))
                ->getJson('/api/v1/'.$role.'/setup-guide')->assertForbidden()->assertJsonPath('code', 'POLICY_CONSENT_REQUIRED');
        }
    }

    public function test_new_account_cutoff_is_fixed_and_missing_or_invalid_config_is_opt_in(): void
    {
        $user = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active, 'created_at' => '2026-11-06 12:00:00']);
        foreach ([null => false, 'bad-date' => false, '2026-02-30T12:00:00Z' => false, '2026-11-06T12:00:00+00:00' => true, '2026-11-06T12:00:00Z' => true, '2026-11-06T12:00:01Z' => false] as $cutoff => $expected) {
            config(['onboarding.dashboard_guide_launch_at' => $cutoff]);
            $this->actingAs($user)->getJson('/api/v1/seller/setup-guide')->assertOk()
                ->assertJsonPath('auto_show', $expected)->assertJsonPath('tenant_id', null)
                ->assertJsonPath('automatic.product', 'unavailable')->assertJsonPath('automatic.shipping', 'unavailable');
        }
    }

    public function test_seller_checks_are_scoped_read_only_and_follow_current_product_and_provider_state(): void
    {
        [$seller, $shop] = $this->sellerShop();
        [$otherSeller, $otherShop] = $this->sellerShop();
        $provider = $this->logistics();
        $foreign = Product::create(['shop_id' => $otherShop->id, 'name' => 'Private product', 'slug' => 'private-product', 'price' => 100, 'stock_quantity' => 0, 'status' => ProductStatus::Active]);
        $setting = ShopLogisticsProvider::create(['shop_id' => $otherShop->id, 'logistics_organization_id' => $provider[1]->id, 'is_enabled' => true, 'configured_by' => $otherSeller->id]);
        $url = '/api/v1/seller/setup-guide?shop_id='.$otherShop->id;
        $this->actingAs($seller)->getJson($url)->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('tenant_id', $shop->id)
            ->assertExactJsonStructure(['version', 'tenant_id', 'auto_show', 'automatic' => ['product', 'shipping'], 'generated_at'])
            ->assertJsonPath('automatic.product', 'incomplete')->assertJsonPath('automatic.shipping', 'incomplete')
            ->assertDontSee($foreign->id)->assertDontSee('Private product');
        $product = $foreign->replicate()->fill(['shop_id' => $shop->id, 'slug' => 'own-draft', 'status' => ProductStatus::Draft]);
        $product->save();
        $setting->replicate()->fill(['shop_id' => $shop->id, 'configured_by' => $seller->id])->save();
        $before = $product->fresh()->getAttributes();
        $this->getJson($url)->assertOk()->assertJsonPath('automatic.product', 'complete')->assertJsonPath('automatic.shipping', 'complete');
        $this->assertSame($before, $product->fresh()->getAttributes());
        $product->update(['status' => ProductStatus::Archived]);
        $provider[0]->update(['status' => UserStatus::Suspended]);
        $this->getJson($url)->assertOk()->assertJsonPath('automatic.product', 'incomplete')->assertJsonPath('automatic.shipping', 'incomplete');
        $provider[0]->update(['status' => UserStatus::Active]);
        ShopLogisticsProvider::where('shop_id', $shop->id)->update(['is_enabled' => false]);
        $this->getJson($url)->assertOk()->assertJsonPath('automatic.shipping', 'incomplete');
    }

    public function test_rates_are_organization_scoped_and_published_future_cards_count_without_exposing_details(): void
    {
        $a = $this->logistics();
        $b = $this->logistics();
        $card = LogisticsRateCard::create(['logistics_organization_id' => $b[1]->id, 'version_number' => 1, 'status' => 'published', 'currency' => 'PHP', 'effective_at' => now()->addMonth()]);
        $url = '/api/v1/logistics/setup-guide?organization_id='.$b[1]->id;
        $this->actingAs($a[0])->getJson($url)->assertOk()->assertJsonPath('tenant_id', $a[1]->id)
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('automatic.rates', 'incomplete')->assertDontSee($card->id);
        $own = $card->replicate()->fill(['logistics_organization_id' => $a[1]->id, 'status' => 'draft']);
        $own->save();
        $this->getJson($url)->assertOk()->assertJsonPath('automatic.rates', 'incomplete');
        $own->update(['status' => 'published']);
        $this->getJson($url)->assertOk()->assertJsonPath('automatic.rates', 'complete');
        $own->update(['status' => 'archived']);
        $this->getJson($url)->assertOk()->assertJsonPath('automatic.rates', 'incomplete');
    }

    public function test_a_failed_source_is_unavailable_and_does_not_erase_other_checks(): void
    {
        [$seller] = $this->sellerShop();
        DB::listen(function (QueryExecuted $query): void {
            if (str_contains($query->sql, '"products"')) {
                throw new \RuntimeException('Product source unavailable');
            }
        });
        $this->actingAs($seller)->getJson('/api/v1/seller/setup-guide')->assertOk()
            ->assertJsonPath('automatic.product', 'unavailable')
            ->assertJsonPath('automatic.shipping', 'incomplete');
    }
}
