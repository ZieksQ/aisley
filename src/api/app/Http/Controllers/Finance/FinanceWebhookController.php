<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\GatewayWebhookRequest;
use App\Jobs\Finance\ProcessFinanceWebhook;
use App\Models\FinanceWebhookReceipt;

class FinanceWebhookController extends Controller
{
    public function __invoke(GatewayWebhookRequest $request)
    {
        $data = $request->validated();
        abort_unless($request->input('livemode') === false, 422, 'Only sandbox events are accepted.');
        abort_unless($request->input('type') === $request->input('data.direction').'.'.$request->input('data.status'), 422, 'Event type does not match its payment result.');
        $payload = $request->json()->all();
        $receipt = FinanceWebhookReceipt::query()->firstOrCreate(['event_id' => $data['id']], ['payload' => $payload]);
        abort_unless($receipt->payload === $payload, 409, 'Event ID payload mismatch.');
        if ($receipt->processed_at === null) {
            ProcessFinanceWebhook::dispatch($receipt->id);
        }

        return response()->json(['received' => true]);
    }
}
