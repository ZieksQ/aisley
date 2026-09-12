<?php

namespace App\Models;

use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DeliveryTask extends Model
{
    use HasUuids;

    protected $fillable = [
        'shipment_id', 'leg', 'status', 'courier_id', 'legacy_first_mile_task_id', 'revision',
        'accepted_at', 'picked_up_at', 'in_transit_at', 'out_for_delivery_at', 'delivered_at',
    ];

    protected function casts(): array
    {
        return [
            'leg' => FulfillmentTaskLeg::class,
            'status' => FulfillmentTaskStatus::class,
            'revision' => 'integer',
            'accepted_at' => 'datetime',
            'picked_up_at' => 'datetime',
            'in_transit_at' => 'datetime',
            'out_for_delivery_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    public function legacyFirstMileTask(): BelongsTo
    {
        return $this->belongsTo(FirstMileTask::class, 'legacy_first_mile_task_id');
    }

    public function offers(): HasMany
    {
        return $this->hasMany(DeliveryTaskOffer::class);
    }

    public function evidence(): HasMany
    {
        return $this->hasMany(ShipmentEvidence::class);
    }

    public function completionIntents(): HasMany
    {
        return $this->hasMany(CompletionIntent::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(ShipmentEvent::class);
    }
}
