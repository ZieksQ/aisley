<?php

namespace App\Notifications\Customer;

use App\Models\Announcement;
use Illuminate\Notifications\Notification;

class AnnouncementPublishedNotification extends Notification
{
    public function __construct(private readonly Announcement $announcement) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'customer-announcement.published';
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => $this->announcement->title,
            'summary' => $this->announcement->body,
            'announcement_id' => $this->announcement->id,
        ];
    }
}
