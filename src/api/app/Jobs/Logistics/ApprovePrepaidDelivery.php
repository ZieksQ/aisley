<?php

namespace App\Jobs\Logistics;

use App\Services\Logistics\AutomaticDeliveryApprovalService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ApprovePrepaidDelivery implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public string $intentId) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(AutomaticDeliveryApprovalService $service): void
    {
        $service->approve($this->intentId);
    }
}
