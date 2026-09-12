<?php

namespace App\Models;

use App\Enums\FirstMileTaskStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    use HasUuids;

    protected $fillable = [
        'checkout_batch_id', 'customer_id', 'shop_id', 'reference', 'status',
        'payment_method', 'payment_status', 'currency', 'merchandise_subtotal',
        'shipping_fee', 'discount_total', 'shipping_discount_total', 'payable_total', 'placed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'payment_method' => PaymentMethod::class,
            'payment_status' => PaymentStatus::class,
            'merchandise_subtotal' => 'decimal:2',
            'shipping_fee' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'shipping_discount_total' => 'decimal:2',
            'payable_total' => 'decimal:2',
            'placed_at' => 'datetime',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(CheckoutBatch::class, 'checkout_batch_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function address(): HasOne
    {
        return $this->hasOne(OrderAddress::class)->orderByDesc('version');
    }

    public function addressVersions(): HasMany
    {
        return $this->hasMany(OrderAddress::class)->orderBy('version');
    }

    public function customerOrderCancellation(): HasOne
    {
        return $this->hasOne(CustomerOrderCancellation::class);
    }

    public function customerOrderModifications(): HasMany
    {
        return $this->hasMany(CustomerOrderModification::class);
    }

    public function statusEvents(): HasMany
    {
        return $this->hasMany(OrderStatusEvent::class);
    }

    public function vouchers(): HasMany
    {
        return $this->hasMany(OrderVoucher::class);
    }

    public function pickupRequestOrder(): HasOne
    {
        return $this->hasOne(SellerPickupRequestOrder::class);
    }

    public function waybill(): HasOne
    {
        return $this->hasOne(Waybill::class);
    }

    public function parcel(): HasOne
    {
        return $this->hasOne(Parcel::class);
    }

    public function firstMileTask(): HasOne
    {
        return $this->hasOne(FirstMileTask::class)->whereIn('status', [
            FirstMileTaskStatus::Assigned,
            FirstMileTaskStatus::Accepted,
            FirstMileTaskStatus::PickedUp,
        ]);
    }
}
