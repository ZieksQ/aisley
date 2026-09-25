<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SupportTicketIdempotencyReceipt extends Model
{
    use HasUuids;

    protected $fillable = [
        'actor_user_id', 'action', 'idempotency_key', 'payload_hash',
        'response_payload', 'response_status',
    ];

    protected function casts(): array
    {
        return ['response_payload' => 'array'];
    }
}
