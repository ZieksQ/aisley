<?php

namespace App\Services\Mail;

use App\Enums\ApplicationStatus;
use App\Enums\TransactionalEmailKind;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\RegistrationApplication;
use App\Models\TransactionalEmail;
use App\Models\User;
use App\Notifications\Admin\RegistrationDecisionNotification;
use App\Notifications\Courier\RegistrationDecisionNotification as CourierDecisionNotification;
use App\Notifications\Customer\ResetPasswordNotification as CustomerResetNotification;
use App\Notifications\Logistics\ResetPasswordNotification as LogisticsResetNotification;
use App\Notifications\Seller\ResetPasswordNotification as SellerResetNotification;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class TransactionalEmailNotificationFactory
{
    public function make(TransactionalEmail $email, User $user): ?Notification
    {
        $payload = $email->payload;
        if (! $payload || $user->role !== $email->role || $user->email !== $payload['email']) {
            return null;
        }

        if ($email->kind === TransactionalEmailKind::PasswordReset) {
            $reset = DB::table('password_reset_tokens')->where('email', $user->email)
                ->where('role', $email->role->value)->first();
            if (! $reset || $user->status !== UserStatus::Active
                || Carbon::parse($reset->created_at)->addMinutes((int) config($email->role->value.'.auth.password_reset_expire_minutes', 60))->lte(now())
                || ! Hash::check($payload['token'], $reset->token)) {
                return null;
            }

            return match ($email->role) {
                UserRole::Customer => new CustomerResetNotification($payload['token']),
                UserRole::Seller => new SellerResetNotification($payload['token']),
                UserRole::Logistics => new LogisticsResetNotification($payload['token']),
                default => null,
            };
        }

        $application = RegistrationApplication::query()->whereKey($payload['application_id'])
            ->where('user_id', $user->id)->where('application_type', $email->role)->first();
        $decision = ApplicationStatus::from($payload['decision']);
        if (! $application || $application->status !== $decision || $decision === ApplicationStatus::Pending) {
            return null;
        }

        return $email->role === UserRole::Courier
            ? new CourierDecisionNotification($decision, $payload['reason'])
            : new RegistrationDecisionNotification($decision, $email->role, $payload['reason']);
    }
}
