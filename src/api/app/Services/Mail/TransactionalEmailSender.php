<?php

namespace App\Services\Mail;

use App\Enums\EmailDeliveryStatus;
use App\Enums\TransactionalEmailKind;
use App\Models\TransactionalEmail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Throwable;

class TransactionalEmailSender
{
    public const MAX_ATTEMPTS = 5;

    private const BACKOFF_SECONDS = [60, 120, 300, 600];

    public function __construct(private readonly TransactionalEmailNotificationFactory $notifications) {}

    public function deliver(string $id): void
    {
        $email = $this->claim($id);
        if (! $email) {
            return;
        }

        try {
            $user = User::query()->find($email->user_id);
            $notification = $this->notifications->make($email, $user);
            if (! $notification) {
                $this->finish($email, EmailDeliveryStatus::Skipped, ['last_error_code' => 'obsolete']);

                return;
            }

            // Delivery is owned by this outbox job, never by a second queued notification.
            if ($email->kind === TransactionalEmailKind::RegistrationCode) {
                Notification::route('mail', $email->payload['email'])->notify($notification);
            } else {
                Notification::sendNow($user, $notification, ['mail']);
            }
            $this->finish($email, EmailDeliveryStatus::Accepted, ['accepted_at' => now()]);
        } catch (Throwable) {
            $exhausted = $email->attempts >= self::MAX_ATTEMPTS;
            $this->finish($email, $exhausted ? EmailDeliveryStatus::Failed : EmailDeliveryStatus::Pending, [
                'last_error_code' => 'delivery_failed',
                'available_at' => now()->addSeconds(self::BACKOFF_SECONDS[min($email->attempts - 1, 3)]),
            ]);
            Log::warning('Transactional email delivery failed.', ['email_id' => $id, 'attempt' => $email->attempts]);
        }
    }

    private function claim(string $id): ?TransactionalEmail
    {
        return DB::transaction(function () use ($id): ?TransactionalEmail {
            $email = TransactionalEmail::query()->whereKey($id)->lockForUpdate()->first();
            if (! $email || in_array($email->status, [EmailDeliveryStatus::Accepted, EmailDeliveryStatus::Failed, EmailDeliveryStatus::Skipped], true)) {
                return null;
            }
            if ($email->status === EmailDeliveryStatus::Pending && $email->available_at->isFuture()) {
                return null;
            }
            if ($email->status === EmailDeliveryStatus::Sending && $email->claim_expires_at?->isFuture()) {
                return null;
            }
            if ($email->attempts >= self::MAX_ATTEMPTS) {
                $email->update(['status' => EmailDeliveryStatus::Failed, 'claim_token' => null, 'claim_expires_at' => null]);

                return null;
            }

            $email->update([
                'status' => EmailDeliveryStatus::Sending,
                'attempts' => $email->attempts + 1,
                'claim_token' => (string) Str::uuid(),
                'claim_expires_at' => now()->addMinutes(2),
            ]);

            return $email;
        }, 3);
    }

    private function finish(TransactionalEmail $email, EmailDeliveryStatus $status, array $extra): void
    {
        TransactionalEmail::query()->whereKey($email->id)->where('status', EmailDeliveryStatus::Sending)
            ->where('claim_token', $email->claim_token)->update([
                'status' => $status,
                'claim_token' => null,
                'claim_expires_at' => null,
                'last_error_code' => null,
                ...($status === EmailDeliveryStatus::Accepted || $status === EmailDeliveryStatus::Skipped ? ['payload' => null] : []),
                ...$extra,
            ]);
    }
}
