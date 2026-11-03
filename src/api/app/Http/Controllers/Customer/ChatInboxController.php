<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\ListChatInboxRequest;
use App\Services\Messaging\ChatInboxService;
use Illuminate\Http\JsonResponse;

class ChatInboxController extends Controller
{
    public function __invoke(ListChatInboxRequest $request, ChatInboxService $inbox): JsonResponse
    {
        return response()->json($inbox->page($request->user(), 'customer', $request->validated('counterparty_role')))
            ->header('Cache-Control', 'private, no-store');
    }
}
