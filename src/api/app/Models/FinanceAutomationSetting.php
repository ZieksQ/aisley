<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FinanceAutomationSetting extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['cod_deadline_hours' => 'integer', 'seller_delay_hours' => 'integer', 'logistics_delay_hours' => 'integer', 'collection_enabled' => 'boolean', 'seller_payout_enabled' => 'boolean', 'logistics_payout_enabled' => 'boolean'];
    }
}
