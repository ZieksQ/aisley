<?php

namespace App\Models;

use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shop extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'seller_id',
        'shop_category_id',
        'name',
        'slug',
        'description',
        'status',
        'contact_email',
        'contact_number',
        'website',
        'logo_path',
        'banner_path',
        'is_on_vacation',
        'vacation_message',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ShopStatus::class,
            'is_on_vacation' => 'boolean',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function shopCategory(): BelongsTo
    {
        return $this->belongsTo(ShopCategory::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function vouchers(): HasMany
    {
        return $this->hasMany(Voucher::class);
    }

    public function lowStockAlerts(): HasMany
    {
        return $this->hasMany(LowStockAlert::class);
    }

    /**
     * Limit shops to records that may be exposed on the public storefront.
     *
     * @param  Builder<Shop>  $query
     * @return Builder<Shop>
     */
    public function scopeStorefrontVisible(Builder $query): Builder
    {
        return $query
            ->where('shops.status', ShopStatus::Active)
            ->where('shops.is_on_vacation', false)
            ->whereHas('seller', fn (Builder $seller) => $seller
                ->where('role', UserRole::Seller)
                ->where('status', UserStatus::Active));
    }
}
