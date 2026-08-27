<?php

namespace App\Notifications\Customer;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(public readonly string $token) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $resetUrl = rtrim((string) config('customer.auth.password_reset_url'), '/').'?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->email,
        ]);

        return (new MailMessage)
            ->subject('Reset your Aisley Customer password')
            ->line('We received a request to reset your Aisley Customer account password.')
            ->action('Reset password', $resetUrl)
            ->line('This link expires in '.config('customer.auth.password_reset_expire_minutes', 60).' minutes.')
            ->line('If you did not request a password reset, no action is required.');
    }
}
