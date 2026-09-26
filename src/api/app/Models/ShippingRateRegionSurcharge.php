<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShippingRateRegionSurcharge extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['surcharge_cents' => 'integer'];
    }

    public function rate(): BelongsTo
    {
        return $this->belongsTo(ShippingRateVersion::class, 'shipping_rate_version_id');
    }
}
