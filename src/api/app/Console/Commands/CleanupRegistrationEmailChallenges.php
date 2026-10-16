<?php

namespace App\Console\Commands;

use App\Models\RegistrationEmailChallenge;
use Illuminate\Console\Command;

class CleanupRegistrationEmailChallenges extends Command
{
    protected $signature = 'auth:cleanup-registration-codes';

    protected $description = 'Remove expired registration verification secrets and obsolete challenge history';

    public function handle(): int
    {
        RegistrationEmailChallenge::query()->where(function ($query): void {
            $query->whereNotNull('consumed_at')->orWhereNotNull('invalidated_at')
                ->orWhere(fn ($q) => $q->whereNull('verified_at')->where('expires_at', '<=', now()))
                ->orWhere('verification_expires_at', '<=', now());
        })->update(['token' => null, 'token_hash' => null, 'code_hash' => null]);
        RegistrationEmailChallenge::query()->where('created_at', '<', now()->subDay())
            ->whereNull('token_hash')->delete();

        return self::SUCCESS;
    }
}
