<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CourierCashReceipt extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['total_cents' => 'integer', 'received_at' => 'datetime'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(CourierCashReceiptItem::class);
    }

    public function credit(): HasOne
    {
        return $this->hasOne(CourierCashCredit::class);
    }
}
