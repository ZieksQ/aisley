<?php

namespace App\Console\Commands;

use App\Enums\PickupScheduleStatus;
use App\Models\PickupSchedule;
use App\Services\Logistics\PickupScheduleLifecycleService;
use Illuminate\Console\Command;

class ReconcilePickupSchedules extends Command
{
    protected $signature = 'pickups:reconcile-schedules {--limit=50}';

    protected $description = 'Reconcile scheduled pickup schedules whose first-mile tasks are already picked up';

    public function handle(PickupScheduleLifecycleService $lifecycle): int
    {
        $limit = max(1, min((int) $this->option('limit'), 500));
        $ids = PickupSchedule::query()
            ->where('status', PickupScheduleStatus::Scheduled)
            ->whereDoesntHave('tasks', fn ($query) => $query->whereIn('status', ['assigned', 'accepted']))
            ->orderBy('created_at')
            ->orderBy('id')
            ->limit($limit)
            ->pluck('id');
        $completed = 0;
        $inconsistent = 0;
        $skipped = 0;

        foreach ($ids as $id) {
            $result = $lifecycle->reconcile($id);
            if ($result['status'] === 'completed') {
                $completed++;
                $this->line("Completed {$id}.");
            } elseif ($result['status'] === 'inconsistent') {
                $inconsistent++;
                $this->warn("Skipped {$id}: {$result['reason']}.");
            } else {
                $skipped++;
            }
        }

        $this->info("Reconciled {$completed} schedule(s); {$inconsistent} inconsistent candidate(s); {$skipped} skipped.");

        return self::SUCCESS;
    }
}
