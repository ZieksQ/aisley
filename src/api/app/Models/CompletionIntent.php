<?php

namespace App\Models;

use App\Enums\ShipmentEvidenceStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompletionIntent extends Model
{
    use HasUuids;

    protected $fillable = [
        'delivery_task_id', 'shipment_evidence_id', 'courier_id', 'expected_revision', 'status',
        'idempotency_key', 'request_hash', 'confirmed_at', 'validated_at', 'validated_by_logistics_id',
    ];

    protected function casts(): array
    {
        return ['status' => ShipmentEvidenceStatus::class, 'expected_revision' => 'integer', 'confirmed_at' => 'datetime', 'validated_at' => 'datetime'];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(DeliveryTask::class, 'delivery_task_id');
    }

    public function evidence(): BelongsTo
    {
        return $this->belongsTo(ShipmentEvidence::class, 'shipment_evidence_id');
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    public function validatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by_logistics_id');
    }
}
