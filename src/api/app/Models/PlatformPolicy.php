<?php

namespace App\Models;

use App\Enums\PlatformPolicyType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlatformPolicy extends Model
{
    use HasUuids;

    protected $fillable = ['type', 'current_version_id'];

    protected function casts(): array
    {
        return ['type' => PlatformPolicyType::class];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(PlatformPolicyVersion::class)->orderByDesc('version');
    }

    public function currentVersion(): BelongsTo
    {
        return $this->belongsTo(PlatformPolicyVersion::class, 'current_version_id');
    }

    public function cacheKey(): string
    {
        return 'platform:policy:'.$this->type->value.':current';
    }
}
