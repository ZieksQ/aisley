<?php

namespace App\Services\Mail;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PasswordResetDeliveryService
{
    public function __construct(private readonly TransactionalEmailOutbox $outbox) {}

    public function request(string $email, UserRole $role): void
    {
        if (! in_array($role, [UserRole::Customer, UserRole::Seller, UserRole::Logistics], true)) {
            throw new \InvalidArgumentException('Password recovery is unavailable for this role.');
        }

        DB::transaction(function () use ($email, $role): void {
            $user = User::query()->where('email', $email)->where('role', $role)
                ->where('status', UserStatus::Active)->lockForUpdate()->first();
            if (! $user) {
                return;
            }

            $token = Str::random(64);
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email, 'role' => $role->value],
                ['token' => Hash::make($token), 'created_at' => now()],
            );
            $this->outbox->passwordReset($user, $token);
        }, 3);
    }
}
