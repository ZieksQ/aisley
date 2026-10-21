<?php

namespace Tests\Unit;

use Database\Seeders\PhilippinesLogistics\RegionalHubCatalog;
use Database\Seeders\PhilippinesLogistics\RegionalPostalCatalog;
use PHPUnit\Framework\TestCase;

class RegionalPostalCatalogTest extends TestCase
{
    public function test_snapshot_covers_every_region_with_valid_unique_lane_identities(): void
    {
        $total = 0;
        foreach (RegionalHubCatalog::hubs() as $hub) {
            $entries = RegionalPostalCatalog::forRegion($hub['slug']);
            $this->assertNotEmpty($entries);
            $this->assertArrayHasKey($hub['postal_code'], $entries);
            $this->assertCount(count($entries), array_unique(array_column($entries, 'code')));
            foreach ($entries as $postal => $entry) {
                $this->assertMatchesRegularExpression('/^\d{4}$/', $entry['postal_code']);
                $this->assertSame((string) $postal, $entry['postal_code']);
                $this->assertMatchesRegularExpression('/^[A-Z0-9][A-Z0-9_-]{1,23}$/', $entry['code']);
                $this->assertLessThanOrEqual(80, mb_strlen($entry['name']));
            }
            $total += count($entries);
        }
        $this->assertSame(1992, $total);
    }

    public function test_researched_codes_keep_current_region_boundaries_and_leading_zeroes(): void
    {
        $this->assertSame(['postal_code' => '4009', 'name' => 'Santa Cruz Lane', 'code' => 'STC-01'],
            RegionalPostalCatalog::forRegion('region-4a')['4009']);
        foreach (['6100', '6200', '6225'] as $postal) {
            $this->assertArrayHasKey($postal, RegionalPostalCatalog::forRegion('nir'));
        }
        $this->assertArrayNotHasKey('6100', RegionalPostalCatalog::forRegion('region-6'));
        $this->assertArrayNotHasKey('6225', RegionalPostalCatalog::forRegion('region-7'));
        foreach (['7300', '7400'] as $postal) {
            $this->assertArrayHasKey($postal, RegionalPostalCatalog::forRegion('region-9'));
            $this->assertArrayNotHasKey($postal, RegionalPostalCatalog::forRegion('barmm'));
        }
        $this->assertArrayHasKey('7302', RegionalPostalCatalog::forRegion('barmm'));
        $this->assertSame('0400', RegionalPostalCatalog::forRegion('ncr')['0400']['postal_code']);
        $this->assertArrayHasKey('9518', RegionalPostalCatalog::forRegion('region-12'));
        $this->assertArrayNotHasKey('9514', RegionalPostalCatalog::forRegion('region-13'));
    }
}
