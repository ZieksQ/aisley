<?php

namespace App\Http\Controllers\Support;

use App\Http\Controllers\Controller;
use App\Http\Requests\Support\CreateSupportTicketRequest;
use App\Http\Requests\Support\ListSupportTicketsRequest;
use App\Http\Requests\Support\ReplySupportTicketRequest;
use App\Services\Support\SupportTicketReader;
use App\Services\Support\SupportTicketWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RequesterSupportTicketController extends Controller
{
    public function __construct(
        private readonly SupportTicketReader $reader,
        private readonly SupportTicketWriter $writer,
    ) {}

    public function index(ListSupportTicketsRequest $request): JsonResponse
    {
        return $this->respond($this->reader->index($request->user(), $request->validated()));
    }

    public function store(CreateSupportTicketRequest $request): JsonResponse
    {
        return $this->written($this->writer->create($request->user(), $request->validated(), $request->idempotencyKey()));
    }

    public function show(Request $request, string $ticket): JsonResponse
    {
        $input = $request->validate(['cursor' => ['sometimes', 'string', 'max:2048'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:50']]);

        return $this->respond($this->reader->detail($request->user(), $ticket, (int) ($input['limit'] ?? 30)));
    }

    public function reply(ReplySupportTicketRequest $request, string $ticket): JsonResponse
    {
        return $this->written($this->writer->reply($request->user(), $ticket, $request->validated(), $request->idempotencyKey()));
    }

    public function read(Request $request, string $ticket): JsonResponse
    {
        $input = $request->validate(['last_read_sequence' => ['required', 'integer', 'min:0']]);

        return $this->respond($this->reader->markRead($request->user(), $ticket, (int) $input['last_read_sequence']));
    }

    private function written(array $result): JsonResponse
    {
        return $this->respond($result['payload'], $result['status']);
    }

    private function respond(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)->header('Cache-Control', 'private, no-store');
    }
}
