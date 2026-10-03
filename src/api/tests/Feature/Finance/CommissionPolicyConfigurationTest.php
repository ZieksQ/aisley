<?php

namespace Tests\Feature\Finance;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CommissionPolicy;
use App\Models\Permission;
use App\Models\User;
use App\Services\Finance\OrderPricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommissionPolicyConfigurationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->startOfSecond());
    }

    public function test_unscheduled_and_future_drafts_are_publishable_but_not_active(): void
    {
        $this->admin();
        $this->postJson('/api/v1/admin/commission-policies', ['beneficiary_type' => 'seller', 'rate_basis_points' => 500])
            ->assertCreated()->assertJsonPath('data.status', 'inactive')->assertJsonPath('data.can_publish', true)
            ->assertJsonPath('data.effective_at', null);
        $this->postJson('/api/v1/admin/commission-policies', [
            'beneficiary_type' => 'logistics', 'rate_basis_points' => 1000, 'effective_at' => now()->addDay()->toISOString(),
        ])->assertCreated()->assertJsonPath('data.status', 'scheduled')->assertJsonPath('data.can_publish', true);
        $this->getJson('/api/v1/admin/commission-policies')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonCount(2, 'data');
    }

    public function test_immediate_replacement_expires_only_its_own_beneficiary_and_cannot_be_republished(): void
    {
        $this->admin();
        foreach (['seller', 'logistics'] as $beneficiary) {
            $old = $this->policy($beneficiary);
            $other = $this->policy($beneficiary === 'seller' ? 'logistics' : 'seller');
            $draft = $this->policy($beneficiary, 'draft', null);
            $this->postJson('/api/v1/admin/commission-policies/'.$draft->id.'/publish')
                ->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.can_publish', false)
                ->assertJsonPath('data.effective_at', now()->toISOString());
            $history = collect($this->getJson('/api/v1/admin/commission-policies')->assertOk()->json('data'))->keyBy('id');
            $this->assertSame('expired', $history[$old->id]['status']);
            $this->assertSame('active', $history[$other->id]['status']);
            $this->assertSame(now()->toISOString(), $history[$old->id]['ends_at']);
            $this->postJson('/api/v1/admin/commission-policies/'.$old->id.'/publish')->assertConflict();
            $this->postJson('/api/v1/admin/commission-policies/'.$draft->id.'/publish')->assertConflict();
            CommissionPolicy::query()->delete();
        }
    }

    public function test_future_replacement_switches_at_the_exact_boundary_and_checkout_uses_the_same_policy(): void
    {
        $this->admin();
        $old = $this->policy('seller');
        $this->policy('logistics');
        $tomorrow = now()->addDay();
        $next = $this->policy('seller', 'draft', $tomorrow->toISOString());
        $this->postJson('/api/v1/admin/commission-policies/'.$next->id.'/publish')
            ->assertOk()->assertJsonPath('data.status', 'scheduled')->assertJsonPath('data.can_publish', false);
        $group = ['subtotal_cents' => 10000, 'shipping_cents' => 1000, 'applied_vouchers' => []];
        $this->assertSame($old->id, app(OrderPricingService::class)->calculate($group)['seller_policy']->id);
        $this->travelTo($tomorrow);
        $history = collect($this->getJson('/api/v1/admin/commission-policies')->assertOk()->json('data'))->keyBy('id');
        $this->assertSame('expired', $history[$old->id]['status']);
        $this->assertSame('active', $history[$next->id]['status']);
        $this->assertSame($next->id, app(OrderPricingService::class)->calculate($group)['seller_policy']->id);
    }

    public function test_out_of_order_publication_preserves_later_schedules_and_no_gaps(): void
    {
        $this->admin();
        $old = $this->policy('seller');
        $this->policy('logistics');
        $firstTime = now()->addDay();
        $lastTime = now()->addDays(3);
        $last = $this->policy('seller', 'draft', $lastTime->toISOString());
        $this->postJson('/api/v1/admin/commission-policies/'.$last->id.'/publish')->assertOk();
        $first = $this->policy('seller', 'draft', $firstTime->toISOString());
        $this->postJson('/api/v1/admin/commission-policies/'.$first->id.'/publish')->assertOk();
        $this->assertTrue($old->refresh()->ends_at->equalTo($firstTime));
        $this->assertTrue($first->refresh()->ends_at->equalTo($lastTime));
        $this->assertNull($last->refresh()->ends_at);
        $immediate = $this->policy('seller', 'draft', null);
        $this->postJson('/api/v1/admin/commission-policies/'.$immediate->id.'/publish')->assertOk();
        $this->assertTrue($immediate->refresh()->ends_at->equalTo($firstTime));
        $group = ['subtotal_cents' => 10000, 'shipping_cents' => 1000, 'applied_vouchers' => []];
        foreach ([[$firstTime, $first], [$lastTime, $last]] as [$time, $expected]) {
            $this->travelTo($time);
            $this->assertSame($expected->id, app(OrderPricingService::class)->calculate($group)['seller_policy']->id);
        }
    }

    public function test_a_past_effective_date_does_not_rewrite_the_published_timeline(): void
    {
        $this->admin();
        $old = $this->policy('seller');
        $draft = $this->policy('seller', 'draft', now()->subDays(3)->toISOString());
        $this->postJson('/api/v1/admin/commission-policies/'.$draft->id.'/publish')
            ->assertOk()->assertJsonPath('data.effective_at', now()->toISOString());
        $this->assertTrue($old->refresh()->ends_at->equalTo(now()));
    }

    public function test_equal_scheduled_times_have_only_one_active_policy(): void
    {
        $this->admin();
        $this->policy('seller');
        $time = now()->addDay();
        $first = $this->policy('seller', 'draft', $time->toISOString());
        $second = $this->policy('seller', 'draft', $time->toISOString());
        $this->postJson('/api/v1/admin/commission-policies/'.$first->id.'/publish')->assertOk();
        $this->postJson('/api/v1/admin/commission-policies/'.$second->id.'/publish')->assertOk();
        $this->travelTo($time);
        $history = collect($this->getJson('/api/v1/admin/commission-policies')->assertOk()->json('data'));
        $this->assertSame([$second->id], $history->where('status', 'active')->pluck('id')->all());
        $this->assertSame('expired', $history->firstWhere('id', $first->id)['status']);
    }

    public function test_validation_and_role_permission_boundaries_are_enforced(): void
    {
        $this->admin();
        $this->postJson('/api/v1/admin/commission-policies', [
            'beneficiary_type' => 'customer', 'rate_basis_points' => 10001, 'effective_at' => 'invalid',
        ])->assertUnprocessable()->assertJsonValidationErrors(['beneficiary_type', 'rate_basis_points', 'effective_at']);
        $this->admin(false);
        $draft = $this->policy('seller', 'draft', null);
        $this->getJson('/api/v1/admin/commission-policies')->assertOk();
        $this->postJson('/api/v1/admin/commission-policies', ['beneficiary_type' => 'seller', 'rate_basis_points' => 500])->assertForbidden();
        $this->postJson('/api/v1/admin/commission-policies/'.$draft->id.'/publish')->assertForbidden();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]));
        $this->getJson('/api/v1/admin/commission-policies')->assertForbidden();
        $this->postJson('/api/v1/admin/commission-policies/'.$draft->id.'/publish')->assertForbidden();
    }

    private function admin(bool $manage = true): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        foreach ($manage ? ['finance.view', 'finance.manage'] : ['finance.view'] as $slug) {
            $permission = Permission::firstOrCreate(['slug' => $slug], ['name' => $slug]);
            $admin->permissions()->attach($permission);
        }
        Sanctum::actingAs($admin);
    }

    private function policy(string $beneficiary, string $status = 'published', ?string $effective = 'past'): CommissionPolicy
    {
        return CommissionPolicy::create([
            'beneficiary_type' => $beneficiary, 'rate_basis_points' => 500, 'status' => $status,
            'effective_at' => $effective === 'past' ? now()->subDay() : $effective,
        ]);
    }
}
