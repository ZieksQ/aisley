<?php

namespace App\Services\Customer\Vouchers;

use App\Enums\PaymentMethod;
use App\Models\Shop;
use App\Models\User;
use App\Models\Voucher;

class VoucherAvailability
{
    public function reason(Voucher $voucher, ?User $customer = null): ?string
    {
        if ($voucher->lifecycle->value !== 'published') {
            return 'VOUCHER_ENDED';
        }
        if ($voucher->issuer_type->value === 'shop' && ! $this->visibleShop($voucher)) {
            return 'VOUCHER_SHOP_UNAVAILABLE';
        }
        if ($voucher->per_customer_limit < 1 || (float) $voucher->value < 0
            || (float) $voucher->minimum_spend < 0
            || ($voucher->maximum_discount !== null && (float) $voucher->maximum_discount < 0)
            || ($voucher->value_type->value === 'percent' && (float) $voucher->value > 100)
            || $voucher->ends_at->lte($voucher->starts_at)) {
            return 'VOUCHER_TERMS_INVALID';
        }
        if (now()->gte($voucher->ends_at)) {
            return 'VOUCHER_EXPIRED';
        }
        if ($voucher->global_limit !== null && $voucher->redeemed_count >= $voucher->global_limit) {
            return 'VOUCHER_EXHAUSTED';
        }
        if ($customer && $this->remainingUses($voucher, $customer) === 0) {
            return 'VOUCHER_CUSTOMER_LIMIT';
        }
        if ($customer && ! $this->customerEligible($voucher, $customer)) {
            return 'VOUCHER_CUSTOMER_INELIGIBLE';
        }
        if (! $voucher->is_active) {
            return 'VOUCHER_INACTIVE';
        }
        if (now()->lt($voucher->starts_at)) {
            return 'VOUCHER_NOT_STARTED';
        }
        if ($voucher->payment_method !== null && $voucher->payment_method !== PaymentMethod::CashOnDelivery) {
            return 'VOUCHER_PAYMENT_INELIGIBLE';
        }

        return null;
    }

    public function customerEligible(Voucher $voucher, User $customer): bool
    {
        $rules = $voucher->eligibility_rules ?? [];

        return (($rules['customer_ids'] ?? []) === [] || in_array($customer->id, $rules['customer_ids'], true))
            && ! in_array($customer->id, $rules['excluded_customer_ids'] ?? [], true);
    }

    public function remainingUses(Voucher $voucher, User $customer): int
    {
        $used = $voucher->personal_redemptions_count ?? $voucher->redemptions()->where('customer_id', $customer->id)->count();

        return max(0, $voucher->per_customer_limit - $used);
    }

    public function visibleShop(Voucher $voucher): bool
    {
        return isset($voucher->visible_shop_exists)
            ? (bool) $voucher->visible_shop_exists
            : Shop::query()->storefrontVisible()->whereKey($voucher->shop_id)->exists();
    }
}
