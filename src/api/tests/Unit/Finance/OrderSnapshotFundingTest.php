<?php

namespace Tests\Unit\Finance;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\OrderPricingSnapshot;
use App\Services\Finance\OrderSnapshotFunding;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class OrderSnapshotFundingTest extends TestCase
{
    public static function fundingCases(): array
    {
        return [
            'audit historical shortfall' => [1000, 0, 0, 0, 100, 1800, 200, 1100],
            'exact funding zero seller' => [2100, 0, 0, 0, 100, 1800, 200, 0],
            'positive seller proceeds' => [2200, 0, 0, 100, 100, 1800, 200, 0],
            'app funding and subsidy' => [0, 2100, 5, 0, 101, 1804, 200, 0],
            'zero shipping' => [1000, 0, 0, 900, 100, 0, 0, 0],
            'all zero' => [0, 0, 0, 0, 0, 0, 0, 0],
            'one cent shortfall' => [2099, 0, 0, 0, 100, 1800, 200, 1],
            'one cent surplus' => [2101, 0, 0, 0, 100, 1800, 200, -1],
        ];
    }

    #[DataProvider('fundingCases')]
    public function test_frozen_funding_conservation(int $cod, int $app, int $subsidy, int $seller, int $sellerCommission, int $pool, int $logisticsCommission, int $difference): void
    {
        $snapshot = new OrderPricingSnapshot([
            'cod_total_cents' => $cod, 'shipping_subsidy_cents' => $subsidy,
            'seller_proceeds_cents' => $seller, 'seller_commission_cents' => $sellerCommission,
            'logistics_pool_cents' => $pool, 'logistics_commission_cents' => $logisticsCommission,
            'voucher_funding' => [
                ['issuer' => 'shop', 'amount_cents' => 2000],
                ['issuer' => 'app', 'amount_cents' => $app],
            ],
        ]);
        $before = $snapshot->getAttributes();
        $funding = new OrderSnapshotFunding;
        $this->assertSame([
            'funding_cents' => $cod + $app + $subsidy,
            'obligations_cents' => $seller + $sellerCommission + $pool + $logisticsCommission,
            'difference_cents' => $difference,
        ], $funding->inspect($snapshot));
        try {
            $funding->assertBalanced($snapshot);
            $this->assertSame(0, $difference);
        } catch (FulfillmentException $error) {
            $this->assertNotSame(0, $difference);
            $this->assertSame(['ORDER_FUNDING_HOLD', 409], [$error->errorCode, $error->status]);
        }
        $this->assertSame($before, $snapshot->getAttributes());
    }

    public function test_missing_historical_snapshot_preserves_compatibility(): void
    {
        (new OrderSnapshotFunding)->assertBalanced(null);
        $this->expectNotToPerformAssertions();
    }
}
