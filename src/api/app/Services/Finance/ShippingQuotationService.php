<?php

namespace App\Services\Finance;

use App\Enums\LogisticsRateCardStatus;
use App\Enums\LogisticsServiceType;
use App\Enums\ShippingPricingModel;
use App\Enums\ShippingRoutePricingStatus;
use App\Enums\UserStatus;
use App\Exceptions\Customer\CheckoutException;
use App\Models\Address;
use App\Models\LogisticsOrganization;
use App\Models\LogisticsRateCard;
use App\Models\LogisticsShippingRateAcceptance;
use App\Models\ShippingRateVersion;
use App\Models\Shop;
use App\Models\ShopLogisticsProvider;
use App\Services\Logistics\Routing\CheckoutRoutePlanner;

class ShippingQuotationService
{
    public function __construct(private readonly CheckoutRoutePlanner $routes) {}

    /** @param list<array<string, mixed>> $lines @return list<array<string, mixed>> */
    public function options(Shop $shop, Address $destination, array $lines): array
    {
        $settings = ShopLogisticsProvider::query()->where('shop_id', $shop->id)->where('is_enabled', true)
            ->pluck('logistics_organization_id');
        $organizations = LogisticsOrganization::query()->whereIn('id', $settings)
            ->whereHas('user', fn ($query) => $query->where('status', UserStatus::Active))
            ->whereHas('hub.address')->with('hub.address')->orderBy('business_name')->get();

        return $organizations->map(function (LogisticsOrganization $organization) use ($shop, $destination, $lines): ?array {
            try {
                $quote = $this->quote($shop, $destination, $lines, $organization->id);

                return [
                    'organization_id' => $organization->id,
                    'business_name' => $organization->business_name,
                    'shipping_cents' => $quote['shipping_cents'],
                    'route_status' => $quote['route_snapshot']['status'],
                ];
            } catch (CheckoutException) {
                return null;
            }
        })->filter()->values()->all();
    }

    /** @param list<array<string, mixed>> $lines @return array<string, mixed> */
    public function quote(Shop $shop, Address $destination, array $lines, string $organizationId): array
    {
        $origin = $shop->seller->addresses()->where('is_default', true)->first();
        if ($origin === null) {
            throw CheckoutException::conflict('PICKUP_ADDRESS_REQUIRED', "{$shop->name} does not have a pickup address configured.", 'address_id');
        }
        if (! ShopLogisticsProvider::query()->where('shop_id', $shop->id)
            ->where('logistics_organization_id', $organizationId)->where('is_enabled', true)->exists()) {
            throw CheckoutException::invalid('LOGISTICS_SELECTION_INVALID', 'The selected Logistics provider is not enabled by this Shop.', 'logistics_selections');
        }
        $organization = LogisticsOrganization::query()->whereKey($organizationId)
            ->whereHas('user', fn ($query) => $query->where('status', UserStatus::Active))
            ->whereHas('hub.address')->with('hub.address')->first();
        if ($organization === null) {
            throw CheckoutException::conflict('LOGISTICS_PROVIDER_UNAVAILABLE', 'The selected Logistics provider is unavailable.', 'logistics_selections');
        }

        $rate = ShippingRateVersion::query()->where('status', 'published')->whereNotNull('published_at')
            ->where('effective_at', '<=', now())->with('regionSurcharges')
            ->orderByDesc('effective_at')->orderByDesc('version_number')->first();
        if ($rate === null) {
            throw CheckoutException::conflict('SHIPPING_RATE_UNAVAILABLE', 'The platform shipping tariff is not active.', 'address_id');
        }
        if (! $this->accepted($rate->id, $organization->id)) {
            throw CheckoutException::conflict('LOGISTICS_RATE_NOT_ACCEPTED', 'The selected Logistics provider has not accepted the active platform tariff.', 'logistics_selections');
        }

        [$billable, $inputs] = $this->measure($rate, $lines);
        $regionSurcharge = $rate->regionSurcharges
            ->firstWhere('normalized_region', $this->normalize($destination->region))?->surcharge_cents ?? 0;
        $route = $this->routes->plan($organization->hub, (string) $destination->postal_code);
        $charges = [];
        if ($route['status'] !== ShippingRoutePricingStatus::Unplanned->value) {
            try {
                $charges = $this->routeCharges($route, $rate->id, $inputs, $shop->shop_category_id);
            } catch (CheckoutException $exception) {
                if ($exception->errorCode === 'ROUTE_RATE_LIMIT_EXCEEDED') {
                    throw $exception;
                }
                $route['status'] = ShippingRoutePricingStatus::Unplanned->value;
                $route['failure_code'] = $exception->errorCode;
                $charges = [];
            }
        }
        $serviceBaseFees = collect($charges)->sum('base_fee_cents');
        $weightCharges = collect($charges)->sum('additional_weight_fee_cents');

        return [
            'rate' => $rate,
            'pricing_model' => ShippingPricingModel::LogisticsServiceBase->value,
            'selected_logistics_organization_id' => $organization->id,
            'selected_logistics_business_name' => $organization->business_name,
            'origin' => $this->address($origin),
            'destination' => $this->address($destination),
            'line_inputs' => $inputs,
            'billable_weight_grams' => $billable,
            'base_fee_cents' => $serviceBaseFees,
            'additional_weight_fee_cents' => $weightCharges,
            'destination_surcharge_cents' => $regionSurcharge,
            'shipping_cents' => $serviceBaseFees + $regionSurcharge + $weightCharges,
            'eligible_logistics_organization_ids' => collect($charges)->pluck('organization_id')->push($organization->id)->unique()->values()->all(),
            'route_snapshot' => $route,
            'logistics_charge_inputs' => $charges,
            'state' => [
                'rate_id' => $rate->id,
                'rate_revision' => $rate->revision,
                'pricing_model' => ShippingPricingModel::LogisticsServiceBase->value,
                'selected_organization_id' => $organization->id,
                'shop_category_id' => $shop->shop_category_id,
                'route' => [$route['status'], $route['failure_code'], $route['graph_revision'], $route['sort_plans']],
                'charges' => collect($charges)->map(fn (array $charge) => [$charge['rate_card_id'], $charge['rate_card_revision'], $charge['shop_category_id'], $charge['rate_rule_ids'], $charge['quoted_charge_cents']])->all(),
                'origin' => [$origin->id, $origin->updated_at?->getTimestamp()],
                'billable_weight_grams' => $billable,
            ],
        ];
    }

