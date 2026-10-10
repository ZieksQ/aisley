<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Enums\VoucherBenefitType;
use App\Enums\VoucherDistributionMode;
use App\Enums\VoucherIssuerType;
use App\Enums\VoucherLifecycle;
use App\Enums\VoucherValueType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Voucher extends Model
{
    use HasUuids;

    protected $fillable = [
        'name', 'code', 'issuer_type', 'shop_id', 'benefit_type', 'value_type', 'value', 'distribution_mode',
        'maximum_discount', 'minimum_spend', 'starts_at', 'ends_at', 'global_limit',
        'per_customer_limit', 'redeemed_count', 'payment_method', 'eligibility_rules',
        'stacking_policy', 'terms_summary', 'version', 'is_active',
        'lifecycle', 'revision', 'availability_revision', 'draft_version_id', 'published_at', 'ended_at',
    ];

    protected function casts(): array
    {
        return [
            'issuer_type' => VoucherIssuerType::class,
            'distribution_mode' => VoucherDistributionMode::class,
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
            'lifecycle' => VoucherLifecycle::class,
            'revision' => 'integer',
            'availability_revision' => 'integer',
            'published_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function draftVersion(): BelongsTo
    {
        return $this->belongsTo(VoucherVersion::class, 'draft_version_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(VoucherVersion::class);
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(VoucherRedemption::class);
    }

    public function claims(): HasMany
    {
        return $this->hasMany(VoucherClaim::class);
    }

    public function requiresClaim(): bool
    {
        return $this->issuer_type === VoucherIssuerType::Shop
            || $this->distribution_mode === VoucherDistributionMode::ClaimRequired;
    }
}
