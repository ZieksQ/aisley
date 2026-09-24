<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\OperationalMessageRequest;
use App\Http\Requests\Messaging\StartCustomerLogisticsConversationRequest;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Messaging\CustomerLogisticsConversationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LogisticsConversationController extends Controller
{
    public function __construct(private readonly CustomerLogisticsConversationService $conversations) {}

    public function index(Request $request): JsonResponse
    {
        $input = $request->validate(['cursor' => ['sometimes', 'string', 'max:2048'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:50']]);
        $actor = $request->user();
        $page = $this->conversations->scoped($actor, 'customer')->whereNotNull('last_message_at')
            ->orderByDesc('last_message_at')->orderByDesc('id')->cursorPaginate($input['limit'] ?? 20);

        return $this->response(['data' => $page->getCollection()->map(
            fn (Conversation $conversation) => $this->conversations->summary($conversation, $actor, 'customer')
        )->all(), 'meta' => ['next_cursor' => $page->nextCursor()?->encode(),
            'unread_count' => $this->conversations->unreadTotal($actor, 'customer')]]);
    }

    public function start(StartCustomerLogisticsConversationRequest $request): JsonResponse
    {
        $actor = $request->user();
        $input = $request->validated();
        $result = $this->conversations->start($actor, 'customer', $input['context_id'], $input['body'], $request->idempotencyKey());

        return $this->writeResponse($result, $actor);
    }

    public function show(Request $request, string $conversation): JsonResponse
    {
        return $this->response(['data' => $this->conversations->summary(
            $this->conversations->find($request->user(), 'customer', $conversation), $request->user(), 'customer'
        )]);
    }

    public function messages(Request $request, string $conversation): JsonResponse
    {
        $input = $request->validate(['cursor' => ['sometimes', 'string', 'max:2048'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:50']]);
        $record = $this->conversations->find($request->user(), 'customer', $conversation);
        $page = $record->messages()->orderByDesc('sequence')->cursorPaginate($input['limit'] ?? 20);

        return $this->response(['data' => $page->getCollection()->reverse()->map(
            fn ($message) => $this->conversations->message($message, $record, $request->user())
        )->values()->all(), 'meta' => ['next_cursor' => $page->nextCursor()?->encode()]]);
    }

    public function send(OperationalMessageRequest $request, string $conversation): JsonResponse
    {
        return $this->writeResponse($this->conversations->send(
            $request->user(), 'customer', $conversation, $request->validated('body'), $request->idempotencyKey()
        ), $request->user());
    }

    public function read(Request $request, string $conversation): JsonResponse
    {
        $input = $request->validate(['last_read_sequence' => ['required', 'integer', 'min:1']]);
        $record = $this->conversations->read($request->user(), 'customer', $conversation, (int) $input['last_read_sequence']);

        return $this->response(['data' => $this->conversations->summary($record, $request->user(), 'customer')]);
    }

    private function writeResponse(array $result, User $actor): JsonResponse
    {
        return $this->response(['conversation' => $this->conversations->summary($result['conversation'], $actor, 'customer'),
            'message' => $this->conversations->message($result['message'], $result['conversation'], $actor)],
            $result['replay'] ? 200 : 201);
    }

    private function response(array $body, int $status = 200): JsonResponse
    {
        return response()->json($body, $status)->header('Cache-Control', 'private, no-store');
    }
}
