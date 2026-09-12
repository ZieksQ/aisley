<?php

namespace App\Models;

use App\Enums\FulfillmentOfferStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryTaskOffer extends Model
{
    use HasUuids;

    protected $fillable = [
        'delivery_task_id', 'courier_id', 'logistics_organization_id', 'offered_by_logistics_id',
        'sequence', 'status', 'idempotency_key', 'request_hash', 'rejection_reason', 'offered_at', 'responded_at',
    ];

    protected function casts(): array
    {
        return ['status' => FulfillmentOfferStatus::class, 'sequence' => 'integer', 'offered_at' => 'datetime', 'responded_at' => 'datetime'];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(DeliveryTask::class, 'delivery_task_id');
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function offeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'offered_by_logistics_id');
    }
}
