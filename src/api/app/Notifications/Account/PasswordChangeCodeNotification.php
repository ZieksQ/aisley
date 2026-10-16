<?php

namespace App\Notifications\Account;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordChangeCodeNotification extends Notification
{
    public function __construct(private readonly string $code) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)->subject('AISLEY password change verification')
            ->line('Use this verification code to confirm your account password change:')
            ->line($this->code)
            ->line('This code expires 10 minutes after it was requested. Only the latest code can be used.')
            ->line('If you did not request this change, do not share this code.');
    }
}
