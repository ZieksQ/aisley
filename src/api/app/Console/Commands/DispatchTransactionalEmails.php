<?php

namespace App\Console\Commands;

use App\Models\TransactionalEmail;
use App\Services\Mail\TransactionalEmailDispatcher;
use Illuminate\Console\Command;

class DispatchTransactionalEmails extends Command
{
    protected $signature = 'mail:dispatch-pending {--limit=100}';

    protected $description = 'Recover pending or abandoned transactional email deliveries';

    public function handle(TransactionalEmailDispatcher $dispatcher): int
    {
        $ids = TransactionalEmail::query()->ready()->oldest()->limit(max(1, min((int) $this->option('limit'), 1000)))->pluck('id');
        $count = 0;
        foreach ($ids as $id) {
            $count += (int) $dispatcher->dispatch($id);
        }
        $this->info("Queued {$count} transactional email(s).");

        return self::SUCCESS;
    }
}
