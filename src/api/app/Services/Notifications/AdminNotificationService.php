<?php

namespace App\Services\Notifications;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\Admin\DeliverPendingRegistrationNotification;
use App\Models\RegistrationApplication;
use App\Models\User;

class AdminNotificationService
{
    public function registrationSubmitted(RegistrationApplication $application): void
    {
        User::query()
            ->where('role', UserRole::Admin)
            ->where('status', UserStatus::Active)
            ->whereHas('permissions', fn ($query) => $query->where('slug', 'notifications.view'))
            ->whereHas('permissions', fn ($query) => $query->where('slug', 'registrations.view'))
            ->eachById(function (User $admin) use ($application): void {
                DeliverPendingRegistrationNotification::dispatch(
                    $admin->id,
                    $application->id,
                    $application->application_type,
                )->afterCommit();
            });
    }
}
