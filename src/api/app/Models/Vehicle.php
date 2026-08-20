<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    //
    protected $fillable = [
        'courier_id',
        'type',
        'model',
        'plate_number',
        'or_cr_image_url'
    ];

    protected $casts = [
        'user_id' => 'integer',
        'type' => 'string',
        'model' => 'string',
        'plate_number' => 'string',
        'or_cr_image_url' => 'string'
    ];

    public function courierProfile()
    {
        return $this->belongsTo(CourierProfile::class);
    }
}
