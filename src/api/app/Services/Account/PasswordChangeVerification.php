<?php

namespace App\Services\Account;

use App\Enums\UserStatus;
use App\Models\PasswordChangeChallenge;
use App\Models\User;
use App\Services\Mail\TransactionalEmailOutbox;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PasswordChangeVerification
{
    public function __construct(private readonly TransactionalEmailOutbox $outbox) {}

    public function request(User $user, string $currentPassword, string $password): array
    {
        return DB::transaction(function () use ($user, $currentPassword, $password): array {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            abort_unless($locked->role === $user->role, 403);
            $this->checkCredentials($locked, $currentPassword);
            $history = PasswordChangeChallenge::query()->where('user_id', $locked->id);
            $latest = (clone $history)->latest()->first();
            if ($latest && $latest->created_at->copy()->addSeconds(60)->isFuture()) {
                $this->throttled((int) ceil(now()->diffInSeconds($latest->created_at->copy()->addSeconds(60), false)));
            }
            $recent = (clone $history)->where('created_at', '>', now()->subHour());
            if ((clone $recent)->count() >= 5) {
                $this->throttled((int) ceil(now()->diffInSeconds($recent->oldest()->first()->created_at->addHour(), false)));
            }
            $history->whereNull('consumed_at')->whereNull('invalidated_at')->update(['invalidated_at' => now()]);
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $challenge = PasswordChangeChallenge::query()->create([
                'user_id' => $locked->id,
                'role' => $locked->role,
                'identity_fingerprint' => $this->identityFingerprint($locked),
                'password_fingerprint' => $this->fingerprint('replacement', $password),
                'code_hash' => Hash::make($code),
                'expires_at' => now()->addMinutes(10),
            ]);
            $this->outbox->passwordChangeCode($locked, $challenge, $code);
            [$local, $domain] = explode('@', $locked->email, 2);

            return [
                'challenge_id' => $challenge->id,
                'masked_email' => mb_substr($local, 0, 1).'***@'.$domain,
                'expires_at' => $challenge->expires_at->toIso8601String(),
                'resend_available_at' => $challenge->created_at->copy()->addSeconds(60)->toIso8601String(),
            ];
        }, 3);
    }

    public function complete(User $user, string $currentPassword, string $password, string $challengeId, string $code, Closure $mutation): void
    {
        // Return validation errors out of the transaction so failed attempts remain durable.
        $error = DB::transaction(function () use ($user, $currentPassword, $password, $challengeId, $code, $mutation): ?string {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            abort_unless($locked->role === $user->role, 403);
            $this->checkCredentials($locked, $currentPassword);
            $challenge = PasswordChangeChallenge::query()->whereKey($challengeId)
                ->where('user_id', $locked->id)->where('role', $locked->role)->lockForUpdate()->first();
            if (! $challenge || ! $this->isUsable($challenge, $locked)) {
                return 'This code is expired or unavailable. Request a new code.';
            }
            if (! hash_equals($challenge->password_fingerprint, $this->fingerprint('replacement', $password))) {
                $challenge->update(['invalidated_at' => now()]);

                return 'Your password details changed. Request a new code.';
            }
            if (! Hash::check($code, $challenge->code_hash)) {
                $challenge->attempts++;
                if ($challenge->attempts >= 5) {
                    $challenge->invalidated_at = now();
                }
                $challenge->save();

                return $challenge->attempts >= 5 ? 'Too many incorrect codes. Request a new code.' : 'The verification code is incorrect.';
            }
            $mutation($locked);
            $challenge->update(['consumed_at' => now()]);
            PasswordChangeChallenge::query()->where('user_id', $locked->id)->whereKeyNot($challenge->id)
                ->whereNull('consumed_at')->whereNull('invalidated_at')->update(['invalidated_at' => now()]);

            return null;
        }, 3);

        if ($error) {
            throw ValidationException::withMessages(['verification_code' => [$error]]);
        }
    }

    public function isUsable(PasswordChangeChallenge $challenge, User $user): bool
    {
        return $challenge->user_id === $user->id && $challenge->role === $user->role
            && $user->status === UserStatus::Active && ! $challenge->consumed_at && ! $challenge->invalidated_at
            && $challenge->attempts < 5 && $challenge->expires_at->isFuture()
            && hash_equals($challenge->identity_fingerprint, $this->identityFingerprint($user));
    }

    private function identityFingerprint(User $user): string
    {
        return $this->fingerprint('identity', json_encode([$user->id, $user->role->value, $user->email, $user->password]));
    }

    private function fingerprint(string $purpose, string $value): string
    {
        return hash_hmac('sha256', $purpose.'|'.$value, (string) config('app.key'));
    }

    private function checkCredentials(User $user, string $password): void
    {
        abort_unless($user->status === UserStatus::Active, 403);
        if (! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages(['current_password' => ['The password is incorrect.']]);
        }
    }

    private function throttled(int $seconds): never
    {
        throw new HttpException(429, 'Please wait before requesting another code.', null, ['Retry-After' => (string) max(1, $seconds)]);
    }
}
