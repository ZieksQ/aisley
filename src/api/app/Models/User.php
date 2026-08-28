<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Enums\UserStatus;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['email', 'password', 'role', 'status'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUuids, Notifiable;

    public function customerProfile(): HasOne
    {
        return $this->hasOne(CustomerProfile::class);
    }

    public function sellerProfile(): HasOne
    {
        return $this->hasOne(SellerProfile::class);
    }

    public function courierProfile(): HasOne
    {
        return $this->hasOne(CourierProfile::class);
    }

    public function adminProfile(): HasOne
    {
        return $this->hasOne(AdminProfile::class);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
    }

    public function registrationApplications(): HasMany
    {
        return $this->hasMany(RegistrationApplication::class);
    }

    public function reviewedApplications(): HasMany
    {
        return $this->hasMany(RegistrationApplication::class, 'reviewer_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function reviewedDocuments(): HasMany
    {
        return $this->hasMany(Document::class, 'reviewer_id');
    }

    public function shop(): HasOne
    {
        return $this->hasOne(Shop::class, 'seller_id');
    }

    public function recentlyViewedProducts(): HasMany
    {
        return $this->hasMany(RecentlyViewedProduct::class);
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'admin_permissions', 'admin_id', 'permission_id')
            ->using(AdminPermission::class)
            ->withPivot(['id', 'granted_by'])
            ->withTimestamps();
    }

    public function grantedAdminPermissions(): HasMany
    {
        return $this->hasMany(AdminPermission::class, 'granted_by');
    }

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
}
