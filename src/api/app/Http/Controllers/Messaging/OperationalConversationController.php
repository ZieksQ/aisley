<?php

namespace App\Http\Controllers\Messaging;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\OperationalMessageRequest;
use App\Http\Requests\Messaging\StartOperationalConversationRequest;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Messaging\OperationalConversationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OperationalConversationController extends Controller
{
    public function __construct(private readonly OperationalConversationService $conversations) {}

    public function index(Request $request): JsonResponse
    {
        $input = $request->validate([
            'cursor' => ['sometimes', 'string', 'max:2048'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'leg' => ['sometimes', Rule::in(['first_mile', 'final_mile'])],
        ]);
        $actor = $request->user();
        $role = $this->role($request);
        $query = $this->conversations->scoped($actor, $role)
            ->whereNotNull('last_message_at')
            ->when($input['leg'] ?? null, fn ($query, $leg) => $query->where('task_leg', $leg))
            ->orderByDesc('last_message_at')->orderByDesc('id');
        $page = $query->cursorPaginate($input['limit'] ?? 20);
        $items = $page->getCollection()->map(fn (Conversation $conversation) => $this->conversations->summary($conversation, $actor, $role))->all();

        return $this->response(['data' => $items, 'meta' => [
            'next_cursor' => $page->nextCursor()?->encode(),
            'unread_count' => $this->conversations->unreadTotal($actor, $role),
        ]]);
    }

    public function start(StartOperationalConversationRequest $request): JsonResponse
    {
        $actor = $request->user();
        $role = $this->role($request);
        $input = $request->validated();
        if ($role === 'courier' && ($input['counterparty_role'] ?? null) !== 'logistics') {
            abort(422, 'Only Logistics messaging is available for Courier tasks.');
        }
        $result = $this->conversations->start($actor, $role, $input, $request->idempotencyKey());

        return $this->writeResponse($result, $actor, $role);
    }

    public function show(Request $request, string $conversation): JsonResponse
    {
        $actor = $request->user();
        $role = $this->role($request);
        $record = $this->conversations->find($actor, $role, $conversation);

        return $this->response(['data' => $this->conversations->summary($record, $actor, $role)]);
    }

    public function messages(Request $request, string $conversation): JsonResponse
    {
        $input = $request->validate(['cursor' => ['sometimes', 'string', 'max:2048'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:50']]);
        $actor = $request->user();
        $record = $this->conversations->find($actor, $this->role($request), $conversation);
        $page = $record->messages()->orderByDesc('sequence')->cursorPaginate($input['limit'] ?? 20);

        return $this->response([
            'data' => $page->getCollection()->reverse()->map(fn ($message) => $this->conversations->message($message, $record, $actor))->values()->all(),
            'meta' => ['next_cursor' => $page->nextCursor()?->encode()],
        ]);
    }

    public function send(OperationalMessageRequest $request, string $conversation): JsonResponse
    {
        $actor = $request->user();
        $role = $this->role($request);
        $result = $this->conversations->send($actor, $role, $conversation, $request->validated('body'), $request->idempotencyKey());

        return $this->writeResponse($result, $actor, $role);
    }

    public function read(Request $request, string $conversation): JsonResponse
    {
        $input = $request->validate(['last_read_sequence' => ['required', 'integer', 'min:1']]);
        $actor = $request->user();
        $role = $this->role($request);
        $record = $this->conversations->read($actor, $role, $conversation, (int) $input['last_read_sequence']);

        return $this->response(['data' => $this->conversations->summary($record, $actor, $role)]);
    }

    private function writeResponse(array $result, User $actor, string $role): JsonResponse
    {
        return $this->response([
            'conversation' => $this->conversations->summary($result['conversation'], $actor, $role),
            'message' => $this->conversations->message($result['message'], $result['conversation'], $actor),
        ], $result['replay'] ? 200 : 201);
    }

    private function role(Request $request): string
    {
        return $request->routeIs('logistics.*') ? 'logistics' : 'courier';
    }

    private function response(array $body, int $status = 200): JsonResponse
    {
        return response()->json($body, $status)->header('Cache-Control', 'private, no-store');
    }
}
