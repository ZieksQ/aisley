<?php

namespace App\Models;

use App\Enums\Admin\NotificationCampaignStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NotificationCampaign extends Model
{
    use HasUuids;

    protected $fillable = [
        'title', 'body', 'audience_key', 'destination_type', 'destination_id', 'destination_slug', 'status',
        'revision', 'created_by_admin_id', 'previewed_at', 'preview_revision',
        'preview_eligible_count', 'send_idempotency_hash', 'send_revision',
        'audience_cutoff_at', 'snapshot_count', 'delivered_count', 'skipped_count',
        'failed_count', 'confirmed_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => NotificationCampaignStatus::class,
            'revision' => 'integer',
            'preview_revision' => 'integer',
            'preview_eligible_count' => 'integer',
            'snapshot_count' => 'integer',
            'delivered_count' => 'integer',
            'skipped_count' => 'integer',
            'failed_count' => 'integer',
            'previewed_at' => 'datetime',
            'audience_cutoff_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_admin_id');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(NotificationCampaignRecipient::class, 'campaign_id');
    }
}
