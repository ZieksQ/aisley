<?php

namespace App\Models;

use App\Enums\VehicleStatus;
use App\Enums\VehicleType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Vehicle extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'courier_profile_id',
        'plate_number',
        'type',
        'status',
        'make',
        'model',
        'capacity',
        'registration_document_path',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => VehicleType::class,
            'status' => VehicleStatus::class,
            'capacity' => 'decimal:2',
        ];
    }

    public function courierProfile(): BelongsTo
    {
        return $this->belongsTo(CourierProfile::class);
    }
}
