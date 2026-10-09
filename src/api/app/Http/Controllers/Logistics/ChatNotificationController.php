<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Services\Messaging\ChatNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatNotificationController extends Controller
{
    public function __invoke(Request $request, ChatNotificationService $notifications): JsonResponse
    {
        return response()->json($notifications->preview($request->user(), 'logistics'))
            ->header('Cache-Control', 'private, no-store');
    }
}
