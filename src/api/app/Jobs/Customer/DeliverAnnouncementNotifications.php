<?php

namespace App\Jobs\Customer;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Announcement;
use App\Models\User;
use App\Notifications\Customer\AnnouncementPublishedNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Ramsey\Uuid\Uuid;

class DeliverAnnouncementNotifications implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $announcementId) {}

    public function handle(): void
    {
        $announcement = Announcement::query()->find($this->announcementId);
        if ($announcement === null) {
            return;
        }

        User::query()->where('role', UserRole::Customer)->where('status', UserStatus::Active)
            ->select(['id', 'role', 'status'])->chunkById(200, function ($customers) use ($announcement): void {
                foreach ($customers as $customer) {
                    $id = Uuid::uuid5(Uuid::NAMESPACE_URL, "aisley:customer:{$customer->id}:announcement:{$announcement->id}")->toString();
                    if ($customer->notifications()->whereKey($id)->exists()) {
                        continue;
                    }
                    $notification = new AnnouncementPublishedNotification($announcement);
                    $notification->id = $id;
                    $customer->notify($notification);
                }
            });
    }
}
