<?php

namespace App\Models;

use App\Enums\UserSex;
use App\Models\Concerns\HasBirthDateAge;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LogisticsProfile extends Model
{
    use HasBirthDateAge, HasUuids;

    protected $fillable = ['user_id', 'first_name', 'last_name', 'middle_name', 'contact_number', 'sex', 'birth_date'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return ['sex' => UserSex::class, 'birth_date' => 'date'];
    }
}
