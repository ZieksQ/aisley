<?php

namespace App\Jobs\Logistics;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Notifications\Logistics\LogisticsEventNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Ramsey\Uuid\Uuid;

class DeliverLogisticsNotification implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    public int $uniqueFor = 3600;

    /** @param array<string, mixed> $payload */
    public function __construct(
        public readonly string $recipientId,
        public readonly string $type,
        public readonly string $sourceKey,
        public readonly string $eventAt,
        public readonly array $payload,
    ) {}

    public function uniqueId(): string
    {
        return "logistics:{$this->recipientId}:{$this->type}:{$this->sourceKey}";
    }

    public function backoff(): array
    {
        return [5, 30, 120, 300];
    }

    public function handle(): void
    {
        $recipient = User::query()
            ->whereKey($this->recipientId)
            ->where('role', UserRole::Logistics)
            ->where('status', UserStatus::Active)
            ->whereHas('logisticsOrganization.hub')
            ->first();

        if ($recipient === null) {
            return;
        }

        $notification = new LogisticsEventNotification($this->type, $this->payload);
        $notificationId = Uuid::uuid5(
            Uuid::NAMESPACE_URL,
            "aisley:logistics:notification:{$recipient->id}:{$this->type}:{$this->sourceKey}",
        )->toString();

        // Use the same database-channel payload while letting the database
        // enforce one row for a source event, recipient, and type. A failed
        // insert is retried by the queue without repeating the source action.
        DB::table('notifications')->insertOrIgnore([
            'id' => $notificationId,
            'type' => $notification->databaseType($recipient),
            'notifiable_type' => User::class,
            'notifiable_id' => $recipient->id,
            'data' => json_encode($notification->toDatabase($recipient), JSON_THROW_ON_ERROR),
            'read_at' => null,
            'created_at' => $this->eventAt,
            'updated_at' => now(),
        ]);
    }
}
