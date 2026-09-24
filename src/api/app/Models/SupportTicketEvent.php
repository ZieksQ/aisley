<?php

namespace App\Models;

use App\Enums\SupportTicketEventType;
use App\Enums\SupportTicketStatus;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportTicketEvent extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'ticket_id', 'sequence', 'type', 'actor_user_id', 'actor_role',
        'body', 'from_status', 'to_status', 'from_assignee_user_id',
        'to_assignee_user_id', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => SupportTicketEventType::class,
            'actor_role' => UserRole::class,
            'from_status' => SupportTicketStatus::class,
            'to_status' => SupportTicketStatus::class,
            'created_at' => 'datetime',
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'ticket_id');
    }
}
