<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminProfile extends Model
{
    //
    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'middle_name',
        'profile_picture_url'
    ];

    protected function user() : BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
