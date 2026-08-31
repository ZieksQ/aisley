<?php

namespace App\Jobs\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Notifications\Admin\PendingRegistrationNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Notification;
use Ramsey\Uuid\Uuid;

class DeliverPendingRegistrationNotification implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $uniqueFor = 3600;

    public function __construct(
        public readonly string $adminId,
        public readonly string $registrationId,
        public readonly UserRole $applicantRole,
    ) {}

    public function uniqueId(): string
    {
        return "{$this->adminId}:{$this->registrationId}";
    }

    public function handle(): void
    {
        $admin = User::query()
            ->whereKey($this->adminId)
            ->where('role', UserRole::Admin)
            ->where('status', UserStatus::Active)
            ->whereHas('permissions', fn ($query) => $query->where('slug', 'notifications.view'))
            ->whereHas('permissions', fn ($query) => $query->where('slug', 'registrations.view'))
            ->first();

        if (! $admin) {
            return;
        }

        $notificationId = Uuid::uuid5(
            Uuid::NAMESPACE_URL,
            "aisley:admin:{$admin->id}:registration:{$this->registrationId}",
        )->toString();

        if ($admin->notifications()->whereKey($notificationId)->exists()) {
            return;
        }

        $notification = new PendingRegistrationNotification($this->registrationId, $this->applicantRole);
        $notification->id = $notificationId;
        Notification::sendNow($admin, $notification);
    }
}
