<?php

namespace App\Services\Auth;

use App\Enums\UserRole;
use App\Models\PlatformFeatureControl;
use App\Models\RegistrationEmailChallenge;
use App\Models\RegistrationEmailIdentity;
use App\Models\User;
use App\Services\Mail\TransactionalEmailOutbox;
use App\Services\PlatformFeatureControlService;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RegistrationEmailVerification
{
    public function __construct(private readonly TransactionalEmailOutbox $outbox) {}

    public function isRequired(): bool
    {
        return app(PlatformFeatureControlService::class)->isEnabled(
            PlatformFeatureControl::REGISTRATION_EMAIL_VERIFICATION_REQUIRED,
        );
    }

    public function completeRegistration(UserRole $role, string $email, string $token, Closure $registration): User
    {
        return DB::transaction(function () use ($role, $email, $token, $registration): User {
            if ($this->isRequired()) {
                return $this->complete($role, $email, $token, $registration);
            }

            $user = $registration();
            $user->forceFill(['email_verified_at' => null])->save();

            return $user;
        });
    }

    public function request(UserRole $role, string $email): array
    {
        // A persistent unique identity gives concurrent first requests a common lock.
        $identity = RegistrationEmailIdentity::query()->firstOrCreate(['email' => $email, 'role' => $role]);

        return DB::transaction(function () use ($identity): array {
            RegistrationEmailIdentity::query()->whereKey($identity->id)->lockForUpdate()->firstOrFail();
            $history = RegistrationEmailChallenge::query()->where('identity_id', $identity->id);
            $latest = (clone $history)->latest()->first();
            if ($latest && $latest->created_at->copy()->addSeconds(60)->isFuture()) {
                $this->throttled($latest->created_at->copy()->addSeconds(60));
            }
            $recent = (clone $history)->where('created_at', '>', now()->subHour());
            if ((clone $recent)->count() >= 5) {
                $this->throttled($recent->oldest()->first()->created_at->copy()->addHour());
            }
            $history->whereNull('consumed_at')->whereNull('invalidated_at')->update([
                'invalidated_at' => now(), 'token' => null, 'token_hash' => null, 'code_hash' => null,
            ]);
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $challenge = RegistrationEmailChallenge::query()->create([
                'identity_id' => $identity->id,
                'code_hash' => Hash::make($code),
                'expires_at' => now()->addMinutes(10),
            ]);
            $this->outbox->registrationCode($identity, $challenge, $code);

            return [
                'message' => 'Check your email for a registration verification code.',
                'challenge_id' => $challenge->id,
                'expires_at' => $challenge->expires_at->toIso8601String(),
                'resend_available_at' => $challenge->created_at->copy()->addSeconds(60)->toIso8601String(),
            ];
        }, 3);
    }

    public function verify(UserRole $role, string $email, string $id, string $code): array
    {
        // Return failures after committing, preserving the incorrect-attempt counter.
        $result = DB::transaction(function () use ($role, $email, $id, $code): array|string {
            $identity = RegistrationEmailIdentity::query()->where('email', $email)->where('role', $role)->lockForUpdate()->first();
            $challenge = $identity ? RegistrationEmailChallenge::query()->whereKey($id)
                ->where('identity_id', $identity->id)->lockForUpdate()->first() : null;
            if (! $challenge || $challenge->invalidated_at || $challenge->consumed_at || $challenge->attempts >= 5
                || ! $challenge->code_hash
                || ($challenge->verified_at ? $challenge->verification_expires_at->lte(now()) : $challenge->expires_at->lte(now()))) {
                return 'This code is expired or unavailable. Request a new code.';
            }
            if (! Hash::check($code, $challenge->code_hash)) {
                $challenge->attempts++;
                if ($challenge->attempts >= 5) {
                    $challenge->invalidated_at = now();
                    $challenge->token = null;
                    $challenge->token_hash = null;
                    $challenge->code_hash = null;
                }
                $challenge->save();

                return $challenge->attempts >= 5 ? 'Too many incorrect codes. Request a new code.' : 'The verification code is incorrect.';
            }
            if (! $challenge->verified_at) {
                $token = bin2hex(random_bytes(32));
                $challenge->update([
                    'verified_at' => now(), 'verification_expires_at' => now()->addHour(),
                    'token' => $token, 'token_hash' => hash('sha256', $token),
                ]);
            }

            return [
                'message' => 'Email verified. Complete your registration.',
                'email_verification_token' => $challenge->token,
                'expires_at' => $challenge->verification_expires_at->toIso8601String(),
            ];
        }, 3);
        if (is_string($result)) {
            throw ValidationException::withMessages(['verification_code' => [$result]]);
        }

        return $result;
    }

    public function complete(UserRole $role, string $email, string $token, Closure $registration): User
    {
        return DB::transaction(function () use ($role, $email, $token, $registration): User {
            $identity = RegistrationEmailIdentity::query()->where('email', $email)->where('role', $role)->lockForUpdate()->first();
            $challenge = $identity ? RegistrationEmailChallenge::query()->where('identity_id', $identity->id)
                ->where('token_hash', hash('sha256', $token))->lockForUpdate()->first() : null;
            if (! $challenge || ! $challenge->verified_at || $challenge->invalidated_at || $challenge->consumed_at
                || $challenge->verification_expires_at->lte(now())) {
                throw ValidationException::withMessages(['email_verification_token' => ['Verify your email before submitting registration.']]);
            }
            $user = $registration();
            $user->forceFill(['email_verified_at' => $challenge->verified_at])->save();
            $challenge->update(['consumed_at' => now(), 'token' => null, 'token_hash' => null, 'code_hash' => null]);

            return $user;
        });
    }

    public function isDeliverable(RegistrationEmailChallenge $challenge): bool
    {
        return ! $challenge->invalidated_at && ! $challenge->consumed_at && ! $challenge->verified_at
            && $challenge->attempts < 5 && $challenge->expires_at->isFuture();
    }

    private function throttled(\DateTimeInterface $until): never
    {
        $seconds = max(1, (int) ceil(now()->diffInSeconds($until, false)));
        throw new HttpException(429, 'Please wait before requesting another code.', null, ['Retry-After' => (string) $seconds]);
    }
}
