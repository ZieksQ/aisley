<?php

namespace App\Console\Commands;

use App\Services\Logistics\AutomaticDeliveryApprovalService;
use Illuminate\Console\Command;

class RecoverDeliveryApprovals extends Command
{
    protected $signature = 'deliveries:recover-approvals';

    protected $description = 'Redispatch unfinished automatic prepaid POD reviews';

    public function handle(AutomaticDeliveryApprovalService $service): int
    {
        $service->recover();

        return self::SUCCESS;
    }
}
