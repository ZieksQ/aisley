<?php

namespace App\Services\Mail;

use App\Enums\EmailDeliveryStatus;
use App\Jobs\Mail\DeliverTransactionalEmail;
use App\Models\TransactionalEmail;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class TransactionalEmailDispatcher
{
    public function dispatch(string $id): bool
    {
        try {
            $reserved = DB::transaction(function () use ($id): bool {
                $email = TransactionalEmail::query()->whereKey($id)->ready()->lockForUpdate()->first();
                if (! $email) {
                    return false;
                }
                $email->update([
                    'status' => EmailDeliveryStatus::Queued,
                    'claim_token' => null,
                    'claim_expires_at' => now()->addMinutes(5),
                ]);

                return true;
            });

            if (! $reserved) {
                return false;
            }

            // Always asynchronous, even if the application's default connection is sync.
            Bus::dispatch((new DeliverTransactionalEmail($id))->onConnection('database'));

            return true;
        } catch (Throwable) {
            // Retain the intent for scheduled recovery; never expose SMTP/queue secrets.
            try {
                TransactionalEmail::query()->whereKey($id)->where('status', EmailDeliveryStatus::Queued)->update([
                    'status' => EmailDeliveryStatus::Pending,
                    'claim_expires_at' => null,
                    'available_at' => now()->addMinute(),
                    'last_error_code' => 'queue_unavailable',
                ]);
            } catch (Throwable) {
                // A queued reservation also becomes recoverable when its lease expires.
            }
            try {
                Log::warning('Transactional email dispatch unavailable.', ['email_id' => $id]);
            } catch (Throwable) {
                // Even a logging outage must not turn a committed decision into a failed response.
            }

            return false;
        }
    }
}
