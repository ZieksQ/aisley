<?php

namespace App\Models;

use App\Enums\LogisticsServiceType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LogisticsRateRule extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected $hidden = ['base_charge_cents'];

    protected function casts(): array
    {
        return [
            'service_type' => LogisticsServiceType::class,
            'base_charge_cents' => 'integer',
            'included_weight_grams' => 'integer',
            'additional_weight_grams' => 'integer',
            'additional_fee_cents' => 'integer',
            'max_weight_grams' => 'integer',
            'max_length_mm' => 'integer',
            'max_width_mm' => 'integer',
            'max_height_mm' => 'integer',
        ];
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(LogisticsRateCard::class, 'logistics_rate_card_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function shopCategory(): BelongsTo
    {
        return $this->belongsTo(ShopCategory::class);
    }
}
