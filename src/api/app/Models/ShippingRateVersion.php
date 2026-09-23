<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShippingRateVersion extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'version_number' => 'integer', 'base_fee_cents' => 'integer',
            'included_weight_grams' => 'integer', 'additional_weight_grams' => 'integer',
            'additional_fee_cents' => 'integer', 'volumetric_divisor' => 'integer',
            'max_weight_grams' => 'integer', 'max_length_mm' => 'integer',
            'max_width_mm' => 'integer', 'max_height_mm' => 'integer',
            'destination_surcharge_cents' => 'integer', 'effective_at' => 'immutable_datetime',
            'published_at' => 'immutable_datetime', 'revision' => 'integer',
        ];
    }

    public function acceptances(): HasMany
    {
        return $this->hasMany(LogisticsShippingRateAcceptance::class);
    }
}
