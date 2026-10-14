<?php

namespace App\Console\Commands;

use App\Enums\EmailDeliveryStatus;
use App\Models\TransactionalEmail;
use App\Services\Mail\TransactionalEmailDispatcher;
use Illuminate\Console\Command;

class RetryTransactionalEmail extends Command
{
    protected $signature = 'mail:retry {id : Failed transactional email UUID}';

    protected $description = 'Retry one exhausted transactional email without repeating its business operation';

    public function handle(TransactionalEmailDispatcher $dispatcher): int
    {
        $id = (string) $this->argument('id');
        $updated = TransactionalEmail::query()->whereKey($id)->where('status', EmailDeliveryStatus::Failed)->update([
            'status' => EmailDeliveryStatus::Pending,
            'attempts' => 0,
            'available_at' => now(),
            'claim_token' => null,
            'claim_expires_at' => null,
            'last_error_code' => null,
        ]);
        if (! $updated) {
            $this->error('No failed email found. Accepted or skipped emails cannot be replayed.');

            return self::FAILURE;
        }

        $queued = $dispatcher->dispatch($id);
        $this->info($queued ? 'Retry queued.' : 'Retry retained for scheduled recovery.');

        return self::SUCCESS;
    }
}
