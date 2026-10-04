<?php

namespace App\Jobs\Finance;

use App\Services\Finance\Gateway\SandboxGatewayService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ResolveGatewayTransaction implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $transactionId) {}

    public function handle(SandboxGatewayService $gateway): void
    {
        $gateway->resolve($this->transactionId);
    }
}
