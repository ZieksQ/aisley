<?php

namespace App\Jobs\Finance;

use App\Models\FinanceGatewayEvent;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;

class DeliverGatewayEvent implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public function __construct(public string $eventId) {}

    public function backoff(): array
    {
        return [10, 30, 120, 600];
    }

    public function handle(): void
    {
        if (! config('finance.gateway_enabled')) {
            return;
        }
        $event = FinanceGatewayEvent::findOrFail($this->eventId);
        $body = json_encode($event->payload, JSON_THROW_ON_ERROR);
        $timestamp = now()->timestamp;
        $signature = hash_hmac('sha256', $timestamp.'.'.$body, config('finance.webhook_secret'));
        $event->increment('delivery_attempts');
        Http::timeout(15)->withHeaders(['X-Gateway-Signature' => 't='.$timestamp.',v1='.$signature])
            ->withBody($body, 'application/json')->post(config('finance.webhook_url'))->throw();
        $event->update(['delivered_at' => now()]);
    }
}
