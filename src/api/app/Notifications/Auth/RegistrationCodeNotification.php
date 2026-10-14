<?php

namespace App\Notifications\Auth;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RegistrationCodeNotification extends Notification
{
    public function __construct(private readonly string $code) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)->subject('Verify your AISLEY registration email')
            ->line('Enter this code to verify your email before registering with AISLEY:')
            ->line($this->code)->line('This code expires in 10 minutes. Do not share it.')
            ->line('Email verification does not approve your account. Registration still requires review.')
            ->line('If you did not request this code, you can ignore this email.');
    }
}
