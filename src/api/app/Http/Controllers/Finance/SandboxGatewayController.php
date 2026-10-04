<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\GatewayPaymentRequest;
use App\Models\SandboxGatewayTransaction;
use App\Services\Finance\Gateway\SandboxGatewayService;
use Illuminate\Http\Request;

class SandboxGatewayController extends Controller
{
    public function create(GatewayPaymentRequest $request, SandboxGatewayService $gateway)
    {
        $data = $request->validated();
        $key = $data['idempotency_key'];
        unset($data['idempotency_key']);
        $transaction = $gateway->create($key, $data);
        if ($transaction->wasRecentlyCreated && $transaction->scenario->value === 'lost_response') {
            abort(504, 'Simulated response lost after payment creation.');
        }

        return response()->json(['data' => $gateway->object($transaction)], 201)->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $transaction, SandboxGatewayService $gateway)
    {
        abort_unless(config('finance.gateway_enabled') && hash_equals((string) config('finance.gateway_key'), (string) $request->bearerToken()), 403);

        return response()->json(['data' => $gateway->object(SandboxGatewayTransaction::findOrFail($transaction))])->header('Cache-Control', 'private, no-store');
    }
}
