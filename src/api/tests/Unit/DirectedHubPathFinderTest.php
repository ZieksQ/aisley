<?php

namespace Tests\Unit;

use App\Services\Logistics\Routing\DirectedHubPathFinder;
use App\Services\Logistics\Routing\DurationDistanceWeightCalculator;
use PHPUnit\Framework\TestCase;

class DirectedHubPathFinderTest extends TestCase
{
    public function test_duration_then_distance_then_hops_then_hub_ids_decide_path(): void
    {
        $finder = new DirectedHubPathFinder(new DurationDistanceWeightCalculator);
        $edge = fn ($from, $to, $duration, $distance) => ['from_hub_id' => $from, 'to_hub_id' => $to, 'duration_seconds' => $duration, 'distance_meters' => $distance];
        $graph = [$edge('a', 'z', 30, 1), $edge('a', 'b', 10, 100), $edge('b', 'z', 10, 100), $edge('a', 'c', 10, 50), $edge('c', 'z', 10, 50)];
        $this->assertSame(['c', 'z'], array_column($finder->find('a', 'z', $graph), 'to_hub_id'));
        $graph[] = $edge('a', 'z', 20, 100);
        $this->assertSame(['z'], array_column($finder->find('a', 'z', $graph), 'to_hub_id'));
        $tied = [$edge('a', 'c', 10, 50), $edge('c', 'z', 10, 50), $edge('a', 'b', 10, 50), $edge('b', 'z', 10, 50), $edge('b', 'a', 0, 0)];
        $this->assertSame(['b', 'z'], array_column($finder->find('a', 'z', $tied), 'to_hub_id'));
        $this->assertSame(['b', 'z'], array_column($finder->find('a', 'z', array_reverse($tied)), 'to_hub_id'));
        $this->assertNull($finder->find('z', 'a', $graph));
    }
}
