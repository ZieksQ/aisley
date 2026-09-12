<?php

namespace App\Models;

use App\Enums\ShipmentEvidencePurpose;
use App\Enums\ShipmentEvidenceStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ShipmentEvidence extends Model
{
    use HasUuids;

    protected $table = 'shipment_evidence';

    protected $fillable = [
        'delivery_task_id', 'delivery_task_offer_id', 'waybill_id', 'courier_id', 'purpose', 'type',
        'safe_reference', 'identifier_hash', 'status', 'idempotency_key', 'request_hash', 'correlation_id',
        'validated_by_logistics_id', 'rejection_reason', 'metadata', 'submitted_at', 'validated_at',
    ];

    protected function casts(): array
    {
        return [
            'purpose' => ShipmentEvidencePurpose::class,
            'status' => ShipmentEvidenceStatus::class,
            'metadata' => 'array',
            'submitted_at' => 'datetime',
            'validated_at' => 'datetime',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(DeliveryTask::class, 'delivery_task_id');
    }

    public function offer(): BelongsTo
    {
        return $this->belongsTo(DeliveryTaskOffer::class, 'delivery_task_offer_id');
    }

    public function waybill(): BelongsTo
    {
        return $this->belongsTo(Waybill::class);
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    public function validatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by_logistics_id');
    }

    public function completionIntent(): HasOne
    {
        return $this->hasOne(CompletionIntent::class, 'shipment_evidence_id');
    }
}
