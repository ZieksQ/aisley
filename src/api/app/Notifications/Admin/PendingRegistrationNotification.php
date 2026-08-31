<?php

namespace App\Notifications\Admin;

use App\Enums\UserRole;
use Illuminate\Notifications\Notification;

class PendingRegistrationNotification extends Notification
{
    public function __construct(
        public readonly string $registrationId,
        public readonly UserRole $applicantRole,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'account-registration.pending';
    }

    /** @return array<string, mixed> */
    public function toDatabase(object $notifiable): array
    {
        $role = match ($this->applicantRole) {
            UserRole::Customer => 'Customer',
            UserRole::Seller => 'Seller',
            UserRole::Courier => 'Courier',
            UserRole::Admin => 'Admin',
        };

        return [
            'title' => "New {$role} registration",
            'summary' => "A new {$role} registration is waiting for review.",
            'resource_type' => 'registration_application',
            'resource_id' => $this->registrationId,
            'destination' => "/registrations/{$this->registrationId}",
        ];
    }
}
