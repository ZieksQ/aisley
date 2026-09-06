<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerPickupRequestOrder extends Model
{
    use HasUuids;

    protected $fillable = ['seller_pickup_request_id', 'order_id', 'status_event_id'];

    public function sellerPickupRequest(): BelongsTo
    {
        return $this->belongsTo(SellerPickupRequest::class);
    }
}
