<?php

namespace App\Models;

use App\Enums\Admin\NotificationCampaignRecipientStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationCampaignRecipient extends Model
{
    use HasUuids;

    protected $fillable = ['campaign_id', 'user_id', 'notification_id', 'status', 'attempt_count', 'last_error_category'];

    protected function casts(): array
    {
        return [
            'status' => NotificationCampaignRecipientStatus::class,
            'attempt_count' => 'integer',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(NotificationCampaign::class, 'campaign_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
