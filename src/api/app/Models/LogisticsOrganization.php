<?php

namespace App\Models;

use App\Enums\DeliveryApprovalMode;
use App\Services\Finance\Gateway\LogisticsBillingService;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LogisticsOrganization extends Model
{
    use HasUuids;

    protected $fillable = ['user_id', 'business_name', 'delivery_approval_mode'];

    protected function casts(): array
    {
        return ['delivery_approval_mode' => DeliveryApprovalMode::class];
    }

    protected static function booted(): void
    {
        static::created(fn (self $organization) => app(LogisticsBillingService::class)->provision($organization));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function hub(): HasOne
    {
        return $this->hasOne(LogisticsHub::class, 'logistics_organization_id');
    }

    public function courierAffiliations(): HasMany
    {
        return $this->hasMany(CourierLogisticsAffiliation::class);
    }

    public function sortingLanes(): HasMany
    {
        return $this->hasMany(SortingLane::class);
    }

    public function sortingSessions(): HasMany
    {
        return $this->hasMany(SortingSession::class);
    }

    public function sortingPlans(): HasMany
    {
        return $this->hasMany(SortingPlan::class);
    }

    public function rateCards(): HasMany
    {
        return $this->hasMany(LogisticsRateCard::class);
    }
}
