<?php

namespace App\Services\Admin\Provisioning;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminSetupChallenge;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Services\Mail\TransactionalEmailOutbox;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AdminSetupService
{
    public function request(User $user, array $data): array
    {
        return DB::transaction(function () use ($user, $data): array {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            $this->credentials($user, $data);
            $history = AdminSetupChallenge::query()->where('user_id', $user->id);
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
            $challenge = AdminSetupChallenge::query()->create([
                'user_id' => $user->id, 'identity_fingerprint' => $this->identity($user),
                'replacement_fingerprint' => $user->admin_setup_required ? $this->fingerprint($data['password']) : null,
                'code_hash' => Hash::make($code), 'expires_at' => now()->addMinutes(10),
            ]);
            app(TransactionalEmailOutbox::class)->adminSetupCode($user, $challenge, $code);
            [$local, $domain] = explode('@', $user->email, 2);

            return ['challenge_id' => $challenge->id, 'masked_email' => mb_substr($local, 0, 1).'***@'.$domain,
                'expires_at' => $challenge->expires_at->toIso8601String(),
                'resend_available_at' => $challenge->created_at->copy()->addSeconds(60)->toIso8601String()];
        }, 3);
    }

    public function complete(User $user, array $data): User
    {
        $error = DB::transaction(function () use ($user, $data): ?string {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            $this->credentials($locked, $data);
            $challenge = AdminSetupChallenge::query()->whereKey($data['challenge_id'])->where('user_id', $locked->id)->lockForUpdate()->first();
            if (! $challenge || ! $this->isUsable($challenge, $locked)) {
                return 'This code is expired or unavailable. Request another code.';
            }
            if ($locked->admin_setup_required && ! hash_equals($challenge->replacement_fingerprint ?? '', $this->fingerprint($data['password']))) {
                $challenge->update(['invalidated_at' => now()]);

                return 'Your password details changed. Request another code.';
            }
            if (! Hash::check($data['verification_code'], $challenge->code_hash)) {
                $challenge->attempts++;
                if ($challenge->attempts >= 5) {
                    $challenge->invalidated_at = now();
                }
                $challenge->save();

                return $challenge->attempts >= 5 ? 'Too many incorrect codes. Request another code.' : 'The verification code is incorrect.';
            }
            $locked->forceFill([
                ...($locked->admin_setup_required ? ['password' => $data['password']] : []),
                'admin_setup_required' => false, 'admin_email_verification_required' => false,
                'email_verified_at' => now(), 'admin_session_version' => $locked->admin_session_version + 1,
                'admin_revision' => $locked->admin_revision + 1, 'remember_token' => null,
            ])->save();
            $challenge->update(['consumed_at' => now()]);
            AdminSetupChallenge::query()->where('user_id', $locked->id)->whereKeyNot($challenge->id)
                ->whereNull('consumed_at')->whereNull('invalidated_at')->update(['invalidated_at' => now()]);
            app(AuditService::class)->record(actor: $locked, action: AdminAuditAction::AdminSetupCompleted,
                sourceFeature: AuditSourceFeature::AdminAccountManagement, target: $locked,
                metadata: ['email_verified' => true], ipAddress: request()->ip(), userAgent: request()->userAgent());

            return null;
        }, 3);
        if ($error) {
            throw ValidationException::withMessages(['verification_code' => [$error]]);
        }

        return $user->refresh();
    }

    public function isUsable(AdminSetupChallenge $challenge, User $user): bool
    {
        return $user->role === UserRole::Admin && $user->status === UserStatus::Active && ! $user->admin_archived_at
            && $user->requiresAdminSetup() && $challenge->user_id === $user->id
            && ! $challenge->consumed_at && ! $challenge->invalidated_at && $challenge->attempts < 5
            && $challenge->expires_at->isFuture() && hash_equals($challenge->identity_fingerprint, $this->identity($user));
    }

    private function credentials(User $user, array $data): void
    {
        abort_unless($user->role === UserRole::Admin && $user->status === UserStatus::Active && ! $user->admin_archived_at, 403);
        abort_unless($user->requiresAdminSetup(), 409, 'Account setup is already complete.');
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => ['The password is incorrect.']]);
        }
        if ($user->admin_setup_required && Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => ['Choose a password different from your temporary password.']]);
        }
    }

    private function identity(User $user): string
    {
        return $this->fingerprint(json_encode([$user->id, $user->email, $user->password, $user->admin_session_version, $user->admin_setup_required]));
    }

    private function fingerprint(string $value): string
    {
        return hash_hmac('sha256', $value, (string) config('app.key'));
    }

    private function throttled(int $seconds): never
    {
        throw new HttpException(429, 'Please wait before requesting another code.', null, ['Retry-After' => (string) max(1, $seconds)]);
    }
}
