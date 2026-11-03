<?php

namespace App\Models;

use App\Enums\UserSex;
use App\Models\Concerns\HasBirthDateAge;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerProfile extends Model
{
    use HasBirthDateAge, HasFactory, HasUuids;

    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'middle_name',
        'contact_number',
        'sex',
        'birth_date',
        'profile_photo_path',
        'profile_photo_disk',
        'profile_photo_mime',
        'profile_photo_size',
        'profile_photo_width',
        'profile_photo_height',
        'id_image_disk',
        'id_image_path',
        'id_image_mime',
        'id_image_size',
        'id_image_width',
        'id_image_height',
        'promotional_in_app_opted_in',
        'promotional_in_app_opted_in_at',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sex' => UserSex::class,
            'birth_date' => 'date',
            'profile_photo_size' => 'integer',
            'profile_photo_width' => 'integer',
            'profile_photo_height' => 'integer',
            'id_image_size' => 'integer',
            'id_image_width' => 'integer',
            'id_image_height' => 'integer',
            'promotional_in_app_opted_in' => 'boolean',
            'promotional_in_app_opted_in_at' => 'datetime',
        ];
    }
}
