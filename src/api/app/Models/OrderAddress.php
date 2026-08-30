<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderAddress extends Model
{
    use HasUuids;

    protected $fillable = [
        'order_id', 'source_address_id', 'recipient_name', 'contact_number', 'address_line_1',
        'address_line_2', 'barangay', 'city_municipality', 'province', 'region', 'postal_code',
        'country', 'latitude', 'longitude',
    ];

    protected function casts(): array
    {
        return ['latitude' => 'decimal:7', 'longitude' => 'decimal:7'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
