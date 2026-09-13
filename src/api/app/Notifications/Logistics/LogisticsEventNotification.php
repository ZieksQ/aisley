<?php

namespace App\Notifications\Logistics;

use Illuminate\Notifications\Notification;

/**
 * Database-only notification envelope used by the recoverable delivery job.
 * The job writes the row with a deterministic UUID so concurrent retries are
 * deduplicated by the notifications primary key.
 */
class LogisticsEventNotification extends Notification
{
    /** @param array<string, mixed> $payload */
    public function __construct(
        private readonly string $type,
        private readonly array $payload,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return $this->type;
    }

    /** @return array<string, mixed> */
    public function toDatabase(object $notifiable): array
    {
        return $this->payload;
    }
}
