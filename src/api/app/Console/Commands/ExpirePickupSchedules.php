<?php

namespace App\Console\Commands;

use App\Enums\FirstMileTaskStatus;
use App\Enums\PickupScheduleStatus;
use App\Models\LogisticsOrganization;
use App\Models\PickupSchedule;
use App\Services\Logistics\ReleasePickupParcels;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpirePickupSchedules extends Command
{
    protected $signature = 'pickups:expire-schedules {--limit=200 : Maximum schedules per run}';

    protected $description = 'Release uncollected parcels after their 72-hour pickup retry period';

    public function handle(ReleasePickupParcels $release): int
    {
        $ids = PickupSchedule::query()->where('status', PickupScheduleStatus::Scheduled)
            ->where('starts_at', '<=', now()->subHours(72))
            ->whereHas('tasks', fn ($q) => $q->whereIn('status', [FirstMileTaskStatus::Assigned, FirstMileTaskStatus::Accepted]))
            ->orderBy('starts_at')->orderBy('id')->limit(max(1, min(1000, (int) $this->option('limit'))))->pluck('id');
        foreach ($ids as $id) {
            DB::transaction(function () use ($id, $release): void {
                $candidate = PickupSchedule::findOrFail($id);
                LogisticsOrganization::query()->whereKey($candidate->logistics_organization_id)->lockForUpdate()->firstOrFail();
                $schedule = PickupSchedule::query()->whereKey($id)->lockForUpdate()->firstOrFail();
                if ($schedule->status !== PickupScheduleStatus::Scheduled || $schedule->retryDeadline()->gt(now())) {
                    return;
                }
                $tasks = $schedule->tasks()->whereIn('status', [FirstMileTaskStatus::Assigned, FirstMileTaskStatus::Accepted])->orderBy('id')->lockForUpdate()->get();
                if ($tasks->isNotEmpty()) {
                    $release->handle($schedule, $tasks, $schedule->courier_id, 'retry_expired', 'The 72-hour pickup retry period expired.');
                }
            }, 3);
        }
        $this->info('Processed '.$ids->count().' expired pickup schedules.');

        return self::SUCCESS;
    }
}
