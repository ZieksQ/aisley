<?php

namespace App\Http\Controllers\Messaging;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\OperationalMessageRequest;
use App\Http\Requests\Messaging\StartCourierCounterpartyConversationRequest;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Messaging\CourierCounterpartyConversationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class CourierCounterpartyConversationController extends Controller
{
    public function __construct(private readonly CourierCounterpartyConversationService $conversations) {}

    abstract protected function role(): string;

    public function index(Request $request): JsonResponse
    {
        $input = $request->validate(['cursor' => ['sometimes', 'string', 'max:2048'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:50']]);
        $actor = $request->user();
        $page = $this->conversations->scoped($actor, $this->role())->whereNotNull('last_message_at')
            ->orderByDesc('last_message_at')->orderByDesc('id')->cursorPaginate($input['limit'] ?? 20);

        return $this->response(['data' => $page->getCollection()->map(
            fn (Conversation $conversation) => $this->conversations->summary($conversation, $actor, $this->role())
        )->all(), 'meta' => ['next_cursor' => $page->nextCursor()?->encode(),
            'unread_count' => $this->conversations->unreadTotal($actor, $this->role())]]);
    }

    public function start(StartCourierCounterpartyConversationRequest $request): JsonResponse
    {
        $input = $request->validated();

        return $this->writeResponse($this->conversations->startFromOrder(
            $request->user(), $this->role(), $input['context_id'], $input['body'], $request->idempotencyKey()
        ), $request->user());
    }

    public function show(Request $request, string $conversation): JsonResponse
    {
        return $this->response(['data' => $this->conversations->summary(
            $this->conversations->find($request->user(), $this->role(), $conversation), $request->user(), $this->role()
        )]);
    }

    public function messages(Request $request, string $conversation): JsonResponse
    {
        $input = $request->validate(['cursor' => ['sometimes', 'string', 'max:2048'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:50']]);
        $record = $this->conversations->find($request->user(), $this->role(), $conversation);
        $page = $record->messages()->orderByDesc('sequence')->cursorPaginate($input['limit'] ?? 20);

        return $this->response(['data' => $page->getCollection()->reverse()->map(
            fn ($message) => $this->conversations->message($message, $record, $request->user())
        )->values()->all(), 'meta' => ['next_cursor' => $page->nextCursor()?->encode()]]);
    }

    public function send(OperationalMessageRequest $request, string $conversation): JsonResponse
    {
        return $this->writeResponse($this->conversations->send(
            $request->user(), $this->role(), $conversation, $request->validated('body'), $request->idempotencyKey()
        ), $request->user());
    }

    public function read(Request $request, string $conversation): JsonResponse
    {
        $input = $request->validate(['last_read_sequence' => ['required', 'integer', 'min:1']]);
        $record = $this->conversations->read($request->user(), $this->role(), $conversation, (int) $input['last_read_sequence']);

        return $this->response(['data' => $this->conversations->summary($record, $request->user(), $this->role())]);
    }

    private function writeResponse(array $result, User $actor): JsonResponse
    {
        return $this->response(['conversation' => $this->conversations->summary($result['conversation'], $actor, $this->role()),
            'message' => $this->conversations->message($result['message'], $result['conversation'], $actor)],
            $result['replay'] ? 200 : 201);
    }

    private function response(array $body, int $status = 200): JsonResponse
    {
        return response()->json($body, $status)->header('Cache-Control', 'private, no-store');
    }
}
