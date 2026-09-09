<?php

namespace App\Services\Logistics;

use App\Enums\LogisticsMatchTier;
use App\Enums\UserStatus;
use App\Models\Address;
use App\Models\LogisticsOrganization;
use App\Models\SellerPickupRequest;
use App\Models\Shop;
use Illuminate\Support\Collection;

class EligibleLogisticsQuery
{
    public function __construct(private readonly LogisticsDistanceService $distance) {}

    /** @return array{shop: Shop,address: Address,options: Collection<int, array<string,mixed>>} */
    public function forSeller(string $sellerId): array
    {
        $shop = Shop::query()->where('seller_id', $sellerId)->firstOrFail();
        $address = Address::query()->where('user_id', $sellerId)->orderByDesc('is_default')->orderBy('created_at')->firstOrFail();
        $organizations = LogisticsOrganization::query()
            ->whereHas('user', fn ($query) => $query->where('status', UserStatus::Active))
            ->whereHas('hub.address')
            ->with(['hub.address'])
            ->get();
        $defaultProviderId = SellerPickupRequest::query()
            ->where('seller_id', $sellerId)
            ->oldest('created_at')
            ->oldest('id')
            ->value('logistics_organization_id');
        $distances = $this->distance->distances($address, $organizations->pluck('hub'));

        $options = $organizations->map(function (LogisticsOrganization $organization) use ($address, $distances): array {
            $hub = $organization->hub;
            $tier = $this->tier($address, $hub->address);
            $distance = $distances[$hub->id];

            return [
                'id' => $organization->id,
                'business_name' => $organization->business_name,
                'hub' => ['id' => $hub->id, 'name' => $hub->name, 'area' => $this->area($hub->address)],
                'available' => true,
                'match_tier' => $tier->value,
                'recommendation_reason' => match ($tier) {
                    LogisticsMatchTier::SameCity => 'same_city',
                    LogisticsMatchTier::SameProvince => 'same_province',
                    LogisticsMatchTier::SameCountry => 'same_country',
                    LogisticsMatchTier::Other => $distance['distance_km'] !== null ? 'nearest_by_road' : 'eligible_provider',
                },
                ...$distance,
            ];
        })->sortBy(fn (array $option) => [LogisticsMatchTier::from($option['match_tier'])->rank(), $option['distance_km'] === null ? PHP_FLOAT_MAX : $option['distance_km'], mb_strtolower($option['business_name']), $option['id']])->values();

        $bestTier = $options->min(fn (array $option) => LogisticsMatchTier::from($option['match_tier'])->rank());
        $exact = $options->filter(fn (array $option) => LogisticsMatchTier::from($option['match_tier'])->rank() === $bestTier);
        $recommended = $exact->sortBy(fn (array $option) => [$option['distance_km'] === null ? PHP_FLOAT_MAX : $option['distance_km'], mb_strlen($option['business_name']), $option['id']])->first();
        $hasAuthoritativeDistance = $options->contains(fn (array $option) => $option['distance_km'] !== null);
        $options = $options->map(fn (array $option) => [
            ...$option,
            'recommended' => $hasAuthoritativeDistance && $recommended !== null && $option['id'] === $recommended['id'],
            'default' => $option['id'] === $defaultProviderId,
        ]);

        return compact('shop', 'address', 'options');
    }

    private function tier(Address $source, Address $target): LogisticsMatchTier
    {
        $same = fn (?string $left, ?string $right) => $left !== null && $right !== null && mb_strtolower(trim($left)) === mb_strtolower(trim($right));
        if ($same($source->city_municipality, $target->city_municipality) && $same($source->province, $target->province) && $same($source->country, $target->country)) {
            return LogisticsMatchTier::SameCity;
        }
        if ($same($source->province, $target->province) && $same($source->country, $target->country)) {
            return LogisticsMatchTier::SameProvince;
        }
        if ($same($source->country, $target->country)) {
            return LogisticsMatchTier::SameCountry;
        }

        return LogisticsMatchTier::Other;
    }

    private function area(Address $address): array
    {
        return [
            'address_line_1' => $address->address_line_1,
            'address_line_2' => $address->address_line_2,
            'barangay' => $address->barangay,
            'city_municipality' => $address->city_municipality,
            'province' => $address->province,
            'region' => $address->region,
            'postal_code' => $address->postal_code,
            'country' => $address->country,
        ];
    }
}
