<?php

namespace App\Models;

use App\Enums\HomepageCampaignPlacement;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class HomepageCampaign extends Model
{
    use HasFactory, HasUuids;

    public const CACHE_KEY = 'customer:homepage:campaigns';

    protected $fillable = [
        'homepage_advertisement_configuration_id',
        'placement',
        'slot',
        'title',
        'description',
        'image_disk',
        'image_desktop_path',
        'image_mobile_path',
        'alt_text',
        'destination_url',
        'starts_at',
        'ends_at',
        'priority',
        'position',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'placement' => HomepageCampaignPlacement::class,
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'priority' => 'integer',
            'position' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function advertisementConfiguration(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(HomepageAdvertisementConfiguration::class, 'homepage_advertisement_configuration_id');
    }

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::CACHE_KEY));
        static::deleted(fn () => Cache::forget(self::CACHE_KEY));
    }
}
