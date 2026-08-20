<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['email', 'password', 'role', 'status'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'status' => UserStatus::class,
        ];
    }

    //relationships
    public function courierProfile() : HasOne
    {
        return $this->hasOne(CourierProfile::class);
    }

    public function sellerProfile() : HasOne
    {
        return $this->hasOne(SellerProfile::class);
    }

    public function customerProfile() : HasOne
    {
        return $this->hasOne(CustomerProfile::class);
    }

    public function adminProfile() : HasOne
    {
        return $this->hasOne(AdminProfile::class);
    }

    public function addresses() : HasMany
    {
        return $this->hasMany(Address::class);
    }

    // Get the default address for the user
    public function defaultAddress() : HasOne
    {
        return $this->hasOne(Address::class)->where('is_default', true);
    }
}
