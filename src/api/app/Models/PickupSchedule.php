<?php

namespace App\Models;

use App\Enums\PickupScheduleStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PickupSchedule extends Model
{
    use HasUuids;

    protected $fillable = ['logistics_organization_id', 'logistics_hub_id', 'courier_id', 'reference', 'status', 'starts_at', 'ends_at', 'revision', 'idempotency_key'];

    protected function casts(): array
    {
        return ['status' => PickupScheduleStatus::class, 'starts_at' => 'datetime', 'ends_at' => 'datetime', 'revision' => 'integer'];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function hub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'logistics_hub_id');
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(PickupScheduleOrder::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(FirstMileTask::class);
    }

    public function reminders(): HasMany
    {
        return $this->hasMany(PickupScheduleReminder::class);
    }
}
