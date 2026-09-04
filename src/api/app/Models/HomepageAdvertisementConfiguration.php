<?php

namespace App\Models;

use App\Enums\HomepageAdvertisementLayout;
use App\Enums\HomepageAdvertisementStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HomepageAdvertisementConfiguration extends Model
{
    use HasUuids;
    public const ACTIVE_CACHE_KEY = 'customer:homepage:advertisement-layer';
    protected $fillable = ['source_configuration_id', 'layout', 'rotation_interval_seconds', 'status', 'revision', 'created_by_admin_id', 'published_by_admin_id', 'published_at'];
    protected function casts(): array { return ['layout' => HomepageAdvertisementLayout::class, 'status' => HomepageAdvertisementStatus::class, 'rotation_interval_seconds' => 'integer', 'revision' => 'integer', 'published_at' => 'datetime']; }
    public function campaigns(): HasMany { return $this->hasMany(HomepageCampaign::class, 'homepage_advertisement_configuration_id'); }
}
