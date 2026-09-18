<?php

namespace App\Services\Logistics\Routing;

interface RouteWeightCalculator
{
    /** @return array{0: float, 1: float} */
    public function weight(float $duration, float $distance, array $connection, array $context = []): array;
}
