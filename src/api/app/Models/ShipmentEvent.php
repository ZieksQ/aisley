<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShipmentEvent extends Model
{
    use HasUuids;

    protected $fillable = [
        'shipment_id', 'delivery_task_id', 'delivery_task_offer_id', 'shipment_evidence_id', 'event_type',
        'from_state', 'to_state', 'performing_courier_id', 'recorded_by_logistics_id', 'idempotency_key',
        'correlation_id', 'reason', 'metadata', 'occurred_at',
    ];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'occurred_at' => 'datetime'];
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(DeliveryTask::class, 'delivery_task_id');
    }

    public function offer(): BelongsTo
    {
        return $this->belongsTo(DeliveryTaskOffer::class, 'delivery_task_offer_id');
    }

    public function evidence(): BelongsTo
    {
        return $this->belongsTo(ShipmentEvidence::class, 'shipment_evidence_id');
    }

    public function performingCourier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performing_courier_id');
    }

    public function recordedByLogistics(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by_logistics_id');
    }
}