    /** @param list<array<string, mixed>> $lines @return array{0:int,1:list<array<string,mixed>>} */
    private function measure(ShippingRateVersion $rate, array $lines): array
    {
        $billable = 0;
        $inputs = [];
        foreach ($lines as $line) {
            $variant = $line['variant'];
            $variantHasOverride = $variant !== null && collect($this->shippingColumns())
                ->every(fn (string $column) => (int) $variant->{$column} > 0);
            $source = $variantHasOverride ? $variant : $line['product'];
            $measurements = collect([
                'weight_grams' => (int) $source->shipping_weight_grams,
                'length_mm' => (int) $source->shipping_length_mm,
                'width_mm' => (int) $source->shipping_width_mm,
                'height_mm' => (int) $source->shipping_height_mm,
            ]);
            if ($measurements->contains(fn ($value) => $value < 1)) {
                throw CheckoutException::conflict('SHIPPING_DATA_REQUIRED', "Shipping weight and dimensions are missing for {$line['product']->name}.", 'items');
            }
            if ($measurements['length_mm'] > $rate->max_length_mm || $measurements['width_mm'] > $rate->max_width_mm || $measurements['height_mm'] > $rate->max_height_mm) {
                throw CheckoutException::conflict('SHIPPING_DIMENSIONS_UNSUPPORTED', "{$line['product']->name} exceeds the platform parcel dimensions.", 'items');
            }
            $volumetric = (int) ceil(($measurements['length_mm'] * $measurements['width_mm'] * $measurements['height_mm']) / $rate->volumetric_divisor);
            $unitBillable = max($measurements['weight_grams'], $volumetric);
            $lineBillable = $unitBillable * (int) $line['quantity'];
            $billable += $lineBillable;
            $inputs[] = [
                'product_id' => $line['product']->id,
                'variant_id' => $variant?->id,
                'category_id' => $line['product']->category_id,
                'quantity' => (int) $line['quantity'],
                ...$measurements->all(),
                'volumetric_weight_grams' => $volumetric,
                'unit_billable_weight_grams' => $unitBillable,
                'line_billable_weight_grams' => $lineBillable,
            ];
        }
        if ($billable > $rate->max_weight_grams) {
            throw CheckoutException::conflict('SHIPPING_WEIGHT_UNSUPPORTED', 'The Shop order exceeds the platform billable-weight limit.', 'items');
        }

        return [$billable, $inputs];
    }

