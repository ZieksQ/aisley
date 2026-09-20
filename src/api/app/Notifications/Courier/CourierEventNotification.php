<?php

namespace App\Notifications\Courier;

use Illuminate\Notifications\Notification;

class CourierEventNotification extends Notification
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
