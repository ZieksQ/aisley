<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AddressCoordinateDefault extends Model
{
    use HasUuids;

    protected $fillable = ['country', 'region', 'province', 'city_municipality', 'barangay', 'latitude', 'longitude', 'is_active'];

    protected function casts(): array
    {
        return ['latitude' => 'decimal:7', 'longitude' => 'decimal:7', 'is_active' => 'boolean'];
    }
}
