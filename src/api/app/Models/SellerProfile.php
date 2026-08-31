<?php

namespace App\Models;

use App\Enums\UserSex;
use App\Models\Concerns\HasBirthDateAge;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SellerProfile extends Model
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
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasOne<Shop, $this>
     */
    public function shop(): HasOne
    {
        return $this->hasOne(Shop::class, 'seller_id', 'user_id');
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
        ];
    }
}
