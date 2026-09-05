<?php

namespace App\Models;

use App\Enums\CourierAffiliationStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourierLogisticsAffiliation extends Model
{
    use HasUuids;

    protected $fillable = ['courier_id', 'logistics_organization_id', 'logistics_hub_id', 'status', 'reviewer_id', 'reviewed_at', 'rejection_reason'];

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function hub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'logistics_hub_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    protected function casts(): array
    {
        return ['status' => CourierAffiliationStatus::class, 'reviewed_at' => 'datetime'];
    }
}
