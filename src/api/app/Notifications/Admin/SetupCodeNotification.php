<?php

namespace App\Notifications\Admin;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SetupCodeNotification extends Notification
{
    public function __construct(private readonly string $code) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)->subject('Verify your AISLEY Admin email')
            ->line('Use this code to verify your Admin email and complete your account setup:')
            ->line($this->code)->line('This code expires in 10 minutes. Only the latest code can be used.')
            ->line('If you did not request this code, do not share it.');
    }
}
