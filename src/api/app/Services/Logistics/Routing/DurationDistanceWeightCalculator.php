<?php

namespace App\Services\Logistics\Routing;

class DurationDistanceWeightCalculator implements RouteWeightCalculator
{
    public function weight(float $duration, float $distance, array $connection, array $context = []): array
    {
        return [$duration, $distance];
    }
}
