<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourierProfile extends Model
{
    //
    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'middle_name',
        'contact_number',
        'sex',
        'birth_date',
        'profile_picture_url',
        'valid_id_url'
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date'
        ];
    }

    protected function user() : BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function vehicles()
    {
        return $this->hasMany(Vehicle::class);
    }

    public function age() : Attribute
    {
        return Attribute::make(
            get: fn () => $this->birth_date ? now()->diffInYears($this->birth_date) : null,
        );
    }
}
