<?php

namespace App\Models;

use App\Enums\SupportTicketCategory;
use App\Enums\SupportTicketStatus;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    use HasUuids;

    protected $fillable = [
        'reference', 'requester_user_id', 'requester_role', 'assignee_user_id',
        'subject', 'category', 'status', 'revision', 'last_sequence',
        'last_activity_at', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'requester_role' => UserRole::class,
            'category' => SupportTicketCategory::class,
            'status' => SupportTicketStatus::class,
            'last_activity_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_user_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_user_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(SupportTicketEvent::class, 'ticket_id');
    }

    public function readMarkers(): HasMany
    {
        return $this->hasMany(SupportTicketReadMarker::class, 'ticket_id');
    }
}
