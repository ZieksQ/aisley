<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\ListConversationsRequest;
use App\Http\Requests\Messaging\ReadConversationRequest;
use App\Http\Requests\Messaging\SendConversationMessageRequest;
use App\Services\Messaging\ConversationApi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    public function index(ListConversationsRequest $request, ConversationApi $api): JsonResponse
    {
        return $api->index($request, 'seller');
    }

    public function unreadCount(Request $request, ConversationApi $api): JsonResponse
    {
        return $api->unreadCount($request, 'seller');
    }

    public function show(Request $request, string $conversation, ConversationApi $api): JsonResponse
    {
        return $api->show($request, 'seller', $conversation);
    }

    public function messages(ListConversationsRequest $request, string $conversation, ConversationApi $api): JsonResponse
    {
        return $api->messages($request, 'seller', $conversation);
    }

    public function send(SendConversationMessageRequest $request, string $conversation, ConversationApi $api): JsonResponse
    {
        return $api->send($request, 'seller', $conversation);
    }

    public function read(ReadConversationRequest $request, string $conversation, ConversationApi $api): JsonResponse
    {
        return $api->read($request, 'seller', $conversation);
    }
}
