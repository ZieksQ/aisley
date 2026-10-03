<?php

namespace App\Models;

use App\Enums\LogisticsServiceType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LogisticsServiceRate extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['service_type' => LogisticsServiceType::class, 'base_fee_cents' => 'integer'];
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(LogisticsRateCard::class, 'logistics_rate_card_id');
    }
}
