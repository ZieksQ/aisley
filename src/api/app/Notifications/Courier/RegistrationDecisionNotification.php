<?php

namespace App\Notifications\Courier;

use App\Enums\ApplicationStatus;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RegistrationDecisionNotification extends Notification
{
    public function __construct(
        public readonly ApplicationStatus $decision,
        public readonly ?string $reason = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        if ($this->decision === ApplicationStatus::Approved) {
            return (new MailMessage)
                ->subject('Your Aisley Courier registration was approved')
                ->line('Your associated Logistics organization approved your Courier registration.')
                ->line('You can now sign in to the Aisley Courier mobile app using the credentials you registered with.');
        }

        $message = (new MailMessage)
            ->subject('Your Aisley Courier registration was reviewed')
            ->line('Your associated Logistics organization did not approve your Courier registration.');
        if ($this->reason) {
            $message->line('Reason: '.$this->reason);
        }

        return $message->line('Contact your associated Logistics organization if you need more information.');
    }
}
