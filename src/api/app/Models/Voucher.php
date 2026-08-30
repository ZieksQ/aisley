<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Enums\VoucherBenefitType;
use App\Enums\VoucherIssuerType;
use App\Enums\VoucherValueType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Voucher extends Model
{
    use HasUuids;

    protected $fillable = [
        'code', 'issuer_type', 'shop_id', 'benefit_type', 'value_type', 'value',
        'maximum_discount', 'minimum_spend', 'starts_at', 'ends_at', 'global_limit',
        'per_customer_limit', 'redeemed_count', 'payment_method', 'eligibility_rules',
        'stacking_policy', 'terms_summary', 'version', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'issuer_type' => VoucherIssuerType::class,
            'benefit_type' => VoucherBenefitType::class,
            'value_type' => VoucherValueType::class,
            'payment_method' => PaymentMethod::class,
            'value' => 'decimal:2',
            'maximum_discount' => 'decimal:2',
            'minimum_spend' => 'decimal:2',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'global_limit' => 'integer',
            'per_customer_limit' => 'integer',
            'redeemed_count' => 'integer',
            'eligibility_rules' => 'array',
            'stacking_policy' => 'array',
            'version' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(VoucherRedemption::class);
    }
}
