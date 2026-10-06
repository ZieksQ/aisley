<?php

namespace App\Models;

use App\Enums\ChatAttachmentState;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatAttachment extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'state' => ChatAttachmentState::class,
            'byte_size' => 'integer',
            'position' => 'integer',
            'attempts' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'duration_seconds' => 'float',
            'expires_at' => 'datetime',
        ];
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}
