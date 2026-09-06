<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SellerOrderRejection extends Model
{
    use HasUuids;

    protected $fillable = ['order_id', 'seller_id', 'idempotency_key', 'status_event_id', 'reason'];
}
