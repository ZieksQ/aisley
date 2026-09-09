<?php

namespace App\Models;

use App\Enums\LogisticsMatchTier;
use App\Enums\ProviderDistanceStatus;
use App\Enums\SellerPickupRequestStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerPickupRequest extends Model
{
    use HasUuids;

    protected $fillable = ['shop_id', 'seller_id', 'logistics_organization_id', 'logistics_hub_id', 'status', 'pickup_date', 'idempotency_key', 'provider_match_tier', 'provider_distance_km', 'provider_distance_status', 'provider_distance_calculated_at', 'provider_source_fingerprint', 'provider_destination_fingerprint'];

    protected function casts(): array
    {
        return [
            'status' => SellerPickupRequestStatus::class,
            'pickup_date' => 'date',
            'provider_match_tier' => LogisticsMatchTier::class,
            'provider_distance_km' => 'decimal:3',
            'provider_distance_status' => ProviderDistanceStatus::class,
            'provider_distance_calculated_at' => 'datetime',
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(SellerPickupRequestOrder::class)->orderBy('position')->orderBy('id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function hub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'logistics_hub_id');
    }

    public function waybills(): HasMany
    {
        return $this->hasMany(Waybill::class);
    }
}
