<?php

namespace App\Services\Vouchers;

use App\Enums\VoucherBenefitType;
use App\Enums\VoucherIssuerType;
use App\Models\Voucher;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VoucherTerms
{
    public const FIELDS = ['code', 'benefit_type', 'value_type', 'value', 'maximum_discount', 'minimum_spend', 'starts_at', 'ends_at', 'global_limit', 'per_customer_limit', 'payment_method', 'eligibility_rules', 'stacking_policy', 'terms_summary'];

    public function normalize(array $data, ?string $code = null): array
    {
        $opposite = $data['benefit_type'] === 'discount' ? 'shipping' : 'discount';

        return [
            'code' => $data['code'] ?? $code ?? 'AIS-'.strtoupper(Str::random(12)),
            'benefit_type' => $data['benefit_type'], 'value_type' => $data['value_type'],
            'value' => number_format((float) $data['value'], 2, '.', ''),
            'maximum_discount' => isset($data['maximum_discount']) ? number_format((float) $data['maximum_discount'], 2, '.', '') : null,
            'minimum_spend' => number_format((float) $data['minimum_spend'], 2, '.', ''),
            'starts_at' => CarbonImmutable::parse($data['starts_at'])->utc()->toISOString(),
            'ends_at' => CarbonImmutable::parse($data['ends_at'])->utc()->toISOString(),
            'global_limit' => isset($data['global_limit']) ? (int) $data['global_limit'] : null,
            'per_customer_limit' => (int) $data['per_customer_limit'], 'payment_method' => 'cod',
            'eligibility_rules' => [], 'stacking_policy' => ['allow_with' => $data['stacking'] ? ['app:'.$opposite, 'shop:'.$opposite] : []],
            'terms_summary' => trim($data['terms_summary']),
        ];
    }

    public function snapshot(Voucher $voucher): array
    {
        $data = array_intersect_key($voucher->toArray(), array_flip(self::FIELDS));
        $data['starts_at'] = $voucher->starts_at->utc()->toISOString();
        $data['ends_at'] = $voucher->ends_at->utc()->toISOString();

        return $data;
    }

    public function supported(Voucher $voucher): bool
    {
        return ! ($voucher->issuer_type === VoucherIssuerType::Shop && $voucher->benefit_type === VoucherBenefitType::Shipping)
            && collect($voucher->eligibility_rules ?? [])->every(fn ($value) => $value === [] || $value === null)
            && ($voucher->payment_method === null || $voucher->payment_method->value === 'cod')
            && (float) $voucher->value > 0 && ($voucher->value_type->value !== 'percent' || (float) $voucher->value <= 100)
            && (float) $voucher->minimum_spend >= 0 && ($voucher->maximum_discount === null || (float) $voucher->maximum_discount > 0)
            && $voucher->per_customer_limit > 0 && ($voucher->global_limit === null || $voucher->global_limit > 0)
            && $voucher->ends_at->gt($voucher->starts_at) && trim($voucher->terms_summary) !== ''
            && ! preg_match('/[<>]/', $voucher->terms_summary);
    }

    public function assertSupported(Voucher $voucher): void
    {
        if (! $this->supported($voucher)) {
            throw ValidationException::withMessages(['voucher' => 'These legacy terms cannot be revised or duplicated through v1 authoring.']);
        }
    }

    public function assertIdentity(Voucher $voucher, array $terms): void
    {
        if ($voucher->lifecycle->value !== 'draft' && ($terms['code'] !== $voucher->code || $terms['benefit_type'] !== $voucher->benefit_type->value)) {
            throw ValidationException::withMessages(['code' => 'Published code and benefit are fixed. Duplicate for an independent offer.']);
        }
    }
}
