<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LogisticsShippingRateAcceptance extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['accepted_at' => 'immutable_datetime', 'revoked_at' => 'immutable_datetime'];
    }

    public function rate(): BelongsTo
    {
        return $this->belongsTo(ShippingRateVersion::class, 'shipping_rate_version_id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }
}
