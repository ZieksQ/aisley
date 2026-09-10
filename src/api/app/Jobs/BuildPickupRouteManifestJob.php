<?php

namespace App\Jobs;

use App\Services\Logistics\BuildPickupRouteManifest;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class BuildPickupRouteManifestJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 600;

    public function __construct(public string $scheduleId, public int $revision) {}

    public function handle(BuildPickupRouteManifest $builder): void
    {
        $builder->handle($this->scheduleId, $this->revision);
    }

    public function uniqueId(): string
    {
        return $this->scheduleId.':'.$this->revision;
    }
}
