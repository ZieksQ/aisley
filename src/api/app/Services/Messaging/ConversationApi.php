<?php

namespace App\Services\Messaging;

use App\Http\Requests\Messaging\ListConversationsRequest;
use App\Http\Requests\Messaging\ReadConversationRequest;
use App\Http\Requests\Messaging\SendConversationMessageRequest;
use App\Http\Requests\Messaging\StartConversationRequest;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationApi
{
    public function __construct(private readonly ConversationService $conversations) {}

    public function index(ListConversationsRequest $request, string $role): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $page = $this->conversations->scoped($actor, $role)
            ->with(['shop.seller:id,role,status', 'customer.customerProfile:user_id,first_name,last_name', 'lastMessage'])
            ->whereNotNull('last_message_at')
            ->orderByDesc('last_message_at')->orderByDesc('id')->cursorPaginate(20);

        return $this->response([
            'items' => $page->getCollection()->map(fn (Conversation $conversation) => $this->conversations->summary($conversation, $actor, $role))->all(),
            'next_cursor' => $page->nextCursor()?->encode(),
            'unread_count' => $this->conversations->unreadTotal($actor, $role),
        ]);
    }

    public function unreadCount(Request $request, string $role): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        return $this->response(['unread_count' => $this->conversations->unreadTotal($actor, $role)]);
    }

    public function show(Request $request, string $role, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $conversation = $this->conversations->find($actor, $role, $id);

        return $this->response(['data' => $this->conversations->summary($conversation, $actor, $role)]);
    }

    public function messages(ListConversationsRequest $request, string $role, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $conversation = $this->conversations->find($actor, $role, $id);
        $page = $conversation->messages()->orderByDesc('sequence')->cursorPaginate(30);

        return $this->response([
            'items' => $page->getCollection()->reverse()->map(fn ($message) => $this->conversations->message($message, $conversation, $actor))->values()->all(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]);
    }

    public function start(StartConversationRequest $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $result = $this->conversations->start($actor, $request->validated(), $request->idempotencyKey());

        return $this->response([
            'conversation' => $this->conversations->summary($result['conversation'], $actor, 'customer'),
            'message' => $this->conversations->message($result['message'], $result['conversation'], $actor),
        ], 201);
    }

    public function send(SendConversationMessageRequest $request, string $role, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $result = $this->conversations->send($actor, $role, $id, $request->validated(), $request->idempotencyKey());

        return $this->response([
            'conversation' => $this->conversations->summary($result['conversation'], $actor, $role),
            'message' => $this->conversations->message($result['message'], $result['conversation'], $actor),
        ], 201);
    }

    public function read(ReadConversationRequest $request, string $role, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $conversation = $this->conversations->read($actor, $role, $id, (int) $request->validated('sequence'));

        return $this->response(['data' => $this->conversations->summary($conversation, $actor, $role)]);
    }

    private function response(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status)->header('Cache-Control', 'private, no-store');
    }
}
