<?php

namespace App\Jobs\Admin;

use App\Models\AuditOutbox;
use App\Services\Audit\AuditWriter;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;
use Throwable;

class PersistAuditLog implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    public int $uniqueFor = 300;

    public function __construct(public readonly string $eventId)
    {
        $this->afterCommit();
    }

    /** @return array<int, int> */
    public function backoff(): array
    {
        return [10, 30, 60, 180, 300];
    }

    public function uniqueId(): string
    {
        return $this->eventId;
    }

    public function handle(AuditWriter $writer): void
    {
        try {
            $writer->persist($this->eventId);
        } catch (Throwable $exception) {
            AuditOutbox::query()->whereKey($this->eventId)->increment('attempts');
            AuditOutbox::query()->whereKey($this->eventId)->update([
                'available_at' => now()->addMinute(),
                'last_error' => Str::limit($exception->getMessage(), 2000),
            ]);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        AuditOutbox::query()->whereKey($this->eventId)->update([
            'available_at' => now()->addMinutes(15),
            'last_error' => Str::limit($exception?->getMessage() ?? 'Audit persistence job failed.', 2000),
        ]);
    }
}
