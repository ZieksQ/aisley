<?php

namespace App\Models;

use App\Enums\CategoryStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

class ShopCategory extends Model
{
    use HasFactory, HasUuids;

    public const HOMEPAGE_CACHE_KEY = 'customer:homepage:main-categories:v1';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'status',
        'position',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => CategoryStatus::class,
            'position' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::HOMEPAGE_CACHE_KEY));
        static::deleted(fn () => Cache::forget(self::HOMEPAGE_CACHE_KEY));
    }

    public function shops(): HasMany
    {
        return $this->hasMany(Shop::class);
    }

    public function productCategories(): HasMany
    {
        return $this->hasMany(Category::class)->orderBy('position')->orderBy('name');
    }
}
