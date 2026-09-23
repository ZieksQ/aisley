<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Finance\AbstractFinanceController;
use App\Services\Finance\FinanceWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinanceController extends AbstractFinanceController
{
    protected function role(): string
    {
        return 'logistics';
    }

    public function remit(Request $request, FinanceWorkflowService $workflow): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string', 'max:120'], 'currency' => ['required', 'in:PHP'],
            'allocations' => ['required', 'array', 'min:1', 'max:500'],
            'allocations.*.order_id' => ['required', 'uuid', 'distinct'],
            'allocations.*.amount_cents' => ['required', 'integer', 'min:1'],
        ]);

        return response()->json(['data' => $workflow->submitRemittance($request->user(), $data['reference'], $data['currency'], $data['allocations'])], 201);
    }
}
