<?php

use App\Models\SortingPlanActivation;
use App\Services\Logistics\Sorting\SortingVersionService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('audit:dispatch-pending')
    ->everyMinute()
    ->withoutOverlapping();

Schedule::command('products:cleanup-assets')
    ->hourly()
    ->withoutOverlapping();

Schedule::command('pickups:dispatch-reminders')
    ->everyMinute()
    ->withoutOverlapping()
    ->onOneServer();

Schedule::command('finance:automate')
    ->everyMinute()
    ->timezone('Asia/Manila')
    ->withoutOverlapping()
    ->onOneServer();
Schedule::command('campaigns:dispatch-pending')
    ->everyMinute()
    ->withoutOverlapping();

Schedule::command('campaigns:prune-recipients')
    ->daily()
    ->withoutOverlapping();

Schedule::command('deliveries:recover-approvals')->everyMinute()->withoutOverlapping()->onOneServer();

Artisan::command('sorting:activate-due', function () {
    $hubs = SortingPlanActivation::query()->where('status', 'scheduled')->where('scheduled_for', '<=', now())->distinct()->pluck('logistics_hub_id');
    foreach ($hubs as $hubId) {
        app(SortingVersionService::class)->recoverHub($hubId);
    }
})->purpose('Recover overdue one-time sort-plan activations');
Schedule::command('sorting:activate-due')->everyMinute()->timezone('Asia/Manila')->withoutOverlapping()->onOneServer();
