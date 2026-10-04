<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\SandboxAccountRequest;
use App\Http\Requests\Finance\SandboxResolveRequest;
use App\Jobs\Finance\DeliverGatewayEvent;
use App\Models\FinanceGatewayEvent;
use App\Models\LogisticsOrganization;
use App\Models\SandboxGatewayAccount;
use App\Models\SandboxGatewayTransaction;
use App\Services\Finance\Gateway\SandboxGatewayService;
use Illuminate\Support\Facades\DB;

class FinanceSandboxController extends Controller
{
    public function index()
    {
        return response()->json(['accounts' => SandboxGatewayAccount::query()->orderBy('reference')->get(),
            'transactions' => SandboxGatewayTransaction::query()->latest()->paginate(25),
            'events' => FinanceGatewayEvent::query()->latest()->limit(25)->get(),
            'organizations' => LogisticsOrganization::query()->orderBy('business_name')->get(['id', 'business_name'])])->header('Cache-Control', 'private, no-store');
    }

    public function account(SandboxAccountRequest $request)
    {
        abort_unless(config('finance.gateway_enabled'), 503, 'Sandbox gateway is disabled.');
        $data = $request->validated();
        $account = DB::transaction(function () use ($data) {
            SandboxGatewayAccount::query()->firstOrCreate(['reference' => $data['reference']]);
            $account = SandboxGatewayAccount::query()->where('reference', $data['reference'])->lockForUpdate()->firstOrFail();
            $account->update($data);

            return $account->refresh();
        });

        return response()->json(['data' => $account]);
    }

    public function resolve(SandboxResolveRequest $request, string $transaction, SandboxGatewayService $gateway)
    {
        abort_unless(config('finance.gateway_enabled'), 503);
        $data = $request->validated();

        return response()->json(['data' => $gateway->object($gateway->resolve($transaction, $data['outcome']))]);
    }

    public function replay(string $event)
    {
        abort_unless(config('finance.gateway_enabled'), 503);
        FinanceGatewayEvent::findOrFail($event);
        DeliverGatewayEvent::dispatch($event);

        return response()->json(['queued' => true], 202);
    }
}
