<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderPricingSnapshot extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'billable_weight_grams' => 'integer', 'base_fee_cents' => 'integer',
            'additional_weight_fee_cents' => 'integer', 'destination_surcharge_cents' => 'integer',
            'quoted_shipping_fee_cents' => 'integer', 'shipping_subsidy_cents' => 'integer',
            'seller_commission_base_cents' => 'integer', 'seller_commission_cents' => 'integer',
            'seller_proceeds_cents' => 'integer', 'logistics_commission_cents' => 'integer',
            'logistics_pool_cents' => 'integer', 'cod_total_cents' => 'integer',
            'origin_snapshot' => 'array', 'destination_snapshot' => 'array', 'line_inputs' => 'array',
            'voucher_funding' => 'array', 'eligible_logistics_organization_ids' => 'array',
            'snapshotted_at' => 'immutable_datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function rate(): BelongsTo
    {
        return $this->belongsTo(ShippingRateVersion::class, 'shipping_rate_version_id');
    }
}
