<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends Model
{
    use HasUuids;

    protected $fillable = ['conversation_id', 'sender_user_id', 'sequence', 'idempotency_key', 'payload_hash', 'body', 'product_id', 'order_id'];

    protected function casts(): array
    {
        return ['sequence' => 'integer'];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }
}
