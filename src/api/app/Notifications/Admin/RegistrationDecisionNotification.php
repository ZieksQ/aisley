<?php

namespace App\Notifications\Admin;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RegistrationDecisionNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly ApplicationStatus $decision,
        public readonly UserRole $role,
        public readonly ?string $reason = null,
    ) {
        $this->afterCommit();
    }

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $role = match ($this->role) {
            UserRole::Customer => 'Customer',
            UserRole::Seller => 'Seller',
            default => ucfirst($this->role->value),
        };

        if ($this->decision === ApplicationStatus::Approved) {
            return (new MailMessage)
                ->subject("Your Aisley {$role} registration was approved")
                ->line("Your Aisley {$role} account registration has been approved.")
                ->line('You can now sign in using the credentials you registered with.');
        }

        $message = (new MailMessage)
            ->subject("Your Aisley {$role} registration was reviewed")
            ->line("Your Aisley {$role} account registration was not approved.");

        if ($this->reason) {
            $message->line('Reason: '.$this->reason);
        }

        return $message->line('Contact Aisley support if you need more information.');
    }
}
