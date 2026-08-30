<?php

namespace App\Models;

use App\Enums\AnnouncementStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    use HasUuids;

    public const ACTIVE_CACHE_KEY = 'platform:announcements:active';

    protected $fillable = ['title', 'body', 'status', 'revision', 'published_at', 'expires_at', 'created_by_admin_id', 'updated_by_admin_id'];

    protected function casts(): array
    {
        return ['status' => AnnouncementStatus::class, 'revision' => 'integer', 'published_at' => 'datetime', 'expires_at' => 'datetime'];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_admin_id');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_admin_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', AnnouncementStatus::Published)
            ->whereNotNull('published_at')->where('published_at', '<=', now())
            ->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }
}
