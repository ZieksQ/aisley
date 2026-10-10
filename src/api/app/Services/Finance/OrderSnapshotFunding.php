<?php

namespace App\Services\Finance;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\OrderPricingSnapshot;

class OrderSnapshotFunding
{
    /** @return array{funding_cents: int, obligations_cents: int, difference_cents: int} */
    public function inspect(OrderPricingSnapshot $snapshot): array
    {
        $appFunding = collect($snapshot->voucher_funding)->where('issuer', 'app')
            ->sum(fn (array $entry) => (int) $entry['amount_cents']);
        $funding = $snapshot->cod_total_cents + $appFunding + $snapshot->shipping_subsidy_cents;
        $obligations = $snapshot->seller_proceeds_cents + $snapshot->seller_commission_cents
            + $snapshot->logistics_pool_cents + $snapshot->logistics_commission_cents;

        return [
            'funding_cents' => $funding,
            'obligations_cents' => $obligations,
            'difference_cents' => $obligations - $funding,
        ];
    }

    public function assertBalanced(?OrderPricingSnapshot $snapshot): void
    {
        if ($snapshot !== null && $this->inspect($snapshot)['difference_cents'] !== 0) {
            throw FulfillmentException::conflict(
                'ORDER_FUNDING_HOLD',
                'Delivery approval is on hold because the Order pricing is not fully funded. Contact Admin for funding review before retrying.',
            );
        }
    }
}
