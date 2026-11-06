<?php

namespace App\Services\Onboarding;

use App\Enums\LogisticsRateCardStatus;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Product;
use App\Models\ShopLogisticsProvider;
use App\Models\User;
use Carbon\CarbonImmutable;
use Closure;

class DashboardSetupGuide
{
    /** @return array<string, mixed> */
    public function forUser(User $user): array
    {
        $seller = $user->role === UserRole::Seller;
        $tenant = $seller ? $user->shop()->first() : $user->logisticsOrganization()->first();
        $automatic = $seller ? [
            'product' => $tenant ? $this->check(fn () => Product::query()
                ->where('shop_id', $tenant->id)->where('status', '!=', ProductStatus::Archived)->exists()) : 'unavailable',
            'shipping' => $tenant ? $this->check(fn () => ShopLogisticsProvider::query()
                ->where('shop_id', $tenant->id)->where('is_enabled', true)
                ->whereHas('organization', fn ($query) => $query
                    ->whereHas('user', fn ($users) => $users->where('status', UserStatus::Active))
                    ->whereHas('hub'))->exists()) : 'unavailable',
        ] : [
            'rates' => $tenant ? $this->check(fn () => $tenant->rateCards()
                ->where('status', LogisticsRateCardStatus::Published)->exists()) : 'unavailable',
        ];

        return [
            'version' => 1,
            'tenant_id' => $tenant?->id,
            'auto_show' => $this->autoShow($user),
            'automatic' => $automatic,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    private function check(Closure $predicate): string
    {
        try {
            return $predicate() ? 'complete' : 'incomplete';
        } catch (\Throwable $exception) {
            report($exception);

            return 'unavailable';
        }
    }

    private function autoShow(User $user): bool
    {
        $cutoff = config('onboarding.dashboard_guide_launch_at');
        if (! is_string($cutoff) || ! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|\+00:00)$/', $cutoff)) {
            return false;
        }
        try {
            $instant = CarbonImmutable::parse($cutoff);
            if ($instant->format('Y-m-d\\TH:i:sP') !== str_replace('Z', '+00:00', $cutoff)) {
                return false;
            }

            return $user->created_at !== null && $user->created_at->gte($instant);
        } catch (\Throwable) {
            return false;
        }
    }
}
