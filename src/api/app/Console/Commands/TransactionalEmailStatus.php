<?php

namespace App\Console\Commands;

use App\Enums\EmailDeliveryStatus;
use App\Models\TransactionalEmail;
use Illuminate\Console\Command;

class TransactionalEmailStatus extends Command
{
    protected $signature = 'mail:status {--failed : Show only exhausted deliveries} {--limit=50}';

    protected $description = 'Inspect transactional email delivery metadata without recipients, tokens, or content';

    public function handle(): int
    {
        $rows = TransactionalEmail::query()
            ->when($this->option('failed'), fn ($query) => $query->where('status', EmailDeliveryStatus::Failed))
            ->latest()->limit(max(1, min((int) $this->option('limit'), 200)))
            ->get(['id', 'role', 'kind', 'status', 'attempts', 'last_error_code'])
            ->map(fn (TransactionalEmail $email): array => [
                $email->id, $email->role->value, $email->kind->value,
                $email->status->value, $email->attempts, $email->last_error_code ?? '',
            ]);

        $this->table(['ID', 'Role', 'Kind', 'Status', 'Attempts', 'Error code'], $rows->all());

        return self::SUCCESS;
    }
}
