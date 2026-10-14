<?php

namespace App\Services\Mail;

use App\Enums\ApplicationStatus;
use App\Enums\EmailDeliveryStatus;
use App\Enums\TransactionalEmailKind;
use App\Models\RegistrationApplication;
use App\Models\TransactionalEmail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TransactionalEmailOutbox
{
    public function passwordReset(User $user, string $token): TransactionalEmail
    {
        return $this->record($user, TransactionalEmailKind::PasswordReset, 'reset:'.Str::uuid(), [
            'email' => $user->email,
            'token' => $token,
        ]);
    }

    public function registrationDecision(RegistrationApplication $application): TransactionalEmail
    {
        return $this->record(
            $application->user,
            TransactionalEmailKind::RegistrationDecision,
            "registration:{$application->id}:{$application->status->value}",
            [
                'email' => $application->user->email,
                'application_id' => $application->id,
                'decision' => $application->status->value,
                'reason' => $application->status === ApplicationStatus::Rejected ? $application->rejection_reason : null,
            ],
        );
    }

    private function record(User $user, TransactionalEmailKind $kind, string $key, array $payload): TransactionalEmail
    {
        $email = TransactionalEmail::query()->firstOrCreate(['deduplication_key' => $key], [
            'user_id' => $user->id,
            'role' => $user->role,
            'kind' => $kind,
            'payload' => $payload,
            'status' => EmailDeliveryStatus::Pending,
            'available_at' => now(),
        ]);

        DB::afterCommit(fn () => app(TransactionalEmailDispatcher::class)->dispatch($email->id));

        return $email;
    }
}
