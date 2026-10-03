<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Messaging\CourierCounterpartyConversationController;
use App\Services\Messaging\CourierCounterpartyConversationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierConversationController extends CourierCounterpartyConversationController
{
    public function orderContext(Request $request, string $order, CourierCounterpartyConversationService $conversations): JsonResponse
    {
        return response()->json(['data' => $conversations->customerOrderContext($request->user(), $order)])
            ->header('Cache-Control', 'private, no-store');
    }

    protected function role(): string
    {
        return 'customer';
    }
}
