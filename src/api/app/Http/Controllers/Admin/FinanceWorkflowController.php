<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FinanceSandboxBeneficiaryAccount;
use App\Services\Finance\FinanceWorkflowService;
use App\Services\Finance\SandboxSettlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinanceWorkflowController extends Controller
{
    public function clearRemittance(Request $request, string $batch, FinanceWorkflowService $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->clearRemittance($request->user(), $batch)]);
    }

    public function hold(Request $request, string $order, FinanceWorkflowService $workflow): JsonResponse
    {
        $data = $request->validate(['reason_code' => ['required', 'string', 'max:80'], 'notes' => ['nullable', 'string', 'max:1000']]);

        return response()->json(['data' => $workflow->placeHold($request->user(), $order, $data['reason_code'], $data['notes'] ?? null)], 201);
    }

    public function releaseHold(Request $request, string $hold, FinanceWorkflowService $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->releaseHold($request->user(), $hold)]);
    }

    public function sandboxAccount(Request $request, string $type, string $beneficiary): JsonResponse
    {
        abort_unless(in_array($type, ['seller', 'logistics'], true), 404);
        $data = $request->validate(['account_reference' => ['required', 'string', 'max:120'], 'scenario' => ['required', 'in:success,failure,delay,duplicate_callback,insufficient_funds'], 'is_active' => ['sometimes', 'boolean']]);
        $account = FinanceSandboxBeneficiaryAccount::query()->updateOrCreate(
            ['beneficiary_type' => $type, 'beneficiary_id' => $beneficiary],
            [...$data, 'is_active' => $data['is_active'] ?? true],
        );

        return response()->json(['data' => $account]);
    }

    public function settle(SandboxSettlementService $settlement): JsonResponse
    {
        return response()->json(['data' => ['created' => $settlement->run(), 'sandbox' => true]]);
    }

    public function callback(Request $request, string $reference, SandboxSettlementService $settlement): JsonResponse
    {
        $data = $request->validate(['outcome' => ['required', 'in:success,failure,insufficient_funds']]);

        return response()->json(['data' => $settlement->callback($reference, $data['outcome'])]);
    }
}
