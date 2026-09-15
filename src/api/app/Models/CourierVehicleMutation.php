<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourierVehicleMutation extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'courier_id', 'vehicle_id', 'action', 'idempotency_key', 'request_hash',
        'resulting_revision', 'response',
    ];

    protected function casts(): array
    {
        return ['resulting_revision' => 'integer', 'response' => 'array'];
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }
}
