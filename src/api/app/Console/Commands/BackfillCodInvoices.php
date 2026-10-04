<?php

namespace App\Console\Commands;

use App\Services\Finance\Automation\FinanceBackfillService;
use Illuminate\Console\Command;

class BackfillCodInvoices extends Command
{
    protected $signature = 'finance:backfill-invoices';

    protected $description = 'Create historical COD invoices; unresolved collector evidence enters Admin review.';

    public function handle(FinanceBackfillService $backfill): int
    {
        $this->info('Created '.$backfill->run().' historical invoice(s).');

        return self::SUCCESS;
    }
}
