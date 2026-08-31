<?php

namespace App\Models;

use App\Enums\AccountLifecycleAction;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountLifecycleEvent extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'action',
        'previous_status',
        'new_status',
        'reason',
        'acted_by_admin_id',
        'source_feature',
        'source_reference_type',
        'source_reference_id',
        'occurred_at',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acted_by_admin_id');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'action' => AccountLifecycleAction::class,
            'previous_status' => UserStatus::class,
            'new_status' => UserStatus::class,
            'occurred_at' => 'datetime',
        ];
    }
}
