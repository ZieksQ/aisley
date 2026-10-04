<?php

namespace App\Console\Commands;

use App\Services\Finance\Automation\FinanceAutomationService;
use Illuminate\Console\Command;

class RunFinanceAutomation extends Command
{
    protected $signature = 'finance:automate';

    protected $description = 'Run due collection/payout schedules and reconcile pending sandbox payments.';

    public function handle(FinanceAutomationService $automation): int
    {
        $this->info('Created '.$automation->tick().' payment batch(es).');

        return self::SUCCESS;
    }
}
