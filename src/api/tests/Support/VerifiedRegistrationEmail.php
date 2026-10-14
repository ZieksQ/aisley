<?php

namespace Tests\Support;

use App\Enums\UserRole;
use App\Models\RegistrationEmailChallenge;
use App\Models\RegistrationEmailIdentity;
use Illuminate\Support\Facades\Hash;

trait VerifiedRegistrationEmail
{
    protected function registrationEmailToken(UserRole $role, string $email): string
    {
        $identity = RegistrationEmailIdentity::query()->firstOrCreate(['email' => mb_strtolower(trim($email)), 'role' => $role]);
        $token = bin2hex(random_bytes(32));
        RegistrationEmailChallenge::query()->create([
            'identity_id' => $identity->id, 'code_hash' => Hash::make('012345'),
            'expires_at' => now()->addMinutes(10), 'verified_at' => now(),
            'verification_expires_at' => now()->addHour(), 'token' => $token, 'token_hash' => hash('sha256', $token),
        ]);

        return $token;
    }
}
