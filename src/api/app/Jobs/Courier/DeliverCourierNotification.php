<?php

namespace App\Jobs\Courier;

use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Notifications\Courier\CourierEventNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Ramsey\Uuid\Uuid;

class DeliverCourierNotification implements ShouldBeUnique, ShouldQueue
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
        return "courier:{$this->recipientId}:{$this->type}:{$this->sourceKey}";
    }

    public function backoff(): array
    {
        return [5, 30, 120, 300];
    }

    public function handle(): void
    {
        $recipient = User::query()
            ->whereKey($this->recipientId)
            ->where('role', UserRole::Courier->value)
            ->where('status', UserStatus::Active->value)
            ->with('courierLogisticsAffiliation.organization.user', 'courierLogisticsAffiliation.organization.hub')
            ->first();
        $affiliation = $recipient?->courierLogisticsAffiliation;

        if ($recipient === null || $affiliation === null
            || $affiliation->status !== CourierAffiliationStatus::Approved
            || $affiliation->organization?->user?->status !== UserStatus::Active
            || (string) $affiliation->organization?->hub?->id !== (string) $affiliation->logistics_hub_id
            || ($this->payload['logistics_organization_id'] ?? null) !== (string) $affiliation->logistics_organization_id
            || ($this->payload['logistics_hub_id'] ?? null) !== (string) $affiliation->logistics_hub_id) {
            return;
        }

        $notification = new CourierEventNotification($this->type, $this->payloadForStorage());
        $notificationId = Uuid::uuid5(
            Uuid::NAMESPACE_URL,
            "aisley:courier:notification:{$recipient->id}:{$this->type}:{$this->sourceKey}",
        )->toString();

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

    /** @return array<string, mixed> */
    private function payloadForStorage(): array
    {
        $payload = $this->payload;
        unset($payload['logistics_organization_id'], $payload['logistics_hub_id']);

        return $payload;
    }
}
