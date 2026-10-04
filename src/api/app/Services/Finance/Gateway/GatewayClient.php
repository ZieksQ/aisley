<?php

namespace App\Services\Finance\Gateway;

use App\Models\FinancePaymentAttempt;
use Illuminate\Support\Facades\Http;

class GatewayClient
{
    public function send(FinancePaymentAttempt $attempt): array
    {
        abort_unless(config('finance.gateway_enabled'), 503, 'Sandbox gateway is disabled.');
        $request = Http::withToken(config('finance.gateway_key'))->acceptJson()->timeout(15);
        if ($attempt->provider_reference) {
            return $request->get(config('finance.gateway_url').'/payments/'.$attempt->provider_reference)->throw()->json('data');
        }

        return $request->withHeaders(['Idempotency-Key' => $attempt->idempotency_key])
            ->post(config('finance.gateway_url').'/payments', [
                'direction' => $attempt->direction->value, 'amount_cents' => $attempt->amount_cents,
                'currency' => $attempt->currency, 'account_reference' => $attempt->account_reference,
                'metadata' => ['attempt_id' => $attempt->id],
            ])->throw()->json('data');
    }
}
