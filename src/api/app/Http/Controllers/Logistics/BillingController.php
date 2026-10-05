<?php

namespace App\Http\Controllers\Logistics;

use App\Services\Finance\Gateway\LogisticsBillingService;
use Illuminate\Http\Request;

class BillingController
{
    public function show(Request $request, LogisticsBillingService $billing)
    {
        return response()->json(['data' => $billing->details($request->user()->logisticsOrganization()->firstOrFail())])->header('Cache-Control', 'private, no-store');
    }
}
