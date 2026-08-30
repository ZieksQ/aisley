<?php

namespace App\Models;

use App\Enums\PlatformPolicyVersionStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlatformPolicyVersion extends Model
{
    use HasUuids;

    protected $fillable = ['platform_policy_id', 'source_policy_version_id', 'version', 'title', 'content', 'change_summary', 'status', 'requires_reconsent', 'revision', 'created_by_admin_id', 'published_by_admin_id', 'published_at'];

    protected function casts(): array
    {
        return ['status' => PlatformPolicyVersionStatus::class, 'requires_reconsent' => 'boolean', 'version' => 'integer', 'revision' => 'integer', 'published_at' => 'datetime'];
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(PlatformPolicy::class, 'platform_policy_id');
    }

    public function sourceVersion(): BelongsTo
    {
        return $this->belongsTo(self::class, 'source_policy_version_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_admin_id');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by_admin_id');
    }

    public function acceptances(): HasMany
    {
        return $this->hasMany(PolicyAcceptance::class);
    }
}
