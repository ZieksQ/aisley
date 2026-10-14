<?php

namespace App\Jobs\Mail;

use App\Services\Mail\TransactionalEmailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

class DeliverTransactionalEmail implements ShouldBeEncrypted, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 5;

    public int $timeout = 60;

    public function __construct(public readonly string $emailId) {}

    public function backoff(): array
    {
        return [60, 120, 300, 600];
    }

    public function handle(TransactionalEmailSender $sender): void
    {
        $sender->deliver($this->emailId);
    }
}
