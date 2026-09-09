<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerPickupRequestOrder extends Model
{
    use HasUuids;

    protected $fillable = ['seller_pickup_request_id', 'order_id', 'pickup_address_id', 'status_event_id', 'position'];

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    public function sellerPickupRequest(): BelongsTo
    {
        return $this->belongsTo(SellerPickupRequest::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function pickupAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'pickup_address_id');
    }
}
