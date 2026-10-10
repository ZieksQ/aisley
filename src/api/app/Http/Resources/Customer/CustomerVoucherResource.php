<?php

namespace App\Http\Resources\Customer;

use App\Models\User;
use App\Services\Customer\Vouchers\VoucherAvailability;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerVoucherResource extends JsonResource
{
    public function __construct($resource, private ?User $customer = null)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        $availability = app(VoucherAvailability::class);
        $voucher = $this->resource;
        $reason = $availability->reason($voucher, $this->customer);
        $rules = $voucher->eligibility_rules ?? [];
        $claim = $this->customer ? $voucher->claims->first() : null;
        $shop = $voucher->issuer_type->value === 'shop' && $availability->visibleShop($voucher) ? $voucher->shop : null;
        $history = $voucher->lifecycle->value !== 'published' || now()->gte($voucher->ends_at)
            || ($voucher->global_limit !== null && $voucher->redeemed_count >= $voucher->global_limit)
            || ($this->customer && $availability->remainingUses($voucher, $this->customer) === 0);

        return [
            'id' => $voucher->id, 'name' => $voucher->name ?? $voucher->code, 'code' => $voucher->code,
            'issuerType' => $voucher->issuer_type->value, 'benefitType' => $voucher->benefit_type->value,
            'valueType' => $voucher->value_type->value, 'value' => $voucher->value,
            'maximumDiscount' => $voucher->maximum_discount, 'minimumSpend' => $voucher->minimum_spend,
            'currency' => 'PHP', 'validFrom' => $voucher->starts_at->toISOString(), 'validUntil' => $voucher->ends_at->toISOString(),
            'paymentMethod' => $voucher->payment_method?->value, 'termsSummary' => $voucher->terms_summary,
            'distributionMode' => $voucher->requiresClaim() ? 'claim_required' : 'automatic',
            'scope' => [
                'productIds' => array_values($rules['product_ids'] ?? []), 'categoryIds' => array_values($rules['category_ids'] ?? []),
                'excludedProductIds' => array_values($rules['excluded_product_ids'] ?? []), 'excludedCategoryIds' => array_values($rules['excluded_category_ids'] ?? []),
            ],
            'shop' => $shop ? ['id' => $shop->id, 'name' => $shop->name, 'slug' => $shop->slug] : null,
            'collectionUrl' => $shop ? '/shops/'.rawurlencode($shop->slug).'#vouchers' : ($voucher->issuer_type->value === 'app' ? '/vouchers/'.$voucher->id : null),
            'collectedAt' => $claim?->collected_at->toISOString(),
            'collected' => $this->customer ? $claim !== null : null,
            'remainingPersonalUses' => $this->customer ? $availability->remainingUses($voucher, $this->customer) : null,
            'availabilityReason' => $reason,
            'canCollect' => $voucher->requiresClaim() && $reason === null && $claim === null,
            'walletStatus' => $this->customer ? ($history ? 'history' : (now()->lt($voucher->starts_at) ? 'upcoming' : 'available')) : null,
        ];
    }
}
