<?php

namespace App\Console\Commands;

use App\Jobs\Admin\PersistAuditLog;
use App\Models\AuditOutbox;
use Illuminate\Console\Command;
use Throwable;

class DispatchPendingAuditEvents extends Command
{
    protected $signature = 'audit:dispatch-pending {--limit=100}';

    protected $description = 'Dispatch pending audit outbox events for persistence';

    public function handle(): int
    {
        $limit = max(1, min((int) $this->option('limit'), 1000));
        $events = AuditOutbox::query()
            ->whereNull('processed_at')
            ->where(function ($query): void {
                $query->whereNull('available_at')->orWhere('available_at', '<=', now());
            })
            ->oldest('occurred_at')
            ->limit($limit)
            ->pluck('id');

        $dispatched = 0;

        foreach ($events as $eventId) {
            try {
                PersistAuditLog::dispatch((string) $eventId);
                $dispatched++;
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        $this->info("Dispatched {$dispatched} audit event(s).");

        return self::SUCCESS;
    }
}
