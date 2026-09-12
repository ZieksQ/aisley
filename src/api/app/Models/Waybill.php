<?php

namespace App\Models;

use App\Enums\FirstMileTaskStatus;
use App\Enums\WaybillStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Waybill extends Model
{
    use HasUuids;

    protected $fillable = ['order_id', 'seller_pickup_request_id', 'shop_id', 'logistics_organization_id', 'logistics_hub_id', 'reference', 'qr_token_hash', 'status', 'template_version', 'snapshot_schema_version', 'content_checksum'];

    protected function casts(): array
    {
        return ['status' => WaybillStatus::class, 'template_version' => 'integer', 'snapshot_schema_version' => 'integer'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function pickupRequest(): BelongsTo
    {
        return $this->belongsTo(SellerPickupRequest::class, 'seller_pickup_request_id');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function hub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'logistics_hub_id');
    }

    public function snapshot(): HasOne
    {
        return $this->hasOne(WaybillSnapshot::class);
    }

    public function parcel(): HasOne
    {
        return $this->hasOne(Parcel::class);
    }

    public function firstMileTask(): HasOne
    {
        return $this->hasOne(FirstMileTask::class)->whereIn('status', [FirstMileTaskStatus::Assigned, FirstMileTaskStatus::Accepted, FirstMileTaskStatus::PickedUp]);
    }
}
