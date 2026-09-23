<?php

namespace App\Console\Commands;

use App\Services\Finance\SandboxSettlementService;
use Illuminate\Console\Command;

class RunSandboxSettlement extends Command
{
    protected $signature = 'finance:settle';

    protected $description = 'Reserve eligible beneficiary balances and run deterministic sandbox payouts.';

    public function handle(SandboxSettlementService $settlement): int
    {
        $this->info('Created '.$settlement->run().' sandbox payout(s).');

        return self::SUCCESS;
    }
}
