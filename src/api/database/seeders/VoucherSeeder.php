<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Shop;
use App\Models\User;
use App\Models\Voucher;
use App\Services\Vouchers\VoucherMutationService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/** Published development offers using the normal authoring/version workflow. */
class VoucherSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('Demo vouchers were not seeded in production.');

            return;
        }

        $admin = User::query()->where('email', strtolower(trim((string) config('admin.initial.email'))))
            ->where('role', UserRole::Admin)->where('status', UserStatus::Active)->first();
        if ($admin && Gate::forUser($admin)->allows('create', Voucher::class)) {
            foreach ([
                ['AIS-DEMO-SHIP-50', 'Shipping saving of ₱50', 'shipping', 'fixed', 50, null, 300, 'automatic'],
                ['AIS-DEMO-FREE-SHIP', 'Free shipping up to ₱100', 'shipping', 'percent', 100, 100, 500, 'claim_required'],
                ['AIS-DEMO-PLATFORM-10', 'Platform 10% off, up to ₱200', 'discount', 'percent', 10, 200, 500, 'claim_required'],
                ['AIS-DEMO-PLATFORM-15', 'Platform 15% off, up to ₱500', 'discount', 'percent', 15, 500, 1500, 'automatic'],
            ] as $offer) {
                $this->publish($admin, $offer);
            }
        } else {
            $this->command?->warn('Platform vouchers need the configured active initial Admin with voucher management permissions.');
        }

        $email = strtolower(trim((string) config('seller.initial.email')));
        $configured = $email !== '' && is_string(config('seller.initial.password')) && config('seller.initial.password') !== '';
        $shop = Shop::query()->storefrontVisible()->where('slug', 'aisley-demo-store')
            ->whereHas('seller', fn ($seller) => $seller->where('email', $configured ? $email : 'catalog@aisley.test'))->first();
        if (! $shop) {
            $this->command?->warn('Seller vouchers need the initial Seller-owned, visible Aisley Demo Store.');

            return;
        }

        foreach ([
            ['AIS-DEMO-SHOP-10', 'Shop 10% off, up to ₱150', 'discount', 'percent', 10, 150, 500, 'claim_required'],
            ['AIS-DEMO-SHOP-15', 'Shop 15% off, up to ₱300', 'discount', 'percent', 15, 300, 1000, 'claim_required'],
        ] as $offer) {
            $this->publish($shop->seller, $offer);
        }
    }

    private function publish(User $actor, array $offer): void
    {
        [$code, $name, $benefit, $type, $value, $cap, $minimum, $distribution] = $offer;
        // Stable codes make reruns additive; never revive or rewrite existing offers/history.
        if (Voucher::query()->where('code', $code)->exists()) {
            return;
        }

        DB::transaction(function () use ($actor, $code, $name, $benefit, $type, $value, $cap, $minimum, $distribution): void {
            $service = app(VoucherMutationService::class);
            $draft = $service->execute($actor, 'create', null, [
                'idempotency_key' => (string) Str::uuid(), 'revision' => 0,
                'code' => $code, 'name' => $name, 'benefit_type' => $benefit,
                'value_type' => $type, 'value' => $value, 'maximum_discount' => $cap,
                'minimum_spend' => $minimum, 'distribution_mode' => $distribution,
                'starts_at' => now()->subMinute()->toISOString(), 'ends_at' => now()->addDays(30)->toISOString(),
                'global_limit' => 1000, 'per_customer_limit' => 3,
                'terms_summary' => "{$name}. Minimum spend ₱{$minimum} in one Shop before discounts. Cash on delivery only. Select at checkout; shipping savings cannot exceed the shipping fee.",
            ])['data'];
            $service->execute($actor, 'publish', $draft['id'], [
                'idempotency_key' => (string) Str::uuid(), 'revision' => $draft['revision'],
            ]);
        });
    }
}
