<?php

namespace App\Models;

use App\Enums\VoucherBenefitType;
use App\Enums\VoucherIssuerType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderVoucher extends Model
{
    use HasUuids;

    protected $fillable = [
        'order_id', 'voucher_id', 'code', 'issuer_type', 'benefit_type', 'qualifying_basis',
        'discount_amount', 'currency', 'rule_version', 'terms_summary', 'redeemed_at',
    ];

    protected function casts(): array
    {
        return [
            'issuer_type' => VoucherIssuerType::class,
            'benefit_type' => VoucherBenefitType::class,
            'qualifying_basis' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'rule_version' => 'integer',
            'redeemed_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }
}
