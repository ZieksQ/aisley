<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\HubServiceArea;
use App\Models\LogisticsOrganization;
use App\Models\Shop;
use App\Models\ShopLogisticsProvider;
use App\Models\User;
use App\Services\Logistics\Sorting\SortingLocks;
use App\Services\Logistics\SortingPlanService;
use Database\Seeders\PhilippinesLogistics\RegionalPostalLaneSeeder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Explicit NCR-only provider selection for the initial development Shop. */
class InitialSellerLogisticsSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('Initial Seller demo logistics were not configured in production.');

            return;
        }

        DB::transaction(function (): void {
            SortingLocks::network();
            $email = strtolower(trim((string) config('seller.initial.email')));
            $configured = $email !== '' && is_string(config('seller.initial.password')) && config('seller.initial.password') !== '';
            $shop = Shop::query()->storefrontVisible()->where('slug', 'aisley-demo-store')
                ->whereHas('seller', fn ($seller) => $seller->where('email', $configured ? $email : 'catalog@aisley.test'))
                ->lockForUpdate()->first();
            if (! $shop) {
                return;
            }
            $organization = LogisticsOrganization::query()->whereHas('user', fn ($user) => $user
                ->where('email', 'logistics.luzon01@example.com')->where('role', UserRole::Logistics)->where('status', UserStatus::Active))
                ->whereHas('hub.address', fn ($address) => $address->where('region', 'National Capital Region (NCR)'))
                ->with('hub.address')->first();
            if (! $organization) {
                $this->command?->warn('Initial Seller provider selection needs the active NCR regional Logistics fixture. Existing selections were preserved.');

                return;
            }

            $provider = ShopLogisticsProvider::query()->firstOrCreate([
                'shop_id' => $shop->id, 'logistics_organization_id' => $organization->id,
            ], ['configured_by' => $shop->seller_id, 'is_enabled' => true]);
            foreach ($shop->logisticsProviders()->lockForUpdate()->get() as $row) {
                $enabled = $row->id === $provider->id;
                if ($row->is_enabled !== $enabled) {
                    $row->update(['is_enabled' => $enabled, 'configured_by' => $shop->seller_id, 'revision' => $row->revision + 1]);
                }
            }

            // Keep existing demo addresses usable with this provider; preserve other hubs' coverage.
            $addresses = $shop->seller->addresses()->where('is_default', true)->whereIn('type', ['shipping', 'both'])->get();
            $customer = User::query()->where('email', strtolower(trim((string) config('customer.initial.email'))))
                ->where('role', UserRole::Customer)->first();
            if ($customer) {
                $addresses = $addresses->concat($customer->addresses()->where('is_default', true)->whereIn('type', ['shipping', 'both'])->get());
            }
            foreach ($addresses as $address) {
                $postal = app(SortingPlanService::class)->normalizePostalCode((string) $address->postal_code);
                if ($address->region === 'National Capital Region (NCR)' && $postal !== null) {
                    HubServiceArea::query()->firstOrCreate([
                        'logistics_hub_id' => $organization->hub->id, 'postal_code' => $postal,
                    ], ['is_active' => true, 'revision' => 1, 'created_by' => $organization->user_id]);
                }
            }
            app(RegionalPostalLaneSeeder::class)->repair($organization->hub, fn ($message) => $this->command?->warn($message));
        }, 3);
    }
}
