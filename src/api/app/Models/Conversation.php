<?php

namespace App\Models;

use App\Enums\ConversationKind;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    use HasUuids;

    protected $fillable = [
        'kind', 'customer_user_id', 'seller_user_id', 'shop_id',
        'logistics_organization_id', 'logistics_hub_id', 'delivery_task_id',
        'courier_user_id', 'logistics_user_id', 'task_leg',
        'last_sequence', 'last_message_id', 'last_message_at',
    ];

    protected function casts(): array
    {
        return ['kind' => ConversationKind::class, 'last_sequence' => 'integer', 'last_message_at' => 'datetime'];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_user_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_user_id');
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_user_id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(DeliveryTask::class, 'delivery_task_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function lastMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'last_message_id');
    }
}
