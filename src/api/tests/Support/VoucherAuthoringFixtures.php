<?php

namespace Tests\Support;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Permission;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Support\Str;

trait VoucherAuthoringFixtures
{
    private function voucherActor(string $role = 'admin', bool $manage = true): User
    {
        $actor = User::factory()->create(['role' => UserRole::from($role), 'status' => UserStatus::Active]);
        if ($role === 'admin') {
            $actor->permissions()->attach(Permission::where('slug', 'vouchers.view')->firstOrFail());
            if ($manage) {
                $actor->permissions()->attach(Permission::where('slug', 'vouchers.manage')->firstOrFail());
            }
        } else {
            Shop::create(['seller_id' => $actor->id, 'name' => 'Voucher shop', 'slug' => (string) Str::uuid(), 'status' => 'active']);
        }
        $this->actingAs($actor);

        return $actor;
    }

    private function voucherTerms(array $overrides = []): array
    {
        return array_replace([
            'revision' => 0, 'name' => 'Everyday savings', 'code' => 'TEST-'.strtoupper(Str::random(8)), 'benefit_type' => 'discount',
            'value_type' => 'fixed', 'value' => '100.00', 'starts_at' => now()->subHour()->toISOString(),
            'ends_at' => now()->addDays(7)->toISOString(), 'terms_summary' => 'Save on all eligible items with COD.',
        ], $overrides);
    }

    private function draftVoucher(string $role = 'admin', array $terms = []): array
    {
        return $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/'.$role.'/vouchers', $this->voucherTerms($terms))->assertCreated()->json('data');
    }

    private function voucherAction(array $voucher, string $action, string $role = 'admin', ?string $key = null)
    {
        return $this->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())->postJson('/api/v1/'.$role.'/vouchers/'.$voucher['id'].'/'.$action, ['revision' => $voucher['revision']]);
    }
}
