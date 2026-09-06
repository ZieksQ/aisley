<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerPickupRequest extends Model
{
    use HasUuids;

    protected $fillable = ['shop_id', 'seller_id', 'logistics_organization_id', 'status', 'pickup_date', 'idempotency_key'];

    protected function casts(): array
    {
        return ['pickup_date' => 'date'];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(SellerPickupRequestOrder::class);
    }
}