    /** @param array<string, mixed> $route @param list<array<string, mixed>> $inputs @return list<array<string, mixed>> */
    private function routeCharges(array $route, string $rateId, array $inputs, ?string $shopCategoryId): array
    {
        $legs = [[
            'organization_id' => $route['origin_organization_id'],
            'service_type' => LogisticsServiceType::FirstMile,
            'hop_sequence' => null,
            'from_hub_id' => null,
            'to_hub_id' => $route['origin_hub_id'],
        ]];
        foreach ($route['hops'] as $index => $hop) {
            $legs[] = [
                'organization_id' => $hop['from_organization_id'],
                'service_type' => LogisticsServiceType::Linehaul,
                'hop_sequence' => $index + 1,
                'from_hub_id' => $hop['from_hub_id'],
                'to_hub_id' => $hop['to_hub_id'],
            ];
        }
        $legs[] = [
            'organization_id' => $route['destination_organization_id'],
            'service_type' => LogisticsServiceType::LastMile,
            'hop_sequence' => null,
            'from_hub_id' => $route['destination_hub_id'],
            'to_hub_id' => null,
        ];

        return collect($legs)->map(function (array $leg) use ($rateId, $inputs, $shopCategoryId): array {
            if (! $this->accepted($rateId, $leg['organization_id'])) {
                throw CheckoutException::conflict('ROUTE_PARTICIPANT_TARIFF_NOT_ACCEPTED', 'A route participant has not accepted the platform tariff.');
            }
            $card = LogisticsRateCard::query()->where('logistics_organization_id', $leg['organization_id'])
                ->where('status', LogisticsRateCardStatus::Published->value)->where('effective_at', '<=', now())
                ->with(['rules', 'services'])->orderByDesc('effective_at')->orderByDesc('version_number')->first();
            if ($card === null) {
                throw CheckoutException::conflict('ROUTE_PARTICIPANT_RATE_UNAVAILABLE', 'A route participant has no active rate card.');
            }
            $service = $card->services->first(fn ($candidate) => $candidate->service_type === $leg['service_type']);
            if ($service === null) {
                throw CheckoutException::conflict('ROUTE_SERVICE_RATE_UNAVAILABLE', 'A route participant has no base fee for the required service.');
            }
            $weightCharges = 0;
            $ruleIds = [];
            $rule = $shopCategoryId === null ? null : $card->rules->first(
                fn ($candidate) => $candidate->shop_category_id === $shopCategoryId && $candidate->service_type === $leg['service_type'],
            );
            if ($rule === null) {
                throw CheckoutException::conflict('ROUTE_CATEGORY_RATE_UNAVAILABLE', 'A route participant has no rate for the Shop main category.');
            }
            $weight = collect($inputs)->sum('line_billable_weight_grams');
            if ($weight > $rule->max_weight_grams || collect($inputs)->contains(fn (array $item) => $item['length_mm'] > $rule->max_length_mm || $item['width_mm'] > $rule->max_width_mm || $item['height_mm'] > $rule->max_height_mm)) {
                throw CheckoutException::conflict('ROUTE_RATE_LIMIT_EXCEEDED', 'A parcel exceeds a route participant rate limit.');
            }
            $excess = max(0, $weight - $rule->included_weight_grams);
            $steps = $excess === 0 ? 0 : (int) ceil($excess / $rule->additional_weight_grams);
            $weightCharges = $steps * $rule->additional_fee_cents;
            $ruleIds[] = $rule->id;

            return [
                ...$leg,
                'shop_category_id' => $shopCategoryId,
                'service_type' => $leg['service_type']->value,
                'rate_card_id' => $card->id,
                'rate_card_revision' => $card->revision,
                'rate_rule_ids' => $ruleIds,
                'service_rate_id' => $service->id,
                'base_fee_cents' => $service->base_fee_cents,
                'additional_weight_fee_cents' => $weightCharges,
                'quoted_charge_cents' => $service->base_fee_cents + $weightCharges,
            ];
        })->values()->all();
    }

    private function accepted(string $rateId, string $organizationId): bool
    {
        return LogisticsShippingRateAcceptance::query()->where('shipping_rate_version_id', $rateId)
            ->where('logistics_organization_id', $organizationId)->whereNull('revoked_at')->exists();
    }

    /** @return list<string> */
    private function shippingColumns(): array
    {
        return ['shipping_weight_grams', 'shipping_length_mm', 'shipping_width_mm', 'shipping_height_mm'];
    }

    private function normalize(?string $value): string
    {
        return mb_strtolower(trim((string) $value));
    }

    /** @return array<string, mixed> */
    private function address(Address $address): array
    {
        return collect(['id', 'region', 'province', 'city_municipality', 'barangay', 'postal_code', 'country'])
            ->mapWithKeys(fn (string $field) => [$field => $address->{$field}])->all();
    }
}
