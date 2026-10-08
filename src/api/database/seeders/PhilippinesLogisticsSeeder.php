<?php

namespace Database\Seeders;

use App\Services\Finance\Gateway\LogisticsBillingService;
use App\Services\Logistics\Sorting\SortingLocks;
use Database\Seeders\PhilippinesLogistics\RegionalAccountSeeder;
use Database\Seeders\PhilippinesLogistics\RegionalHubCatalog;
use Database\Seeders\PhilippinesLogistics\RegionalNetworkSeeder;
use Database\Seeders\PhilippinesLogistics\RegionalRateSeeder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Complete, additive development network for all eighteen Philippine regions. */
class PhilippinesLogisticsSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('Philippines Logistics development fixtures were not seeded in production.');

            return;
        }

        DB::transaction(function (): void {
            SortingLocks::network();
            $this->call(MarketplaceCategorySeeder::class);
            $hubs = [];
            $definitions = RegionalHubCatalog::hubs();
            foreach ($definitions as $index => $definition) {
                $hub = app(RegionalAccountSeeder::class)->seed($definition, $index + 1);
                $hub->load('organization.user');
                $hubs[$definition['slug']] = $hub;
                // DatabaseSeeder suppresses model events; provision explicitly too.
                app(LogisticsBillingService::class)->provision($hub->organization);
            }

            $network = app(RegionalNetworkSeeder::class);
            $network->connect($hubs);
            $warn = fn (string $message) => $this->command?->warn($message);
            foreach ($definitions as $index => $definition) {
                $hub = $hubs[$definition['slug']];
                $network->configure($hub, $definition, $index + 1, $warn);
                app(RegionalRateSeeder::class)->seed($hub->organization, $warn);
            }
        }, 3);
    }
}
