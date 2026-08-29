<?php

namespace App\Models;

use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'shop_id',
        'category_id',
        'name',
        'slug',
        'short_description',
        'description_markdown',
        'specifications',
        'thumbnail_disk',
        'thumbnail_path',
        'price',
        'original_price',
        'stock_quantity',
        'average_rating',
        'review_count',
        'sold_count',
        'badges',
        'is_promoted',
        'status',
        'published_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'original_price' => 'decimal:2',
            'stock_quantity' => 'integer',
            'average_rating' => 'decimal:2',
            'review_count' => 'integer',
            'sold_count' => 'integer',
            'badges' => 'array',
            'specifications' => 'array',
            'is_promoted' => 'boolean',
            'status' => ProductStatus::class,
            'published_at' => 'datetime',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function flashDeals(): BelongsToMany
    {
        return $this->belongsToMany(FlashDeal::class, 'flash_deal_products')
            ->withPivot(['deal_price', 'deal_stock', 'sold_quantity'])
            ->withTimestamps();
    }

    public function recentViews(): HasMany
    {
        return $this->hasMany(RecentlyViewedProduct::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(ProductMedia::class)->orderBy('position');
    }

    public function optionGroups(): HasMany
    {
        return $this->hasMany(ProductOptionGroup::class)->orderBy('position');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function cartItems(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }

    /**
     * Limit products to records that may be exposed on the public storefront.
     *
     * @param  Builder<Product>  $query
     * @return Builder<Product>
     */
    public function scopeStorefrontVisible(Builder $query): Builder
    {
        return $query
            ->where('products.status', ProductStatus::Active)
            ->whereNotNull('products.published_at')
            ->where('products.published_at', '<=', now())
            ->whereHas('shop', fn (Builder $shop) => $shop
                ->where('status', ShopStatus::Active)
                ->where('is_on_vacation', false)
                ->whereHas('seller', fn (Builder $seller) => $seller
                    ->where('role', UserRole::Seller)
                    ->where('status', UserStatus::Active)));
    }

    /**
     * @param  Builder<Product>  $query
     * @return Builder<Product>
     */
    public function scopeStorefrontPurchasable(Builder $query): Builder
    {
        return $query->storefrontVisible()->where('products.stock_quantity', '>', 0);
    }
}
