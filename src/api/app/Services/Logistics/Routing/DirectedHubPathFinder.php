<?php

namespace App\Services\Logistics\Routing;

class DirectedHubPathFinder
{
    public function __construct(private readonly RouteWeightCalculator $weights) {}

    /** @param array<int, array<string, mixed>> $edges @return array<int, array<string, mixed>>|null */
    public function find(string $origin, string $destination, array $edges): ?array
    {
        $adjacency = [];
        foreach ($edges as $edge) {
            $adjacency[$edge['from_hub_id']][] = $edge;
        }
        $best = [$origin => [0.0, 0.0, 0, $origin]];
        $paths = [$origin => []];
        $visited = [];
        while ($best !== []) {
            uksort($best, fn (string $a, string $b): int => $best[$a] <=> $best[$b]);
            $node = array_key_first($best);
            $score = $best[$node];
            unset($best[$node]);
            if ($node === $destination) {
                return $paths[$node];
            }
            $visited[$node] = true;
            foreach ($adjacency[$node] ?? [] as $edge) {
                $target = $edge['to_hub_id'];
                if (isset($visited[$target])) {
                    continue;
                }
                [$duration, $distance] = $this->weights->weight($edge['duration_seconds'], $edge['distance_meters'], $edge);
                if (! is_finite($duration) || ! is_finite($distance) || $duration < 0 || $distance < 0) {
                    throw new \LogicException('Route weights must be finite and nonnegative.');
                }
                $candidate = [$score[0] + $duration, $score[1] + $distance, $score[2] + 1, $score[3].':'.$target];
                if (! isset($best[$target]) || $candidate < $best[$target]) {
                    $best[$target] = $candidate;
                    $paths[$target] = [...$paths[$node], $edge];
                }
            }
        }

        return null;
    }
}
